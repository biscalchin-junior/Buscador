const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { 
  initDb, saveProduct, saveHistory, getHistory, 
  updateProductStatus, trashProduct, getSetting, 
  saveSetting, getActiveProducts 
} = require('./database');
const { scrapeAmazon, scrapeMercadoLivre, scrapeMagazineLuiza, scrapeCasasBahia } = require('./scraper');

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

// Inicia o banco de dados
initDb();

let cronTask = null;

async function runCronJob() {
  console.log('[CRON] Iniciando varredura automatizada...');
  try {
    const activeProducts = await getActiveProducts();
    if (!activeProducts || activeProducts.length === 0) {
      console.log('[CRON] Nenhum produto ativo para varrer.');
      return;
    }
    
    // Varredura sequencial para não estourar a memória ou ser bloqueado
    for (const prod of activeProducts) {
      console.log(`[CRON] Auditando: ${prod.url}`);
      try {
        let dataArray = [];
        if (prod.url.includes('amazon')) dataArray = await scrapeAmazon(prod.url);
        else if (prod.url.includes('mercadolivre')) dataArray = await scrapeMercadoLivre(prod.url);
        else if (prod.url.includes('magazineluiza')) dataArray = await scrapeMagazineLuiza(prod.url);
        else if (prod.url.includes('casasbahia')) dataArray = await scrapeCasasBahia(prod.url);
        else dataArray = await scrapeAmazon(prod.url);

        for (const data of dataArray) {
          if (data.asin !== 'UNKNOWN') {
             await saveProduct(data.asin, data.title, data.url, 'Cron Update', data.store || 'Amazon');
             await saveHistory(data);
          }
        }
      } catch (err) {
        console.error(`[CRON] Erro ao raspar ${prod.url}:`, err.message);
      }
      // Pequeno delay entre os produtos
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    console.log('[CRON] Varredura automatizada concluída.');
  } catch (error) {
    console.error('[CRON] Erro fatal no job:', error);
  }
}

async function setupCron() {
  const schedule = await getSetting('cron_schedule') || '0 0 * * *'; // Default meia noite
  
  if (cronTask) {
    cronTask.stop();
  }

  try {
    cronTask = cron.schedule(schedule, runCronJob);
    console.log(`[CRON] Agendador configurado com sucesso.`);
  } catch (err) {
    console.error(`[CRON] ERRO: Expressão Cron inválida: ${schedule}. Agendador desativado.`);
    if (cronTask) cronTask.stop();
  }
}

// Inicia o Cron Job na inicialização
setTimeout(setupCron, 2000); // Aguarda db inicializar

app.post('/api/audit', async (req, res) => {
  const { urls } = req.body; 
  
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'Nenhuma URL fornecida.' });
  }

  // Retorna imediatamente para o frontend não travar (Timeout do Proxy)
  res.json({ message: 'Pesquisa iniciada em segundo plano. Os resultados aparecerão na lista em instantes.', results: [] });

  // Processa em background
  (async () => {
    for (const url of urls) {
      try {
        console.log(`[BACKGROUND] Iniciando auditoria para: ${url}`);
        let dataArray = [];
        
        if (url.startsWith('http')) {
            if (url.includes('amazon')) dataArray = await scrapeAmazon(url);
            else if (url.includes('mercadolivre')) dataArray = await scrapeMercadoLivre(url);
            else if (url.includes('magazineluiza')) dataArray = await scrapeMagazineLuiza(url);
            else if (url.includes('casasbahia')) dataArray = await scrapeCasasBahia(url);
            else {
              // Tenta encontrar nos novos módulos se a URL bater
              const { STORE_CONFIGS, scrapeGenericStore } = require('./scraper');
              for (const [storeName, config] of Object.entries(STORE_CONFIGS)) {
                if (url.toLowerCase().includes(storeName.toLowerCase().replace('!', ''))) {
                  dataArray = await scrapeGenericStore(storeName, url);
                  break;
                }
              }
            }
        } else {
        // Processar em lotes para não estourar a memória (Máximo 3 por vez)
        const p1 = () => scrapeAmazon(url).catch(e => { console.error('Erro Amazon:', e); return []; });
        const p2 = () => scrapeMercadoLivre(url).catch(e => { console.error('Erro ML:', e); return []; });
        const p3 = () => scrapeMagazineLuiza(url).catch(e => { console.error('Erro Magalu:', e); return []; });
        const p4 = () => scrapeCasasBahia(url).catch(e => { console.error('Erro CB:', e); return []; });
        
        const { STORE_CONFIGS, scrapeGenericStore } = require('./scraper');
        const modularTasks = Object.keys(STORE_CONFIGS).map(name => 
            () => scrapeGenericStore(name, url).catch(e => { console.error(`Erro ${name}:`, e); return []; })
        );

        const allTasks = [p1, p2, p3, p4, ...modularTasks];
        const resultsArray = [];
        
        // Executa em lotes de 3
        for (let i = 0; i < allTasks.length; i += 3) {
            const batch = allTasks.slice(i, i + 3).map(fn => fn());
            const batchResults = await Promise.all(batch);
            resultsArray.push(...batchResults);
        }

        dataArray = resultsArray.flat();
        }
        
        for (const data of dataArray) {
          if (data.asin !== 'UNKNOWN') {
             const category = url.startsWith('http') ? data.title.split(' ')[0] : decodeURIComponent(url).split(' ')[0];
             await saveProduct(data.asin, data.title, data.url, category, data.store || 'Amazon');
             await saveHistory(data);
          }
        }
        console.log(`[BACKGROUND] Auditoria finalizada para: ${url}`);
      } catch (error) {
        console.error(`[BACKGROUND] Erro ao raspar ${url}:`, error.message);
      }
    }
  })();
});

app.get('/api/history', async (req, res) => {
  try {
    const isTrash = req.query.trash === 'true';
    const history = await getHistory(isTrash);
    
    const grouped = {};
    history.forEach(row => {
        if (!grouped[row.asin]) {
            grouped[row.asin] = {
                asin: row.asin,
                title: row.title,
                url: row.url,
                category: row.category,
                store: row.store || 'Amazon',
                is_active: row.is_active,
                is_deleted: row.is_deleted,
                history: [],
                latest: null
            };
        }
        
        try { row.other_sellers = JSON.parse(row.other_sellers); } catch(e) { row.other_sellers = []; }
        try { row.product_variations = JSON.parse(row.product_variations); } catch(e) { row.product_variations = {}; }

        grouped[row.asin].history.push(row);
    });

    Object.values(grouped).forEach(item => {
        item.history.sort((a, b) => new Date(a.date) - new Date(b.date));
        item.latest = item.history[item.history.length - 1];
    });

    res.json(Object.values(grouped));
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar histórico.' });
  }
});

app.put('/api/product/:asin/toggle-active', async (req, res) => {
  try {
    const { isActive } = req.body;
    await updateProductStatus(req.params.asin, isActive);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar status.' });
  }
});

app.put('/api/product/:asin/trash', async (req, res) => {
  try {
    await trashProduct(req.params.asin, true);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao mover para lixeira.' });
  }
});

app.put('/api/product/:asin/restore', async (req, res) => {
  try {
    await trashProduct(req.params.asin, false);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao restaurar.' });
  }
});

app.get('/api/settings/cron', async (req, res) => {
  try {
    const schedule = await getSetting('cron_schedule') || '0 0 * * *';
    res.json({ schedule });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar configurações.' });
  }
});

app.post('/api/settings/cron', async (req, res) => {
  try {
    const { schedule } = req.body;
    if (!schedule) return res.status(400).json({ error: 'Cron schedule inválido.' });
    
    // Validar expressao
    if (!cron.validate(schedule)) {
      return res.status(400).json({ error: 'Formato Cron inválido. Use algo como "0 * * * *".' });
    }

    await saveSetting('cron_schedule', schedule);
    setupCron(); 
    res.json({ success: true, schedule });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao salvar configuração.' });
  }
});

app.post('/api/history/trash-all', async (req, res) => {
  try {
    console.log('[API] Movendo todos os produtos para a lixeira...');
    const { trashAllProducts } = require('./database');
    await trashAllProducts();
    res.json({ success: true });
  } catch (error) {
    console.error('[API] Erro ao limpar lista:', error.message);
    res.status(500).json({ error: 'Erro ao limpar lista.' });
  }
});

app.delete('/api/history/empty-trash', async (req, res) => {
  try {
    console.log('[API] Esvaziando a lixeira permanentemente...');
    const { deleteAllTrash } = require('./database');
    await deleteAllTrash();
    res.json({ success: true });
  } catch (error) {
    console.error('[API] Erro ao esvaziar lixeira:', error.message);
    res.status(500).json({ error: 'Erro ao esvaziar lixeira.' });
  }
});

// Log Streaming logic
const logBuffer = [];
const logSubscribers = new Set();

function addLog(msg, type = 'info') {
  const logEntry = { id: Date.now() + Math.random(), msg, type, time: new Date().toLocaleTimeString() };
  logBuffer.push(logEntry);
  if (logBuffer.length > 100) logBuffer.shift();
  
  // Salvar no arquivo físico para o usuário ler depois
  const fs = require('fs');
  const path = require('path');
  const logLine = `[${new Date().toLocaleString()}] [${type.toUpperCase()}] ${msg}\n`;
  try {
    fs.appendFileSync(path.join(__dirname, 'audit.log'), logLine);
  } catch (err) {
    originalError('Erro ao escrever no arquivo de log:', err);
  }

  const sseData = `data: ${JSON.stringify(logEntry)}\n\n`;
  logSubscribers.forEach(sub => sub.write(sseData));
}

// Sobrescrever console.log para capturar logs
const originalLog = console.log;
console.log = (...args) => {
  originalLog(...args);
  addLog(args.join(' '), 'info');
};

const originalError = console.error;
console.error = (...args) => {
  originalError(...args);
  addLog(args.join(' '), 'error');
};

app.get('/api/logs/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Enviar histórico recente
  logBuffer.forEach(log => {
    res.write(`data: ${JSON.stringify(log)}\n\n`);
  });

  logSubscribers.add(res);
  req.on('close', () => logSubscribers.delete(res));
});

app.post('/api/settings/headless', async (req, res) => {
  try {
    const { enabled } = req.body;
    await saveSetting('is_headless', enabled ? 'true' : 'false');
    res.json({ success: true, enabled });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao salvar config.' });
  }
});

app.get('/api/settings/headless', async (req, res) => {
  try {
    const val = await getSetting('is_headless');
    res.json({ enabled: val !== 'false' });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao buscar config.' });
  }
});

app.post('/api/settings/relevancy', async (req, res) => {
  try {
    const { enabled } = req.body;
    const { saveSetting } = require('./database');
    await saveSetting('relevancy_enabled', enabled ? 'true' : 'false');
    res.json({ success: true, enabled });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao salvar config.' });
  }
});

app.get('/api/settings/relevancy', async (req, res) => {
  try {
    const { getSetting } = require('./database');
    const val = await getSetting('relevancy_enabled');
    res.json({ enabled: val !== 'false' });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao buscar config.' });
  }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Servidor rodando em http://127.0.0.1:${PORT}`);
});

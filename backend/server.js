const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { 
  initDb, saveProduct, saveHistory, getHistory, 
  updateProductStatus, trashProduct, getSetting, 
  saveSetting, getActiveProducts, trashAllProducts,
  deleteAllTrash
} = require('./database');
const { scrapeAmazon } = require('./scraper');
const logger = require('./logger');
const emitLog = logger.emitLog;
const {
  initAuthDb, generateToken, authMiddleware, superadminMiddleware,
  findUserByEmail, createUser, saveGuestSearch, getGuestSearches, getAllUsers, bcrypt
} = require('./auth');

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

// Inicia o banco de dados
initDb();
initAuthDb();

let cronTask = null;
let stopAudit = false;
let currentAuditProgress = { current: 0, total: 0, active: false };

// ========== SISTEMA DE LOGS EM TEMPO REAL (SSE) ==========

app.get('/api/logs/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  logger.addClient(res);

  req.on('close', () => {
    logger.removeClient(res);
  });
});

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
        let dataArray = await scrapeAmazon(prod.url);

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

  stopAudit = false;
  currentAuditProgress = { current: 0, total: urls.length, active: true, status: 'Iniciando...' };
  
  res.json({ success: true, message: 'Pesquisa iniciada em segundo plano.' });

  (async () => {
    emitLog(`⚙️ Auditoria iniciada — ${urls.length} item(s) na fila`, 'info');

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      if (stopAudit) {
        emitLog('⛔ Pesquisa interrompida pelo usuário.', 'warn');
        break;
      }
      
      currentAuditProgress.current = i;
      currentAuditProgress.status = `Processando item ${i + 1} de ${urls.length}...`;
      
      const shortUrl = url.length > 60 ? url.substring(0, 60) + '...' : url;
      emitLog(`🔍 [${i+1}/${urls.length}] Acessando: ${shortUrl}`, 'info');

      try {
        let dataArray = [];
        let pagesNavigated = 0;

        const onResult = async (data) => {
          if (data.asin !== 'UNKNOWN') {
             const category = url.startsWith('http') ? data.title.split(' ')[0] : decodeURIComponent(url).split(' ')[0];
             await saveProduct(data.asin, data.title, data.url, category, data.store || 'Amazon', data.image_url);
             await saveHistory(data);
             
             // Log detalhado do produto capturado
             const titleShort = data.title ? data.title.substring(0, 50) : 'S/Título';
             emitLog(`✅ ${titleShort}...`, 'success');
             emitLog(`   💰 À Vista: R$ ${data.main_price?.toFixed(2) || '?'}`, 'data');
             if (data.old_price && data.old_price > data.main_price) {
               emitLog(`   🏷️ De: R$ ${data.old_price.toFixed(2)} (-${data.real_discount || 0}% OFF)`, 'data');
             }
             if (data.installments_count && data.installments_count > 1) {
               emitLog(`   📆 Parcelamento: ${data.installments_count}x de R$ ${data.installment_value?.toFixed(2)} = R$ ${data.installment_total?.toFixed(2)}`, 'data');
               if (data.interest_rate > 0) {
                 emitLog(`   ⚠️ Juros: +${data.interest_rate}% sobre o à vista`, 'warn');
               } else {
                 emitLog(`   ✅ SEM JUROS no parcelamento`, 'success');
               }
             }
             emitLog(`   🎯 ASIN: ${data.asin}`, 'data');
          }
        };

        if (url.startsWith('http')) {
            dataArray = await scrapeAmazon(url, onResult);
        } else {
            emitLog(`📝 Termo de busca: "${url}"`, 'info');
            dataArray = await scrapeAmazon(url, onResult).catch(e => { emitLog(`❌ Erro Amazon: ${e.message}`, 'error'); return []; });
        }
        
        if (stopAudit) break;

        if (dataArray.length === 0) {
          emitLog(`⚠️ Nenhum resultado encontrado para: ${shortUrl}`, 'warn');
        } else if (dataArray.pages_navigated) {
          emitLog(`🗺️ Navegou por ${dataArray.pages_navigated} páginas para capturar esses dados.`, 'info');
        }
      } catch (error) {
        emitLog(`❌ Erro ao raspar: ${error.message}`, 'error');
      }
    }
    currentAuditProgress.current = urls.length;
    currentAuditProgress.status = 'Concluído';
    currentAuditProgress.active = false;
    emitLog(`🏁 Auditoria finalizada! ${urls.length} item(s) processado(s).`, 'success');
  })();
});

app.post('/api/audit/active', async (req, res) => {
  if (currentAuditProgress.active) {
    return res.status(400).json({ error: 'Já existe uma auditoria em andamento.' });
  }

  try {
    const products = await getActiveProducts();
    const urls = products.map(p => p.url);

    if (urls.length === 0) {
      return res.json({ success: false, message: 'Nenhum produto ativo na lista para atualizar.' });
    }

    stopAudit = false;
    currentAuditProgress = {
      active: true,
      current: 0,
      total: urls.length,
      status: 'Iniciando atualização da lista...'
    };

    res.json({ success: true, total: urls.length });

    (async () => {
      emitLog(`🔄 Atualizando ${urls.length} produto(s) da lista...`, 'info');
      for (let i = 0; i < urls.length; i++) {
        if (stopAudit) {
          emitLog('⛔ Atualização interrompida.', 'warn');
          break;
        }
        const url = urls[i];
        currentAuditProgress.current = i;
        currentAuditProgress.status = `Atualizando item ${i + 1} de ${urls.length}...`;
        
        const shortUrl = url.length > 60 ? url.substring(0, 60) + '...' : url;
        emitLog(`🔍 [${i+1}/${urls.length}] Atualizando: ${shortUrl}`, 'info');

        try {
          const dataArray = await scrapeAmazon(url);
          for (const data of dataArray) {
            if (data.asin !== 'UNKNOWN') {
               await saveProduct(data.asin, data.title, data.url, data.category || 'Geral', data.store || 'Amazon');
               await saveHistory(data);
               
               const titleShort = data.title ? data.title.substring(0, 50) : 'S/Título';
               emitLog(`✅ ${titleShort}... | R$ ${data.main_price?.toFixed(2)}`, 'success');
               if (data.installments_count > 1) {
                 emitLog(`   📆 ${data.installments_count}x R$ ${data.installment_value?.toFixed(2)} | Juros: ${data.interest_rate > 0 ? '+' + data.interest_rate + '%' : 'Sem juros'}`, 'data');
               }
            }
          }
        } catch (error) {
          emitLog(`❌ Erro: ${error.message}`, 'error');
        }
      }
      currentAuditProgress.current = urls.length;
      currentAuditProgress.status = 'Concluído';
      currentAuditProgress.active = false;
      emitLog(`🏁 Atualização finalizada!`, 'success');
    })();

  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar produtos ativos.' });
  }
});

app.post('/api/audit/stop', (req, res) => {
  stopAudit = true;
  currentAuditProgress.active = false;
  console.log('[API] Comando de interrupção recebido.');
  res.json({ success: true, message: 'Interrupção solicitada.' });
});

app.get('/api/audit/progress', (req, res) => {
  res.json(currentAuditProgress);
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
                image_url: row.image_url,
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

// ========== AUTH ROUTES ==========

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, birthDate } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    if (password.length < 6) return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres.' });
    const existing = await findUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'E-mail já cadastrado.' });
    const hash = await bcrypt.hash(password, 12);
    const user = await createUser(email, hash, birthDate);
    const token = generateToken(user);
    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno ao registrar.' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    const user = await findUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'Credenciais inválidas.' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Credenciais inválidas.' });
    const token = generateToken(user);
    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno ao autenticar.' });
  }
});

// GET /api/auth/me  (valida token e retorna perfil)
app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/public/search  (pesquisa pública — guest ou logado)
app.post('/api/public/search', async (req, res) => {
  const { term, userLabel, userId } = req.body;
  if (!term || !term.trim()) return res.status(400).json({ error: 'Termo de pesquisa obrigatório.' });

  try {
    // Busca histórico existente no banco primeiro
    const history = await getHistory(false);
    const lowerTerm = term.toLowerCase();
    const matched = history.filter(p =>
      p.title?.toLowerCase().includes(lowerTerm) ||
      p.asin?.toLowerCase().includes(lowerTerm)
    );

    // Se não achou nada no banco, raspar na Amazon em tempo real
    if (matched.length === 0) {
      console.log(`[Guest Search] Item "${term}" não encontrado localmente. Iniciando scrape na Amazon...`);
      try {
        const scrapedData = await scrapeAmazon(term);
        if (scrapedData && scrapedData.length > 0) {
          for (const data of scrapedData) {
            if (data.asin && data.asin !== 'UNKNOWN') {
               const category = data.title ? data.title.split(' ')[0] : 'Geral';
               await saveProduct(data.asin, data.title, data.url, category, data.store || 'Amazon', data.image_url);
               await saveHistory(data);
               // Adapta os dados raspados para o formato que o frontend espera no histórico
               matched.push({
                 title: data.title,
                 url: data.url,
                 category: category,
                 image_url: data.image_url,
                 store: data.store || 'Amazon',
                 asin: data.asin,
                 main_price: data.main_price,
                 old_price: data.old_price,
                 history: [data] // mock do historico inicial
               });
            }
          }
        }
      } catch (scrapeErr) {
        console.error(`[Guest Search] Erro ao raspar Amazon:`, scrapeErr.message);
      }
    }

    // Identifica o item mais barato
    let cheapest = null;
    if (matched.length > 0) {
      cheapest = matched.reduce((min, p) => (p.main_price < (min?.main_price || Infinity) ? p : min), null);
    }

    // Salvar pesquisa silenciosamente (Inteligência da Plataforma)
    await saveGuestSearch({
      term: term.trim(),
      userLabel: userLabel || 'Guest User',
      userId: userId || null,
      itemTitle: cheapest?.title || null,
      itemAsin: cheapest?.asin || null,
      itemPrice: cheapest?.main_price || null,
      itemStore: cheapest?.store || null,
    }).catch(() => {});

    res.json({ results: matched, cheapest });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao processar pesquisa.' });
  }
});

// GET /api/admin/guest-searches  (superadmin apenas)
app.get('/api/admin/guest-searches', superadminMiddleware, async (req, res) => {
  try {
    const searches = await getGuestSearches();
    res.json(searches);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar pesquisas.' });
  }
});

// GET /api/admin/users  (superadmin apenas)
app.get('/api/admin/users', superadminMiddleware, async (req, res) => {
  try {
    const users = await getAllUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar usuários.' });
  }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Servidor rodando em http://127.0.0.1:${PORT}`);
});

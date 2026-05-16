const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { 
  initDb, saveProduct, saveHistory, getHistory, linkProductToUser,
  updateProductStatus, trashProduct, getSetting, 
  saveSetting, getActiveProducts, trashAllProducts,
  deleteAllTrash, updateProductFeedback, getFlaggedProducts, getAdminStats
} = require('./database');
const { scrapeAmazon } = require('./scraper');
const logger = require('./logger');
const emitLog = logger.emitLog;
const {
  initAuthDb, generateToken, authMiddleware, superadminMiddleware,
  findUserByEmail, createUser, saveGuestSearch, getGuestSearches, getAllUsers, bcrypt
} = require('./auth');
const os = require('os');

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

// Tracking de usuários online
const activeUsers = new Map();
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    const userId = req.headers['authorization'] || req.ip;
    activeUsers.set(userId, Date.now());
  }
  next();
});

// Limpar usuários inativos (5 min)
setInterval(() => {
  const now = Date.now();
  for (const [id, lastSeen] of activeUsers.entries()) {
    if (now - lastSeen > 5 * 60 * 1000) activeUsers.delete(id);
  }
}, 30000);

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

app.post('/api/audit', authMiddleware, async (req, res) => {
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
             await linkProductToUser(req.user.email, data.asin);
             
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

app.get('/api/history', authMiddleware, async (req, res) => {
  try {
    const isTrash = req.query.trash === 'true';
    const history = await getHistory(isTrash, req.user.role, req.user.email);
    
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

app.post('/api/product/:asin/feedback', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body; // 'ok' or 'error'
    const { asin } = req.params;

    if (status === 'error') {
      console.log(`[Feedback] Usuário reportou erro no ASIN ${asin}. Iniciando re-scrape de verificação...`);
      // Buscar URL original no banco
      const products = await getActiveProducts();
      const product = products.find(p => p.asin === asin);
      
      if (product && product.url) {
        const amazon = require('./stores/amazon');
        const newData = await amazon.processProductDetail(product.url);
        
        if (newData) {
          // Salvar o novo histórico e o log de revisão
          await saveHistory(newData);
          await updateProductFeedback(asin, 'error', newData.review_log);
          console.log(`[Feedback] Re-scrape concluído para ${asin}. Log salvo para análise do Admin.`);
        }
      }
    } else {
      await updateProductFeedback(asin, status);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('[Feedback] Erro:', error.message);
    res.status(500).json({ error: 'Erro ao registrar feedback.' });
  }
});

app.post('/api/admin/product/:asin/resolve', superadminMiddleware, async (req, res) => {
  try {
    const { asin } = req.params;
    // Marca como 'fixed' para notificar o usuário
    await updateProductFeedback(asin, 'fixed');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao resolver produto.' });
  }
});

app.get('/api/admin/flagged-products', superadminMiddleware, async (req, res) => {
  try {
    const products = await getFlaggedProducts();
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar produtos revisados.' });
  }
});

app.get('/api/settings', superadminMiddleware, async (req, res) => {
  try {
    const cronSchedule = await getSetting('cron_schedule') || '0 0 * * *';
    const isHeadless = await getSetting('is_headless') !== 'false';
    const loggingEnabled = await getSetting('logging_enabled') !== 'false';
    
    res.json({ cronSchedule, isHeadless, loggingEnabled });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar configurações.' });
  }
});

app.post('/api/settings', superadminMiddleware, async (req, res) => {
  try {
    const { cronSchedule, isHeadless, loggingEnabled } = req.body;
    
    if (cronSchedule) {
      if (!cron.validate(cronSchedule)) {
        return res.status(400).json({ error: 'Formato Cron inválido. Use algo como "0 * * * *".' });
      }
      await saveSetting('cron_schedule', cronSchedule);
      setupCron();
    }
    
    if (isHeadless !== undefined) {
      await saveSetting('is_headless', isHeadless ? 'true' : 'false');
    }
    
    if (loggingEnabled !== undefined) {
      await saveSetting('logging_enabled', loggingEnabled ? 'true' : 'false');
      globalLoggingEnabled = loggingEnabled;
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao salvar configuração.' });
  }
});

app.get('/api/admin/stats', superadminMiddleware, async (req, res) => {
  try {
    const dbStats = await getAdminStats();
    const systemInfo = {
      cpuUsage: (os.loadavg()[0] * 100 / os.cpus().length).toFixed(2) + '%',
      memUsage: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2) + ' MB',
      uptime: Math.floor(process.uptime()) + 's'
    };
    
    res.json({
      liveUsers: activeUsers.size,
      ...dbStats,
      system: systemInfo
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar estatísticas.' });
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
let globalLoggingEnabled = true;

// Inicializar estado do log
(async () => {
  const setting = await getSetting('logging_enabled');
  globalLoggingEnabled = setting !== 'false';
})();

function addLog(msg, type = 'info') {
  const logEntry = { id: Date.now() + Math.random(), msg, type, time: new Date().toLocaleTimeString() };
  logBuffer.push(logEntry);
  if (logBuffer.length > 100) logBuffer.shift();
  
  // Salvar no arquivo físico para o usuário ler depois
  if (globalLoggingEnabled) {
    const fs = require('fs');
    const path = require('path');
    const logLine = `[${new Date().toLocaleString()}] [${type.toUpperCase()}] ${msg}\n`;
    try {
      fs.appendFileSync(path.join(__dirname, 'audit.log'), logLine);
    } catch (err) {
      originalError('Erro ao escrever no arquivo de log:', err);
    }
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
    // 1. Busca histórico existente no banco primeiro
    const history = await getHistory(false);
    const lowerTerm = term.toLowerCase();
    const dbMatched = history.filter(p =>
      p.title?.toLowerCase().includes(lowerTerm) ||
      p.asin?.toLowerCase().includes(lowerTerm)
    );

    // 2. Sempre raspa na Amazon em tempo real para garantir dados frescos (Scrape Híbrido)
    console.log(`[Guest Search] Iniciando scrape híbrido para "${term}"...`);
    let webMatched = [];
    try {
      const scrapedData = await scrapeAmazon(term);
      if (scrapedData && scrapedData.length > 0) {
        for (const data of scrapedData) {
          if (data.asin && data.asin !== 'UNKNOWN') {
             const category = data.title ? data.title.split(' ')[0] : 'Geral';
             await saveProduct(data.asin, data.title, data.url, category, data.store || 'Amazon', data.image_url);
             await saveHistory(data);
             webMatched.push({
               asin: data.asin,
               title: data.title,
               url: data.url,
               category: category,
               image_url: data.image_url,
               store: data.store || 'Amazon',
               main_price: data.main_price,
               old_price: data.old_price,
               history: [{ date: new Date().toISOString(), main_price: data.main_price }]
             });
          }
        }
      }
    } catch (e) {
      console.error(`[Guest Search] Erro no scrape: ${e.message}`);
    }

    // 3. Unificar resultados (removendo duplicados por ASIN, priorizando os mais novos da web)
    const finalResultsMap = new Map();
    dbMatched.forEach(item => finalResultsMap.set(item.asin, item));
    webMatched.forEach(item => finalResultsMap.set(item.asin, item));
    
    const finalResults = Array.from(finalResultsMap.values());

    // 4. Logar a pesquisa (Inteligência da plataforma)
    if (finalResults.length > 0) {
      const best = finalResults.reduce((min, p) => (p.main_price < (min?.main_price || Infinity) ? p : min), null);
      saveGuestSearch(term, userLabel || 'Guest', best?.asin, best?.title, best?.main_price, best?.store).catch(() => {});
    }

    res.json({ results: finalResults });
  } catch (err) {
    console.error(err);
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

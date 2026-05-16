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

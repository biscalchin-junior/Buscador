// Script de diagnóstico para entender por que os preços não estão sendo extraídos
const browserManager = require('./browser/browserManager');

(async () => {
    const url = 'https://www.amazon.com.br/Samsung-Galaxy-Watch8-Smartwatch-40mm/dp/B0FDX8YCRH';
    console.log('[DIAG] Abrindo página:', url);
    
    const page = await browserManager.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    
    // Esperar JS renderizar
    console.log('[DIAG] Aguardando renderização...');
    await page.waitForSelector('#productTitle', { timeout: 15000 }).catch(e => console.log('[DIAG] productTitle não encontrado'));
    await page.waitForSelector('.a-price', { timeout: 10000 }).catch(e => console.log('[DIAG] .a-price não encontrado'));
    
    // Esperar mais um pouco
    await new Promise(r => setTimeout(r, 3000));
    
    // 1. Verificar título
    try {
        const title = await page.$eval('#productTitle', el => el.textContent.trim());
        console.log('[DIAG] TÍTULO:', title);
    } catch (e) {
        console.log('[DIAG] TÍTULO: FALHOU -', e.message);
    }
    
    // 2. Verificar JSON-LD
    try {
        const jsonLds = await page.$$eval('script[type="application/ld+json"]', scripts => {
            return scripts.map(s => {
                try { return JSON.parse(s.textContent); }
                catch (e) { return null; }
            }).filter(Boolean);
        });
        console.log('[DIAG] JSON-LD encontrados:', jsonLds.length);
        for (const j of jsonLds) {
            console.log('[DIAG] JSON-LD tipo:', j['@type'] || 'N/A');
            if (j.offers) console.log('[DIAG] JSON-LD offers:', JSON.stringify(j.offers).substring(0, 200));
        }
    } catch (e) {
        console.log('[DIAG] JSON-LD: FALHOU -', e.message);
    }
    
    // 3. Verificar TODOS os .a-offscreen
    try {
        const offscreens = await page.$$eval('.a-offscreen', els => els.map(e => e.textContent.trim()).filter(t => t.includes('R$')));
        console.log('[DIAG] .a-offscreen com R$:', offscreens);
    } catch (e) {
        console.log('[DIAG] .a-offscreen: FALHOU -', e.message);
    }
    
    // 4. Verificar seletores específicos de preço
    const priceSelectors = [
        '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
        '#apex_desktop .a-price .a-offscreen',
        '#priceblock_ourprice',
        '#priceblock_dealprice',
        '.a-price.a-text-price.header-price .a-offscreen',
        '#corePrice_desktop .a-price .a-offscreen',
        '.a-price[data-a-color="price"] .a-offscreen',
        '#price_inside_buybox',
        '.a-price.apexPriceToPay .a-offscreen',
        '#newBuyBoxPrice .a-offscreen',
        '.a-price .a-offscreen'
    ];
    
    for (const sel of priceSelectors) {
        try {
            const text = await page.$eval(sel, el => el.textContent.trim());
            console.log(`[DIAG] ✅ ${sel} => "${text}"`);
        } catch (e) {
            console.log(`[DIAG] ❌ ${sel} => NÃO ENCONTRADO`);
        }
    }
    
    // 5. Verificar o HTML do corePriceDisplay
    try {
        const html = await page.$eval('#corePriceDisplay_desktop_feature_div', el => el.innerHTML.substring(0, 500));
        console.log('[DIAG] corePriceDisplay HTML:', html);
    } catch (e) {
        console.log('[DIAG] corePriceDisplay: NÃO EXISTE');
    }

    // 6. Check se está na versão mobile
    try {
        const mobilePrice = await page.$eval('#corePriceDisplay_mobile_feature_div .a-offscreen', el => el.textContent.trim());
        console.log('[DIAG] MOBILE PRICE:', mobilePrice);
    } catch (e) {
        console.log('[DIAG] Mobile price: não encontrado');
    }
    
    await page.close();
    await browserManager.close();
    console.log('[DIAG] Diagnóstico finalizado.');
    process.exit(0);
})();

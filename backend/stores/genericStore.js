const browserManager = require('../browser/browserManager');
const HumanBehavior = require('../utils/humanBehavior');
const AntiBotDetector = require('../validators/antiBotDetector');
const JsonLdExtractor = require('../extractors/jsonldExtractor');
const normalizePrice = require('../normalizers/normalizePrice');
const { delay } = require('../utils/delay');
const { emitLog } = require('../logger');

class GenericStore {
    constructor(name) {
        this.name = name;
    }

    /**
     * Fluxo principal de busca
     */
    async search(searchTerm, onResult) {
        const page = await browserManager.newPage();
        const results = [];
        
        try {
            const url = this.getSearchUrl(searchTerm);
            emitLog(`[${this.name}] Iniciando busca...`, 'info');
            
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
            await HumanBehavior.randomMouseMove(page);
            
            const check = await AntiBotDetector.check(page);
            if (check.isBlocked) return [];

            const productLinks = await this.extractProductLinks(page);
            emitLog(`[${this.name}] Encontrados ${productLinks.length} produtos na primeira página.`, 'info');

            // Limitar para não ser agressivo
            const linksToProcess = productLinks.slice(0, 10);
            // 1 página de busca + X páginas de detalhes
            results.pages_navigated = 1 + linksToProcess.length;

            for (const link of linksToProcess) {
                const detailResult = await this.processProductDetail(link.url);
                if (detailResult) {
                    const finalItem = {
                        ...detailResult,
                        store: this.name,
                        page_found: 1
                    };
                    results.push(finalItem);
                    if (onResult) await onResult(finalItem);
                }
                await delay(2000, 5000); // Pausa entre produtos
            }

        } catch (e) {
            emitLog(`[${this.name}] Erro na busca: ${e.message}`, 'error');
        } finally {
            await page.close();
        }

        return results;
    }

    /**
     * Processa a página de detalhes em uma NOVA ABA
     */
    async processProductDetail(url) {
        const page = await browserManager.newPage();
        try {
            emitLog(`[${this.name}] Abrindo detalhe...`, 'info');
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
            await HumanBehavior.gradualScroll(page);

            const check = await AntiBotDetector.check(page);
            if (check.isBlocked) return null;

            // 1. Tentar JSON-LD (Prioridade Máxima)
            const jsonData = await JsonLdExtractor.extract(page);
            if (jsonData && jsonData.price > 0) {
                emitLog(`[${this.name}] Dados extraídos via JSON-LD rapidamente.`, 'success');
                return {
                    asin: this.extractIdFromUrl(url),
                    title: jsonData.title,
                    url: url,
                    image_url: jsonData.image,
                    main_price: jsonData.price,
                    old_price: jsonData.price, // JSON-LD nem sempre tem old price
                    brand: jsonData.brand
                };
            }

            // 2. Fallback para Seletores CSS
            const selectors = this.getSelectors();
            const title = await this.trySelectors(page, selectors.title).catch(() => null);
            const priceText = await this.trySelectors(page, selectors.price).catch(() => null);
            const imageUrl = await this.tryImage(page).catch(() => null);
            
            if (title && priceText) {
                const mainPrice = normalizePrice(priceText);
                if (mainPrice > 0) {
                    return {
                        asin: this.extractIdFromUrl(url),
                        title: title.trim(),
                        url: url,
                        image_url: imageUrl,
                        main_price: mainPrice,
                        old_price: mainPrice
                    };
                }
            }

        } catch (e) {
            emitLog(`[${this.name}] Erro ao processar detalhe: ${e.message}`, 'error');
        } finally {
            await page.close();
        }
        return null;
    }

    async trySelectors(page, selectors) {
        for (const selector of selectors) {
            try {
                const val = await page.$eval(selector, el => el.textContent);
                if (val) return val;
            } catch (e) {}
        }
        throw new Error('Nenhum seletor encontrou dados');
    }

    async tryImage(page) {
        try {
            const val = await page.$eval('img[id*="landing"], img[id*="main"], .product-image img', el => el.getAttribute('src') || el.getAttribute('data-old-hires'));
            if (val) return val;
        } catch(e) {}
        return null;
    }

    // Métodos que devem ser sobrescritos pelas subclasses
    getSearchUrl(searchTerm) { throw new Error('Not implemented'); }
    async extractProductLinks(page) { throw new Error('Not implemented'); }
    getSelectors() { throw new Error('Not implemented'); }
    extractIdFromUrl(url) { 
        const crypto = require('crypto');
        return crypto.createHash('md5').update(url).digest('hex').substring(0, 10);
    }
}

module.exports = GenericStore;

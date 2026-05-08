const browserManager = require('../browser/browserManager');
const HumanBehavior = require('../utils/humanBehavior');
const AntiBotDetector = require('../validators/antiBotDetector');
const JsonLdExtractor = require('../extractors/jsonldExtractor');
const normalizePrice = require('../normalizers/normalizePrice');
const { delay } = require('../utils/delay');

class GenericStore {
    constructor(name) {
        this.name = name;
    }

    /**
     * Fluxo principal de busca
     */
    async search(searchTerm) {
        const page = await browserManager.newPage();
        const results = [];
        
        try {
            const url = this.getSearchUrl(searchTerm);
            console.log(`[${this.name}] Iniciando busca: ${url}`);
            
            await page.goto(url, { waitUntil: 'networkidle' });
            await HumanBehavior.randomMouseMove(page);
            
            const check = await AntiBotDetector.check(page);
            if (check.isBlocked) return [];

            const productLinks = await this.extractProductLinks(page);
            console.log(`[${this.name}] Encontrados ${productLinks.length} links de produtos.`);

            // Limitar para não ser agressivo
            const linksToProcess = productLinks.slice(0, 10);

            for (const link of linksToProcess) {
                const detailResult = await this.processProductDetail(link.url);
                if (detailResult) {
                    results.push({
                        ...detailResult,
                        store: this.name,
                        page_found: 1
                    });
                }
                await delay(2000, 5000); // Pausa entre produtos
            }

        } catch (e) {
            console.error(`[${this.name}] Erro na busca: ${e.message}`);
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
            console.log(`[${this.name}] Abrindo detalhe: ${url}`);
            await page.goto(url, { waitUntil: 'networkidle' });
            await HumanBehavior.gradualScroll(page);

            const check = await AntiBotDetector.check(page);
            if (check.isBlocked) return null;

            // 1. Tentar JSON-LD (Prioridade Máxima)
            const jsonData = await JsonLdExtractor.extract(page);
            if (jsonData && jsonData.price > 0) {
                console.log(`[${this.name}] Dados extraídos via JSON-LD`);
                return {
                    asin: this.extractIdFromUrl(url),
                    title: jsonData.title,
                    url: url,
                    main_price: jsonData.price,
                    old_price: jsonData.price, // JSON-LD nem sempre tem old price
                    brand: jsonData.brand
                };
            }

            // 2. Fallback para Seletores CSS
            const selectors = this.getSelectors();
            const title = await this.trySelectors(page, selectors.title).catch(() => null);
            const priceText = await this.trySelectors(page, selectors.price).catch(() => null);
            
            if (title && priceText) {
                const mainPrice = normalizePrice(priceText);
                if (mainPrice > 0) {
                    return {
                        asin: this.extractIdFromUrl(url),
                        title: title.trim(),
                        url: url,
                        main_price: mainPrice,
                        old_price: mainPrice
                    };
                }
            }

        } catch (e) {
            console.error(`[${this.name}] Erro ao processar detalhe (${url}): ${e.message}`);
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

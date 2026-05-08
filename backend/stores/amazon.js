const GenericStore = require('./genericStore');
const HumanBehavior = require('../utils/humanBehavior');

class AmazonStore extends GenericStore {
    constructor() {
        super('Amazon');
    }

    getSearchUrl(searchTerm) {
        return `https://www.amazon.com.br/s?k=${encodeURIComponent(searchTerm)}`;
    }

    async extractProductLinks(page) {
        await page.waitForSelector('div[data-asin]', { timeout: 15000 }).catch(() => {});
        
        return await page.$$eval('div[data-asin]', els => {
            return els.map(e => {
                const a = e.querySelector('h2 a') || e.querySelector('a.a-link-normal');
                if (!a) return null;
                const href = a.getAttribute('href');
                if (!href || (!href.includes('/dp/') && !href.includes('/gp/'))) return null;
                return {
                    url: href.startsWith('http') ? href : `https://www.amazon.com.br${href}`
                };
            }).filter(Boolean);
        });
    }

    getSelectors() {
        return {
            title: ['#productTitle', '.a-size-large.product-title-word-break'],
            price: [
                '.a-price .a-offscreen', 
                '#priceblock_ourprice', 
                '#corePriceDisplay_desktop_feature_div .a-price',
                '.a-color-price'
            ]
        };
    }

    extractIdFromUrl(url) {
        const match = url.match(/\/dp\/([A-Z0-9]{10})/);
        return match ? match[1] : super.extractIdFromUrl(url);
    }

    // Override para comportamento mais humano na Amazon
    async processProductDetail(url) {
        // Amazon detecta rapidamente automação, vamos adicionar delays extras
        const result = await super.processProductDetail(url);
        if (result) {
            // Adicionar campos específicos se necessário
        }
        return result;
    }
}

module.exports = new AmazonStore();

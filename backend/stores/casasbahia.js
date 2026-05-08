const GenericStore = require('./genericStore');

class CasasBahiaStore extends GenericStore {
    constructor() {
        super('Casas Bahia');
    }

    getSearchUrl(searchTerm) {
        return `https://www.casasbahia.com.br/${encodeURIComponent(searchTerm)}/b`;
    }

    async extractProductLinks(page) {
        // Casas Bahia usa links com /p/
        return await page.$$eval('a[href*="/p/"]', els => {
            return els.map(a => {
                return { url: a.href };
            }).filter(Boolean);
        });
    }

    getSelectors() {
        return {
            title: ['h1', '[data-testid="product-title"]'],
            price: ['[data-testid="product-price"]', '.product-price', '.price-sales']
        };
    }

    extractIdFromUrl(url) {
        const match = url.match(/\/p\/([a-zA-Z0-9]+)/);
        return match ? 'CB-' + match[1] : super.extractIdFromUrl(url);
    }
}

module.exports = new CasasBahiaStore();

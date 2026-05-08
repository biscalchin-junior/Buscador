const GenericStore = require('./genericStore');
const normalizePrice = require('../normalizers/normalizePrice');

class MercadoLivreStore extends GenericStore {
    constructor() {
        super('Mercado Livre');
    }

    async search(searchTerm) {
        console.log(`[Mercado Livre] Tentando API Oficial...`);
        try {
            const url = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(searchTerm)}&limit=20`;
            const res = await fetch(url);
            const data = await res.json();
            
            if (data.results && data.results.length > 0) {
                console.log(`[Mercado Livre] API retornou ${data.results.length} resultados.`);
                return data.results.map(item => ({
                    asin: 'MLB-' + item.id,
                    title: item.title,
                    url: item.permalink,
                    main_price: item.price,
                    old_price: item.original_price || item.price,
                    store: this.name,
                    page_found: 1
                }));
            }
        } catch (e) {
            console.error(`[Mercado Livre] Falha na API, tentando fallback browser: ${e.message}`);
        }

        // Se API falhar, usa o comportamento padrão de browser
        return super.search(searchTerm);
    }

    getSearchUrl(searchTerm) {
        return `https://lista.mercadolivre.com.br/${encodeURIComponent(searchTerm).replace(/%20/g, '-')}`;
    }

    async extractProductLinks(page) {
        return await page.$$eval('.ui-search-layout__item, .poly-card', els => {
            return els.map(e => {
                const a = e.querySelector('a.ui-search-link, a.poly-component__title');
                if (!a) return null;
                return { url: a.href };
            }).filter(Boolean);
        });
    }

    getSelectors() {
        return {
            title: ['h1.ui-pdp-title'],
            price: [
                '.ui-pdp-price__second-line .andes-money-amount__fraction',
                '[itemprop="price"]'
            ]
        };
    }

    extractIdFromUrl(url) {
        const match = url.match(/MLB-?(\d+)/);
        return match ? 'MLB-' + match[1] : super.extractIdFromUrl(url);
    }
}

module.exports = new MercadoLivreStore();

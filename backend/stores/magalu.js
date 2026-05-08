const GenericStore = require('./genericStore');
const HumanBehavior = require('../utils/humanBehavior');
const AntiBotDetector = require('../validators/antiBotDetector');

class MagaluStore extends GenericStore {
    constructor() {
        super('Magazine Luiza');
    }

    getSearchUrl(searchTerm) {
        return `https://www.magazineluiza.com.br/busca/${encodeURIComponent(searchTerm)}/`;
    }

    async search(searchTerm) {
        // Magalu detecta headless e automação agressiva.
        // Vamos tentar extrair o máximo da página de listagem para evitar abrir muitas abas.
        const page = await browserManager.newPage();
        const results = [];
        
        try {
            const url = this.getSearchUrl(searchTerm);
            console.log(`[Magalu] Iniciando busca (Otimizada): ${url}`);
            
            await page.goto(url, { waitUntil: 'networkidle' });
            await HumanBehavior.randomMouseMove(page);
            await HumanBehavior.gradualScroll(page);

            const check = await AntiBotDetector.check(page);
            if (check.isBlocked) return [];

            // Extrair direto da listagem para ser menos agressivo
            const products = await page.$$eval('a[data-testid="product-card"], [data-testid="product-item"]', (els) => {
                return els.map(e => {
                    const a = e.tagName === 'A' ? e : e.querySelector('a');
                    const titleEl = e.querySelector('h2, h3, [data-testid="product-title"]');
                    const priceEl = e.querySelector('[data-testid="price-value"]');
                    
                    if (!a || !titleEl || !priceEl) return null;
                    
                    return {
                        url: a.href,
                        title: titleEl.textContent.trim(),
                        priceText: priceEl.textContent.trim()
                    };
                }).filter(Boolean);
            });

            console.log(`[Magalu] Encontrados ${products.length} itens na listagem.`);

            for (const item of products.slice(0, 10)) {
                const mainPrice = normalizePrice(item.priceText);
                if (mainPrice > 0) {
                    results.push({
                        asin: this.extractIdFromUrl(item.url),
                        title: item.title,
                        url: item.url,
                        main_price: mainPrice,
                        old_price: mainPrice,
                        store: this.name,
                        page_found: 1
                    });
                }
            }
            
            // Se não encontrou nada na listagem, aí sim tenta detalhe (mas com parcimônia)
            if (results.length === 0) {
                console.log(`[Magalu] Nada extraído da listagem, tentando modo detalhado...`);
                // Implementação padrão do GenericStore
                return super.search(searchTerm);
            }

        } catch (e) {
            console.error(`[Magalu] Erro: ${e.message}`);
        } finally {
            await page.close();
        }

        return results;
    }

    getSelectors() {
        return {
            title: ['h1', '[data-testid="heading-product-title"]', '.header-product__title'],
            price: ['[data-testid="price-value"]', '.price-template__text', '[itemprop="price"]']
        };
    }

    extractIdFromUrl(url) {
        const match = url.match(/\/p\/([a-zA-Z0-9]+)\//);
        return match ? 'MGL-' + match[1] : super.extractIdFromUrl(url);
    }
}

const browserManager = require('../browser/browserManager');
const normalizePrice = require('../normalizers/normalizePrice');

module.exports = new MagaluStore();

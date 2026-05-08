class JsonLdExtractor {
    /**
     * Extrai dados de produtos de scripts JSON-LD
     * @param {import('playwright').Page} page 
     * @returns {Promise<any | null>}
     */
    static async extract(page) {
        try {
            const jsonLds = await page.$$eval('script[type="application/ld+json"]', scripts => {
                return scripts.map(s => {
                    try {
                        return JSON.parse(s.textContent);
                    } catch (e) {
                        return null;
                    }
                }).filter(Boolean);
            });

            for (const data of jsonLds) {
                // Pode ser um objeto direto ou um array de objetos
                const items = Array.isArray(data) ? data : [data];
                
                for (const item of items) {
                    if (item['@type'] === 'Product' || item['@type'] === 'http://schema.org/Product') {
                        return this.normalize(item);
                    }
                    // Às vezes está dentro de @graph
                    if (item['@graph'] && Array.isArray(item['@graph'])) {
                        const product = item['@graph'].find(g => g['@type'] === 'Product');
                        if (product) return this.normalize(product);
                    }
                }
            }
        } catch (e) {
            console.error(`[JsonLdExtractor] Erro ao extrair: ${e.message}`);
        }
        return null;
    }

    static normalize(product) {
        const offers = product.offers;
        let price = 0;
        let currency = 'BRL';

        if (offers) {
            if (Array.isArray(offers)) {
                price = offers[0].price;
                currency = offers[0].priceCurrency;
            } else {
                price = offers.price;
                currency = offers.priceCurrency;
            }
        }

        return {
            title: product.name,
            description: product.description,
            brand: typeof product.brand === 'string' ? product.brand : product.brand?.name,
            sku: product.sku || product.mpn,
            price: parseFloat(price),
            currency: currency || 'BRL',
            availability: offers?.availability || null,
            image: Array.isArray(product.image) ? product.image[0] : product.image
        };
    }
}

module.exports = JsonLdExtractor;

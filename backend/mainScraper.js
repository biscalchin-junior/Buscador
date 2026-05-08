const amazon = require('./stores/amazon');
const mercadolivre = require('./stores/mercadolivre');
const magalu = require('./stores/magalu');
const casasbahia = require('./stores/casasbahia');
const browserManager = require('./browser/browserManager');
const RelevancyValidator = require('./validators/relevancyValidator');
const { delay } = require('./utils/delay');

class MainScraper {
    constructor() {
        this.stores = [amazon, mercadolivre, magalu, casasbahia];
    }

    /**
     * Executa a busca em todas as lojas sequencialmente
     */
    async run(searchTerm) {
        let allResults = [];
        
        console.log(`[MainScraper] Iniciando busca global por: "${searchTerm}"`);
        
        for (const store of this.stores) {
            try {
                const storeResults = await store.search(searchTerm);
                
                // Validar relevância dos resultados antes de adicionar
                for (const item of storeResults) {
                    const validation = await RelevancyValidator.validate(item.title, searchTerm);
                    if (validation.isRelevant) {
                        allResults.push({
                            ...item,
                            relevancy_score: validation.score
                        });
                    } else {
                        console.log(`[MainScraper] Produto ignorado por irrelevância: ${item.title.substring(0, 50)}...`);
                    }
                }
                
                console.log(`[MainScraper] ${store.name} finalizado. Aguardando pausa de segurança...`);
                await delay(5000, 10000); // Pausa entre lojas
                
            } catch (e) {
                console.error(`[MainScraper] Erro ao processar loja ${store.name}: ${e.message}`);
            }
        }

        // Ordenar por preço
        allResults.sort((a, b) => a.main_price - b.main_price);

        return allResults;
    }

    /**
     * Fecha o navegador ao finalizar tudo
     */
    async finalize() {
        await browserManager.close();
    }
}

module.exports = new MainScraper();

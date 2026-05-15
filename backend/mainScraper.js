const amazon = require('./stores/amazon');
const browserManager = require('./browser/browserManager');
const RelevancyValidator = require('./validators/relevancyValidator');
const { delay } = require('./utils/delay');
const { getSetting } = require('./database');

class MainScraper {
    constructor() {
        this.stores = [amazon];
    }

    /**
     * Executa a busca em todas as lojas sequencialmente
     */
    async run(searchTerm) {
        let allResults = [];
        
        console.log(`[MainScraper] Iniciando busca global por: "${searchTerm}"`);
        
        // Buscar configuração de relevância
        const relevancySetting = await getSetting('relevancy_enabled');
        const isRelevancyEnabled = relevancySetting !== 'false'; // Padrão é true

        for (const store of this.stores) {
            try {
                const storeResults = await store.search(searchTerm);
                allResults.pages_navigated = (allResults.pages_navigated || 0) + (storeResults.pages_navigated || 0);
                
                for (const item of storeResults) {
                    if (isRelevancyEnabled) {
                        const validation = await RelevancyValidator.validate(item.title, searchTerm);
                        if (validation.isRelevant) {
                            allResults.push({
                                ...item,
                                relevancy_score: validation.score
                            });
                        } else {
                            console.log(`[MainScraper] Produto ignorado por irrelevância: ${item.title.substring(0, 50)}...`);
                        }
                    } else {
                        // Filtro desligado: traz tudo
                        allResults.push({
                            ...item,
                            relevancy_score: 1.0
                        });
                    }
                }
                
                console.log(`[MainScraper] ${store.name} finalizado. Aguardando pausa de segurança...`);
                await delay(5000, 10000); 
                
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

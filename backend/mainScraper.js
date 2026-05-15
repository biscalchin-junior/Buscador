const amazon = require('./stores/amazon');
const browserManager = require('./browser/browserManager');
const RelevancyValidator = require('./validators/relevancyValidator');
const { getSetting } = require('./database');
const { emitLog } = require('./logger');
const { delay } = require('./utils/delay');

class MainScraper {
    constructor() {
        this.stores = [amazon];
    }

    /**
     * Executa a busca em todas as lojas sequencialmente
     */
    async run(searchTerm, onResult) {
        let allResults = [];
        
        emitLog(`[MainScraper] Iniciando busca global por: "${searchTerm}"`, 'info');
        
        // Buscar configuração de relevância
        const relevancySetting = await getSetting('relevancy_enabled');
        const isRelevancyEnabled = relevancySetting !== 'false'; // Padrão é true

        for (const store of this.stores) {
            try {
                const storeResults = await store.search(searchTerm, async (item) => {
                    if (isRelevancyEnabled) {
                        const validation = await RelevancyValidator.validate(item.title, searchTerm);
                        if (validation.isRelevant) {
                            const resultItem = {
                                ...item,
                                relevancy_score: validation.score
                            };
                            allResults.push(resultItem);
                            if (onResult) await onResult(resultItem);
                        } else {
                            emitLog(`[MainScraper] Produto ignorado por irrelevância (não corresponde a "${searchTerm}")`, 'warn');
                        }
                    } else {
                        // Filtro desligado: traz tudo
                        const resultItem = {
                            ...item,
                            relevancy_score: 1.0
                        };
                        allResults.push(resultItem);
                        if (onResult) await onResult(resultItem);
                    }
                });
                // O array "storeResults" retornado apenas complementa o log de páginas navegadas
                allResults.pages_navigated = (allResults.pages_navigated || 0) + (storeResults.pages_navigated || 0);
                
                emitLog(`[MainScraper] ${store.name} finalizado. Aguardando pausa de segurança...`, 'info');
                await delay(5000, 10000); 
                
            } catch (e) {
                emitLog(`[MainScraper] Erro ao processar loja ${store.name}: ${e.message}`, 'error');
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

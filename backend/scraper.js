const mainScraper = require('./mainScraper');

/**
 * Funções mantidas para o processo de busca na Amazon.
 */

async function scrapeAmazon(searchTerm, onResult) {
    return await mainScraper.run(searchTerm, onResult);
}

async function scrapeAll(searchTerm, onResult) {
    return await mainScraper.run(searchTerm, onResult);
}

module.exports = {
    scrapeAmazon,
    scrapeAll,
    scrapeGenericStore: async (storeName, searchTerm) => [],
    STORE_CONFIGS: {}
};

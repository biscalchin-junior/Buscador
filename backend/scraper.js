const mainScraper = require('./mainScraper');

/**
 * Funções mantidas para o processo de busca na Amazon.
 */

async function scrapeAmazon(searchTerm) {
    return await mainScraper.run(searchTerm);
}

async function scrapeAll(searchTerm) {
    return await mainScraper.run(searchTerm);
}

module.exports = {
    scrapeAmazon,
    scrapeAll,
    scrapeGenericStore: async (storeName, searchTerm) => [],
    STORE_CONFIGS: {}
};

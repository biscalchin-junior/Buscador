const mainScraper = require('./mainScraper');

/**
 * Funções legadas mantidas para compatibilidade com server.js
 * Agora elas usam a nova arquitetura modular por baixo.
 */

async function scrapeAmazon(searchTerm) {
    const store = require('./stores/amazon');
    return await store.search(searchTerm);
}

async function scrapeMercadoLivre(searchTerm) {
    const store = require('./stores/mercadolivre');
    return await store.search(searchTerm);
}

async function scrapeMagazineLuiza(searchTerm) {
    const store = require('./stores/magalu');
    return await store.search(searchTerm);
}

async function scrapeCasasBahia(searchTerm) {
    const store = require('./stores/casasbahia');
    return await store.search(searchTerm);
}

async function scrapeAll(searchTerm) {
    return await mainScraper.run(searchTerm);
}

// Configurações de lojas genéricas para compatibilidade
const STORE_CONFIGS = {
    'KaBuM!': {},
    'Pichau': {},
    'Americanas': {},
    'Terabyte': {},
    'Ponto': {},
    'Extra': {},
    'Fast Shop': {},
    'Carrefour': {},
    'Havan': {},
    'Kalunga': {},
    'Girafa': {},
    'Fujioka': {},
    'iPlace': {}
};

module.exports = {
    scrapeAmazon,
    scrapeMercadoLivre,
    scrapeMagazineLuiza,
    scrapeCasasBahia,
    scrapeAll,
    scrapeGenericStore: async (storeName, searchTerm) => [],
    STORE_CONFIGS
};

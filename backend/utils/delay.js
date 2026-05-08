/**
 * Gera um delay aleatório entre min e max milissegundos
 * @param {number} min 
 * @param {number} max 
 * @returns {Promise<void>}
 */
const delay = (min = 1000, max = 3000) => {
    const ms = Math.floor(Math.random() * (max - min + 1) + min);
    return new Promise(resolve => setTimeout(resolve, ms));
};

module.exports = { delay };

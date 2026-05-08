/**
 * Normaliza strings de preço para float
 * @param {string|number} text 
 * @returns {number}
 */
const normalizePrice = (text) => {
    if (typeof text === 'number') return text;
    if (!text) return 0.0;
    
    // Remove símbolos de moeda e espaços
    let cleanText = text.replace(/[R$\s]/g, '').trim();
    
    // Trata formatos: 1.299,00 -> 1299.00 ou 1,299.00 -> 1299.00
    if (cleanText.includes(',') && cleanText.includes('.')) {
        // Se tem ambos, assume que o último é o decimal
        const lastComma = cleanText.lastIndexOf(',');
        const lastDot = cleanText.lastIndexOf('.');
        
        if (lastComma > lastDot) {
            // Formato BR: 1.299,00
            cleanText = cleanText.replace(/\./g, '').replace(',', '.');
        } else {
            // Formato US: 1,299.00
            cleanText = cleanText.replace(/,/g, '');
        }
    } else if (cleanText.includes(',')) {
        // Apenas vírgula: 1299,00 -> 1299.00
        cleanText = cleanText.replace(',', '.');
    }
    
    // Remove qualquer caractere que não seja número ou ponto
    cleanText = cleanText.replace(/[^\d.]/g, '');
    
    const val = parseFloat(cleanText);
    return isNaN(val) ? 0.0 : val;
};

module.exports = normalizePrice;

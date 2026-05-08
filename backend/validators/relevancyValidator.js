class RelevancyValidator {
    /**
     * Valida se um produto é relevante para o termo de busca
     * @param {string} title 
     * @param {string} searchTerm 
     * @returns {Promise<{isRelevant: boolean, score: number}>}
     */
    static async validate(title, searchTerm) {
        if (!title || !searchTerm) return { isRelevant: false, score: 0 };
        
        const titleLower = title.toLowerCase();
        const searchLower = searchTerm.toLowerCase();
        const searchWords = searchLower.split(/\s+/).filter(w => w.length > 2);
        
        let matches = 0;
        for (const word of searchWords) {
            if (titleLower.includes(word)) {
                matches++;
            }
        }

        const score = searchWords.length > 0 ? (matches / searchWords.length) : 0;
        
        // Bloqueio de termos negativos (acessórios comuns que poluem a busca)
        const negativeTerms = ['capa', 'pelicula', 'case', 'suporte', 'carregador', 'cabo', 'conector', 'reparo', 'peça'];
        const hasNegativeTerm = negativeTerms.some(term => titleLower.includes(term) && !searchLower.includes(term));

        // Se o termo de busca for específico (ex: "iPhone 15"), exigimos score alto
        const threshold = 0.6;
        const isRelevant = score >= threshold && !hasNegativeTerm;

        return { isRelevant, score };
    }
}

module.exports = RelevancyValidator;

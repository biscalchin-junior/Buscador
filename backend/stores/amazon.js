const GenericStore = require('./genericStore');
const browserManager = require('../browser/browserManager');
const HumanBehavior = require('../utils/humanBehavior');
const AntiBotDetector = require('../validators/antiBotDetector');
const normalizePrice = require('../normalizers/normalizePrice');
const { emitLog } = require('../logger');

class AmazonStore extends GenericStore {
    constructor() {
        super('Amazon');
    }

    getSearchUrl(searchTerm) {
        return `https://www.amazon.com.br/s?k=${encodeURIComponent(searchTerm)}`;
    }

    async extractProductLinks(page) {
        // Ignora divs onde o data-asin está vazio (propagandas genéricas e banners)
        await page.waitForSelector('div[data-asin]:not([data-asin=""])', { timeout: 15000 }).catch(() => {});
        
        return await page.$$eval('div[data-asin]:not([data-asin=""])', els => {
            return els.map(e => {
                const a = e.querySelector('h2 a') || e.querySelector('a.a-link-normal');
                if (!a) return null;
                const href = a.getAttribute('href');
                
                // Valida se é um link de produto válido (e não página de ajuda, etc)
                if (!href || href.includes('/help/') || href.includes('/customer/')) return null;
                if (!href.includes('/dp/') && !href.includes('/gp/') && !href.includes('/slredirect/')) return null;
                
                return {
                    url: href.startsWith('http') ? href : `https://www.amazon.com.br${href}`
                };
            }).filter(Boolean);
        });
    }

    extractIdFromUrl(url) {
        const match = url.match(/\/dp\/([A-Z0-9]{10})/);
        return match ? match[1] : super.extractIdFromUrl(url);
    }

    /**
     * Override COMPLETO — não usa JSON-LD para garantir extração de parcelamento e preço "De:"
     */
    async processProductDetail(url) {
        const page = await browserManager.newPage();
        try {
            emitLog(`[Amazon] Extraindo detalhes: ${url.length > 80 ? url.substring(0, 80) + '...' : url}`, 'info');
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
            
            // Aguardar preço renderizar (Amazon carrega via JS)
            await page.waitForSelector('#productTitle', { timeout: 10000 }).catch(() => {});
            await page.waitForSelector('.a-price .a-offscreen', { timeout: 8000 }).catch(() => {});
            await HumanBehavior.gradualScroll(page);

            const check = await AntiBotDetector.check(page);
            if (check.isBlocked) {
                emitLog(`[Amazon] Bloqueado por anti-bot: ${url.length > 50 ? url.substring(0, 50) + '...' : url}`, 'error');
                return null;
            }

            const logs = [];
            const addDebug = (m) => logs.push(`[${new Date().toLocaleTimeString()}] ${m}`);

            // ========== 1. TÍTULO ==========
            const title = await this.tryText(page, [
                '#productTitle',
                '.a-size-large.product-title-word-break'
            ]);
            if (!title) {
                addDebug("ERRO: Título não encontrado usando seletores padrão.");
                emitLog(`[Amazon] Título não encontrado para o link acessado.`, 'warn');
                return null;
            }
            addDebug(`Título encontrado: "${title.substring(0, 30)}..."`);
            
            // ========== 1.5 IMAGEM ==========
            let imageUrl = null;
            try {
                imageUrl = await page.$eval('#landingImage, #imgBlkFront, .a-dynamic-image', el => el.getAttribute('src') || el.getAttribute('data-old-hires'));
                addDebug(`Imagem capturada: ${imageUrl ? 'SIM' : 'NÃO'}`);
            } catch (e) {
                addDebug("AVISO: Falha ao capturar imagem.");
            }

            // ========== 2. PREÇO À VISTA (principal) ==========
            let mainPrice = null;
            try {
                const allPrices = await page.$$eval('.a-offscreen', els => 
                    els.map(e => e.textContent.trim()).filter(t => t && t.includes('R$') && !t.includes('De:'))
                );
                if (allPrices.length > 0) {
                    mainPrice = normalizePrice(allPrices[0]);
                    addDebug(`Preço Principal (offscreen): ${allPrices[0]} -> R$ ${mainPrice}`);
                    emitLog(`[Amazon] Preço encontrado: R$ ${mainPrice} (entre ${allPrices.length} opções na tela)`, 'data');
                }
            } catch (e) {}

            // Fallback: tentar seletores específicos
            if (!mainPrice || mainPrice <= 0) {
                addDebug("Tentando seletores de preço específicos (fallback)...");
                mainPrice = await this.tryPrice(page, [
                    '.a-price .a-offscreen',
                    '#priceblock_ourprice',
                    '#priceblock_dealprice'
                ]);
                if (mainPrice) addDebug(`Preço encontrado via fallback: R$ ${mainPrice}`);
            }

            if (!mainPrice || mainPrice <= 0) {
                addDebug("ERRO CRÍTICO: Nenhum preço válido encontrado na página.");
                emitLog(`[Amazon] Preço não encontrado para: ${title?.substring(0, 40)}`, 'warn');
                return { asin: this.extractIdFromUrl(url), error: true, logs: logs.join('\n') };
            }

            // ========== 3. PREÇO "DE:" (valor antigo / riscado) ==========
            let oldPrice = null;
            try {
                const rawOld = await page.$eval('#corePriceDisplay_desktop_feature_div .basisPrice .a-offscreen', el => el.textContent.trim());
                oldPrice = normalizePrice(rawOld);
                addDebug(`Preço "De:" encontrado (bloco core): ${rawOld} -> R$ ${oldPrice}`);
            } catch (e) { }
            
            if (!oldPrice) {
                try {
                    const dePrices = await page.$$eval('.a-offscreen', els => 
                        els.map(e => e.textContent.trim()).filter(t => t && t.startsWith('De:'))
                    );
                    if (dePrices.length > 0) addDebug(`Encontradas ${dePrices.length} menções de "De:"`);
                    for (const deText of dePrices) {
                        const candidate = normalizePrice(deText.replace('De:', ''));
                        if (candidate > mainPrice) {
                            oldPrice = candidate;
                            addDebug(`Candidato "De:" aceito: ${deText} -> R$ ${oldPrice}`);
                            break;
                        }
                    }
                } catch (e) {}
            }
            if (oldPrice) {
                emitLog(`[Amazon] Preço "De:" capturado: R$ ${oldPrice}`, 'data');
            } else {
                addDebug("Preço 'De:' não identificado (produto sem desconto ou tag oculta).");
            }

            // ========== 4. PARCELAMENTO ==========
            let installments_count = null;
            let installment_value = null;
            let installment_total = null;
            let interest_rate = 0;

            // Tentar capturar o texto de parcelamento de vários locais
            const installmentText = await this.tryText(page, [
                '#installmentCalculator_feature_div',
                '#best-offer-string-id',
                '.best-offer-name'
            ]);

            if (installmentText) {
                addDebug(`Texto de parcelamento capturado: "${installmentText}"`);
                const instMatch = installmentText.match(/(\d+)\s*x\s*(?:de\s+)?R\$\s*([\d.,]+)/i);
                if (instMatch) {
                    installments_count = parseInt(instMatch[1]);
                    installment_value = normalizePrice(instMatch[2]);
                    installment_total = parseFloat((installments_count * installment_value).toFixed(2));
                    
                    if (installment_total > mainPrice) {
                        interest_rate = parseFloat((((installment_total / mainPrice) - 1) * 100).toFixed(2));
                    }

                    addDebug(`Parcelamento parseado: ${installments_count}x de R$ ${installment_value} (Total: R$ ${installment_total})`);
                    emitLog(`[Amazon] Parcelamento: ${installments_count}x de R$ ${installment_value.toFixed(2)} = R$ ${installment_total.toFixed(2)} | Juros: ${interest_rate}%`, 'data');
                } else {
                    addDebug("AVISO: Texto de parcelamento encontrado mas não corresponde ao padrão esperado.");
                }
            }

            // ========== 5. DESCONTO REAL ==========
            let real_discount = 0;
            if (oldPrice && oldPrice > mainPrice) {
                real_discount = parseFloat((((oldPrice - mainPrice) / oldPrice) * 100).toFixed(1));
            }

            // ========== 6. VENDIDO POR ==========
            let mainSeller = 'Amazon';
            const sellerSelectors = [
                '#merchant-info .offer-display-feature-text-message',
                '#sellerProfileTriggerId',
                '#merchant-info a span',
                '#tabular-buybox .tabular-buybox-text[tabular-attribute-name="Vendido por"] span'
            ];
            const foundSeller = await this.tryText(page, sellerSelectors);
            if (foundSeller) {
                mainSeller = foundSeller;
                addDebug(`Vendedor encontrado: ${mainSeller}`);
            } else {
                addDebug(`Vendedor não encontrado explicitamente, usando padrão: ${mainSeller}`);
            }

            emitLog(`[Amazon] Resultado: ${title.trim().substring(0, 50)}... | À Vista: R$ ${mainPrice} | Vendido por: ${mainSeller}`, 'success');
            addDebug("Extração finalizada com sucesso.");

            return {
                asin: this.extractIdFromUrl(url),
                title: title.trim(),
                url: url,
                image_url: imageUrl,
                main_price: mainPrice,
                old_price: oldPrice || mainPrice,
                main_seller: mainSeller,
                amazon_discount: real_discount,
                real_discount: real_discount,
                installments_count: installments_count,
                installment_value: installment_value,
                installment_total: installment_total,
                interest_rate: interest_rate,
                store: 'Amazon',
                review_log: logs.join('\n')
            };

        } catch (e) {
            emitLog(`[Amazon] Erro na extração (${url.length > 50 ? url.substring(0, 50) + '...' : url}): ${e.message}`, 'error');
        } finally {
            await page.close();
        }
        return null;
    }

    /**
     * Tenta extrair texto de uma lista de seletores CSS
     */
    async tryText(page, selectors) {
        for (const sel of selectors) {
            try {
                const text = await page.$eval(sel, el => el.textContent.trim());
                if (text && text.length > 0) return text;
            } catch (e) {}
        }
        return null;
    }

    /**
     * Tenta extrair e normalizar preço de uma lista de seletores CSS
     */
    async tryPrice(page, selectors) {
        for (const sel of selectors) {
            try {
                const text = await page.$eval(sel, el => el.textContent.trim());
                if (text) {
                    const price = normalizePrice(text);
                    if (price > 0) return price;
                }
            } catch (e) {}
        }
        return null;
    }
}

module.exports = new AmazonStore();

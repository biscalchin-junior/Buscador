// Teste rápido do processProductDetail
const amazon = require('./stores/amazon');
const browserManager = require('./browser/browserManager');

(async () => {
    console.log('[TEST] Testando processProductDetail...');
    const result = await amazon.processProductDetail('https://www.amazon.com.br/Samsung-Galaxy-Watch8-Smartwatch-40mm/dp/B0FDX8YCRH');
    
    if (result) {
        console.log('[TEST] ✅ SUCESSO!');
        console.log('[TEST] Título:', result.title?.substring(0, 60));
        console.log('[TEST] Preço À Vista:', result.main_price);
        console.log('[TEST] Preço De:', result.old_price);
        console.log('[TEST] Parcelas:', result.installments_count, 'x R$', result.installment_value);
        console.log('[TEST] Total Parcelado:', result.installment_total);
        console.log('[TEST] Juros:', result.interest_rate, '%');
        console.log('[TEST] ASIN:', result.asin);
    } else {
        console.log('[TEST] ❌ FALHOU - retornou null');
    }
    
    await browserManager.close();
    process.exit(0);
})();

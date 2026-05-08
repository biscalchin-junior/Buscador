const { delay } = require('./delay');

/**
 * Simula movimentos humanos básicos no Playwright
 */
class HumanBehavior {
    /**
     * Scroll gradual na página
     * @param {import('playwright').Page} page 
     */
    static async gradualScroll(page) {
        const viewportHeight = await page.viewportSize()?.height || 800;
        const totalHeight = await page.evaluate(() => document.body.scrollHeight);
        let currentScroll = 0;

        while (currentScroll < totalHeight) {
            const step = Math.floor(Math.random() * 300) + 200;
            currentScroll += step;
            await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'smooth' }), currentScroll);
            await delay(300, 800);
            
            // Chance de parar um pouco
            if (Math.random() > 0.8) await delay(1000, 2000);
            
            // Recalcular altura pois pode carregar lazy loading
            const newTotalHeight = await page.evaluate(() => document.body.scrollHeight);
            if (newTotalHeight > totalHeight) break; // Deixa o loop continuar se crescer, ou ajusta
        }
    }

    /**
     * Move o mouse aleatoriamente
     * @param {import('playwright').Page} page 
     */
    static async randomMouseMove(page) {
        const width = await page.viewportSize()?.width || 1280;
        const height = await page.viewportSize()?.height || 720;
        
        for (let i = 0; i < 3; i++) {
            const x = Math.floor(Math.random() * width);
            const y = Math.floor(Math.random() * height);
            await page.mouse.move(x, y, { steps: 10 });
            await delay(200, 500);
        }
    }

    /**
     * Digitação humana com atraso entre teclas
     * @param {import('playwright').Page} page 
     * @param {string} selector 
     * @param {string} text 
     */
    static async humanType(page, selector, text) {
        await page.click(selector);
        for (const char of text) {
            await page.keyboard.type(char, { delay: Math.random() * 200 + 50 });
        }
    }
}

module.exports = HumanBehavior;

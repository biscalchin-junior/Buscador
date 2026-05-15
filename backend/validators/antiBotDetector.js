const path = require('path');
const fs = require('fs');

class AntiBotDetector {
    /**
     * Verifica se a página atual caiu em um bloqueio
     * @param {import('playwright').Page} page 
     * @returns {Promise<{isBlocked: boolean, reason: string | null}>}
     */
    static async check(page) {
        const content = (await page.content()).toLowerCase();
        const title = (await page.title()).toLowerCase();
        
        const markers = [
            { text: 'desculpe, só precisamos verificar se você não é um robô', reason: 'Amazon Robot Check (PT)' },
            { text: "sorry, we just need to make sure you're not a robot", reason: 'Amazon Robot Check (EN)' },
            { text: 'api-services-support@amazon.com', reason: 'Amazon API Support Block' },
            { text: 'verify you are human', reason: 'Human Verification Required' },
            { text: 'robot detected', reason: 'Robot Detected' },
            { text: 'ip/session blocked', reason: 'IP/Session Blocked' }
        ];

        for (const marker of markers) {
            const inContent = content.includes(marker.text);
            const inTitle = title.includes(marker.text);

            if (inContent || inTitle) {
                console.log(`[AntiBotDetector] Correspondência encontrada: "${marker.text}" em ${inContent ? 'Conteúdo' : ''} ${inTitle ? 'Título' : ''}`);
                await this.logBlock(page, marker.reason);
                return { isBlocked: true, reason: marker.reason };
            }
        }

        // Verificar status code se possível (embora content já ajude)
        // Nota: Playwright não expõe o status code facilmente após o goto se houver redirects.
        
        return { isBlocked: false, reason: null };
    }

    /**
     * Salva evidências do bloqueio
     */
    static async logBlock(page, reason) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const screenshotPath = path.join(__dirname, '..', 'screenshots', `block_${timestamp}.png`);
        const htmlPath = path.join(__dirname, '..', 'raw_html', `block_${timestamp}.html`);

        console.error(`[AntiBotDetector] BLOQUEIO DETECTADO: ${reason}`);

        try {
            await page.screenshot({ path: screenshotPath, fullPage: true });
            fs.writeFileSync(htmlPath, await page.content());
        } catch (e) {
            console.error(`[AntiBotDetector] Falha ao salvar evidências: ${e.message}`);
        }
    }
}

module.exports = AntiBotDetector;

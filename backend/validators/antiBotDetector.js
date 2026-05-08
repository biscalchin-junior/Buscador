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
            { text: 'captcha', reason: 'CAPTCHA Detected' },
            { text: 'verify you are human', reason: 'Human Verification Required' },
            { text: 'access denied', reason: 'Access Denied (403)' },
            { text: 'robot detected', reason: 'Robot Detected' },
            { text: 'blocked', reason: 'IP/Session Blocked' },
            { text: 'cloudflare', reason: 'Cloudflare Challenge' },
            { text: 'akamai', reason: 'Akamai Block' },
            { text: 'permissão negada', reason: 'Permission Denied' },
            { text: 'página não encontrada', reason: '404 or Blocked' }
        ];

        for (const marker of markers) {
            if (content.includes(marker.text) || title.includes(marker.text)) {
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

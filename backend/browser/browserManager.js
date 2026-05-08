const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const path = require('path');

chromium.use(stealth);

class BrowserManager {
    constructor() {
        this.context = null;
        // Caminho absoluto baseado na localização deste arquivo
        this.browserPath = path.join(__dirname, '..', 'browser_profile');
    }

    /**
     * Inicializa o navegador com contexto persistente
     */
    async initialize() {
        if (this.context) return this.context;

        console.log(`[BrowserManager] Iniciando contexto persistente em: ${this.browserPath}`);
        
        this.context = await chromium.launchPersistentContext(this.browserPath, {
            headless: false, // Sempre visível como pedido
            viewport: { width: 1920, height: 1080 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            args: [
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--window-size=1920,1080'
            ]
        });

        // Configurar timeouts globais
        this.context.setDefaultTimeout(60000);
        this.context.setDefaultNavigationTimeout(60000);

        return this.context;
    }

    /**
     * Cria uma nova página (aba)
     */
    async newPage() {
        const context = await this.initialize();
        const page = await context.newPage();
        
        // Bloquear recursos desnecessários para economizar banda/processamento (opcional, mas cuidado com anti-bot)
        // await page.route('**/*.{png,jpg,jpeg,gif,svg}', route => route.abort()); 
        
        return page;
    }

    /**
     * Fecha o contexto (apenas se necessário, ideal manter aberto)
     */
    async close() {
        if (this.context) {
            await this.context.close();
            this.context = null;
        }
    }
}

// Singleton para garantir um único contexto persistente
const instance = new BrowserManager();
module.exports = instance;

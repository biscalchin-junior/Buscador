const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const path = require('path');
const { getSetting } = require('../database');

chromium.use(stealth);

class BrowserManager {
    constructor() {
        this.context = null;
        this.browserPath = path.join(__dirname, '..', 'browser_profile');
        this.pagesCreated = 0;
        this.RESTART_THRESHOLD = 50; // Reiniciar contexto a cada 50 páginas
    }

    /**
     * Inicializa o navegador com contexto persistente
     */
    async initialize() {
        if (this.context && this.pagesCreated >= this.RESTART_THRESHOLD) {
            console.log('[BrowserManager] Threshold de memória atingido. Reiniciando navegador...');
            await this.close();
        }

        if (this.context) {
            try {
                await this.context.pages(); 
            } catch (e) {
                console.log('[BrowserManager] Contexto antigo fechado, reiniciando...');
                this.context = null;
            }
        }

        if (this.context) return this.context;

        const headlessSetting = await getSetting('is_headless');
        const isHeadless = headlessSetting !== 'false'; 

        console.log(`[BrowserManager] Iniciando contexto persistente (Headless: ${isHeadless})`);

        this.context = await chromium.launchPersistentContext(this.browserPath, {
            headless: isHeadless,
            viewport: { width: 1280, height: 720 }, // Viewport menor economiza memória
            args: [
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', // Importante para ambientes Docker/Linux
                '--disable-accelerated-2d-canvas',
                '--disable-gpu'
            ]
        });

        this.pagesCreated = 0; // Reset contador

        this.context.on('close', () => {
            this.context = null;
        });

        this.context.setDefaultTimeout(60000);
        return this.context;
    }

    /**
     * Cria uma nova página (aba) otimizada
     */
    async newPage() {
        const context = await this.initialize();
        const page = await context.newPage();
        this.pagesCreated++;

        // BLOQUEIO DE RECURSOS PESADOS (Economiza RAM e CPU)
        await page.route('**/*.{png,jpg,jpeg,gif,svg,css,woff,woff2,ttf,otf}', (route) => {
            const type = route.request().resourceType();
            // Mantemos apenas o necessário para o DOM renderizar o básico
            if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
                return route.abort();
            }
            route.continue();
        });

        return page;
    }

    /**
     * Fecha o contexto
     */
    async close() {
        if (this.context) {
            await this.context.close();
            this.context = null;
            this.pagesCreated = 0;
        }
    }
}

// Singleton para garantir um único contexto persistente
const instance = new BrowserManager();
module.exports = instance;

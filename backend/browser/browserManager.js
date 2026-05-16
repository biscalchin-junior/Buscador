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
        this.RESTART_THRESHOLD = 15; // Reiniciar com mais frequência para limpar RAM
        this.initializingPromise = null;
        this.idleTimer = null;
    }

    /**
     * Inicializa o navegador com trava de segurança (Promise Lock)
     */
    async initialize() {
        if (this.initializingPromise) return this.initializingPromise;

        this.initializingPromise = (async () => {
            try {
                // Reiniciar se atingir o limite
                if (this.context && this.pagesCreated >= this.RESTART_THRESHOLD) {
                    console.log('[BrowserManager] Limite de páginas atingido. Reiniciando para liberar RAM...');
                    await this.close();
                }

                // Verificar se contexto ainda está vivo
                if (this.context) {
                    try {
                        await this.context.pages();
                    } catch (e) {
                        this.context = null;
                    }
                }

                if (this.context) return this.context;

                const headlessSetting = await getSetting('is_headless');
                const isHeadless = headlessSetting !== 'false';

                console.log(`[BrowserManager] Lançando novo processo Chromium (Headless: ${isHeadless})`);

                this.context = await chromium.launchPersistentContext(this.browserPath, {
                    headless: isHeadless,
                    viewport: { width: 1280, height: 720 },
                    args: [
                        '--disable-blink-features=AutomationControlled',
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--disable-gpu',
                        '--js-flags="--max-old-space-size=512"' // Limita heap do JS interno do Chrome
                    ]
                });

                this.pagesCreated = 0;

                this.context.on('close', () => {
                    this.context = null;
                });

                return this.context;
            } finally {
                this.initializingPromise = null;
            }
        })();

        return this.initializingPromise;
    }

    /**
     * Fecha o navegador se ficar inativo por muito tempo
     */
    resetIdleTimer() {
        if (this.idleTimer) clearTimeout(this.idleTimer);
        this.idleTimer = setTimeout(async () => {
            const pages = this.context ? await this.context.pages() : [];
            if (pages.length === 0) {
                console.log('[BrowserManager] Inatividade detectada. Fechando navegador para economizar recursos.');
                await this.close();
            }
        }, 5 * 60 * 1000); // 5 minutos de inatividade
    }

    /**
     * Cria uma nova página otimizada
     */
    async newPage() {
        const context = await this.initialize();
        const page = await context.newPage();
        this.pagesCreated++;
        
        this.resetIdleTimer();

        // Interceptador global para economizar RAM/CPU
        await page.route('**/*', (route) => {
            const type = route.request().resourceType();
            if (['image', 'stylesheet', 'font', 'media', 'other'].includes(type)) {
                return route.abort();
            }
            route.continue();
        });

        return page;
    }

    /**
     * Fecha o contexto e limpa tudo
     */
    async close() {
        if (this.idleTimer) clearTimeout(this.idleTimer);
        if (this.context) {
            try {
                await this.context.close();
            } catch (e) {}
            this.context = null;
            this.pagesCreated = 0;
        }
    }
}

const instance = new BrowserManager();
module.exports = instance;

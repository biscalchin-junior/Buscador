const { initDb } = require('./database');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

async function fullReset() {
    console.log('[RESET] Iniciando limpeza total...');

    const dbPath = path.resolve(__dirname, 'auditor.db');
    const db = new sqlite3.Database(dbPath);

    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // 1. Limpar Tabelas
            db.run('DELETE FROM price_history');
            db.run('DELETE FROM products');
            db.run('DELETE FROM settings WHERE key NOT IN ("cron_schedule", "is_headless", "relevancy_enabled")');
            
            console.log('[RESET] Tabelas limpas.');

            // 2. Limpar Logs
            const logPath = path.join(__dirname, 'audit.log');
            if (fs.existsSync(logPath)) {
                fs.writeFileSync(logPath, '');
                console.log('[RESET] Logs limpos.');
            }

            // 3. Limpar Pastas Temporárias
            const folders = ['raw_html', 'screenshots'];
            folders.forEach(folder => {
                const folderPath = path.join(__dirname, folder);
                if (fs.existsSync(folderPath)) {
                    const files = fs.readdirSync(folderPath);
                    files.forEach(file => {
                        if (file !== '.gitkeep') {
                            try { fs.unlinkSync(path.join(folderPath, file)); } catch(e) {}
                        }
                    });
                    console.log(`[RESET] Pasta ${folder} limpa.`);
                }
            });

            db.close((err) => {
                if (err) reject(err);
                else {
                    console.log('[RESET] Sistema resetado com sucesso!');
                    resolve();
                }
            });
        });
    });
}

fullReset().catch(console.error);

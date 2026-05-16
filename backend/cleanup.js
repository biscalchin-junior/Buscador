const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'auditor.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('--- INICIANDO LIMPEZA TOTAL ---');
  db.run('DELETE FROM price_history');
  db.run('DELETE FROM user_products');
  db.run('DELETE FROM products');
  db.run('DELETE FROM guest_searches');
  console.log('✅ Tudo limpo.');
});
db.close();

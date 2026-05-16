const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'auditor.db');
const db = new sqlite3.Database(dbPath);

db.get('SELECT COUNT(*) as total FROM users', (err, row) => {
  if (err) console.error('Erro:', err.message);
  else console.log('TOTAL USUARIOS:', row.total);
  db.close();
});

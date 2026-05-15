const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'auditor.db');
const db = new sqlite3.Database(dbPath);

db.all('SELECT * FROM users', (err, rows) => {
  console.log(rows);
});

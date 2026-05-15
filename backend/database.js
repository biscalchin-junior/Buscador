const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'auditor.db');
const db = new sqlite3.Database(dbPath);

function initDb() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS products (
        asin TEXT PRIMARY KEY,
        title TEXT,
        url TEXT,
        category TEXT,
        is_active BOOLEAN DEFAULT 1,
        is_deleted BOOLEAN DEFAULT 0
      )
    `);

    // Alter table to add new columns if they don't exist (SQLite doesn't support IF NOT EXISTS in ALTER)
    db.run(`ALTER TABLE products ADD COLUMN category TEXT`, (err) => {});
    db.run(`ALTER TABLE products ADD COLUMN is_active BOOLEAN DEFAULT 1`, (err) => {});
    db.run(`ALTER TABLE products ADD COLUMN is_deleted BOOLEAN DEFAULT 0`, (err) => {});
    db.run(`ALTER TABLE products ADD COLUMN store TEXT DEFAULT 'Amazon'`, (err) => {});
    db.run(`ALTER TABLE products ADD COLUMN image_url TEXT`, (err) => {});

    db.run(`
      CREATE TABLE IF NOT EXISTS price_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asin TEXT,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        main_price REAL,
        old_price REAL,
        main_seller TEXT,
        other_sellers TEXT, -- JSON string
        amazon_discount REAL,
        real_discount REAL,
        variation TEXT, -- 'UP', 'DOWN', 'SAME'
        page_found INTEGER DEFAULT 1,
        product_variations TEXT, -- JSON string (Cor, Tamanho, etc)
        FOREIGN KEY (asin) REFERENCES products (asin)
      )
    `);
    db.run(`ALTER TABLE price_history ADD COLUMN page_found INTEGER DEFAULT 1`, (err) => {});
    db.run(`ALTER TABLE price_history ADD COLUMN product_variations TEXT`, (err) => {});
    db.run(`ALTER TABLE price_history ADD COLUMN installments_count INTEGER`, (err) => {});
    db.run(`ALTER TABLE price_history ADD COLUMN installment_value REAL`, (err) => {});
    db.run(`ALTER TABLE price_history ADD COLUMN installment_total REAL`, (err) => {});
    db.run(`ALTER TABLE price_history ADD COLUMN interest_rate REAL`, (err) => {});

    db.run(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);
    
    // Default cron schedule (ex: todo dia as 00:00)
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('cron_schedule', '0 0 * * *')`);
  });
}

function saveProduct(asin, title, url, category = 'Geral', store = 'Amazon', image_url = null) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO products (asin, title, url, category, is_active, is_deleted, store, image_url) 
       VALUES (?, ?, ?, ?, 1, 0, ?, ?)
       ON CONFLICT(asin) DO UPDATE SET title=excluded.title, is_deleted=0, image_url=COALESCE(excluded.image_url, products.image_url)`,
      [asin, title, url, category, store, image_url],
      function (err) {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function saveHistory(historyData) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT main_price FROM price_history WHERE asin = ? ORDER BY date DESC LIMIT 1`,
      [historyData.asin],
      (err, row) => {
        if (err) return reject(err);

        let variation = 'SAME';
        if (row) {
          if (historyData.main_price > row.main_price) {
            variation = 'UP';
          } else if (historyData.main_price < row.main_price) {
            variation = 'DOWN';
          }
        }

        const localDate = new Date().toLocaleString('sv-SE').replace(' ', 'T');
        db.run(
          `INSERT INTO price_history 
          (asin, date, main_price, old_price, main_seller, other_sellers, amazon_discount, real_discount, variation, page_found, product_variations, installments_count, installment_value, installment_total, interest_rate) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            historyData.asin,
            localDate,
            historyData.main_price,
            historyData.old_price,
            historyData.main_seller,
            JSON.stringify(historyData.other_sellers || []),
            historyData.amazon_discount,
            historyData.real_discount,
            variation,
            historyData.page_found || 1,
            JSON.stringify(historyData.product_variations || {}),
            historyData.installments_count || null,
            historyData.installment_value || null,
            historyData.installment_total || null,
            historyData.interest_rate || 0
          ],
          function (err2) {
            if (err2) reject(err2);
            else resolve(this.lastID);
          }
        );
      }
    );
  });
}

function getHistory(includeDeleted = false) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT p.title, p.url, p.category, p.image_url, p.is_active, p.is_deleted, p.store, h.* 
       FROM products p 
       JOIN price_history h ON p.asin = h.asin 
       WHERE p.is_deleted = ?
       ORDER BY h.date DESC`,
      [includeDeleted ? 1 : 0],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

function updateProductStatus(asin, isActive) {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE products SET is_active = ? WHERE asin = ?`, [isActive ? 1 : 0, asin], err => err ? reject(err) : resolve());
  });
}

function trashProduct(asin, isDeleted) {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE products SET is_deleted = ? WHERE asin = ?`, [isDeleted ? 1 : 0, asin], err => err ? reject(err) : resolve());
  });
}

function getSetting(key) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT value FROM settings WHERE key = ?`, [key], (err, row) => err ? reject(err) : resolve(row ? row.value : null));
  });
}

function saveSetting(key, value) {
  return new Promise((resolve, reject) => {
    db.run(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, [key, value], err => err ? reject(err) : resolve());
  });
}

function getActiveProducts() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT url FROM products WHERE is_active = 1 AND is_deleted = 0`, (err, rows) => err ? reject(err) : resolve(rows));
  });
}

function trashAllProducts() {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE products SET is_deleted = 1 WHERE is_deleted = 0`, err => err ? reject(err) : resolve());
  });
}

function deleteAllTrash() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`DELETE FROM price_history WHERE asin IN (SELECT asin FROM products WHERE is_deleted = 1)`, err => { if (err) return reject(err); });
      db.run(`DELETE FROM products WHERE is_deleted = 1`, err => err ? reject(err) : resolve());
    });
  });
}

module.exports = {
  initDb, saveProduct, saveHistory, getHistory, updateProductStatus, trashProduct, 
  getSetting, saveSetting, getActiveProducts, trashAllProducts, deleteAllTrash
};

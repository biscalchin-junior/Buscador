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
        is_deleted BOOLEAN DEFAULT 0,
        store TEXT DEFAULT 'Amazon',
        image_url TEXT,
        search_count INTEGER DEFAULT 0,
        relevance_score REAL DEFAULT 0,
        canonical_id TEXT,
        last_checked DATETIME,
        check_interval_minutes INTEGER DEFAULT 360,
        feedback_status TEXT,
        review_log TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS price_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asin TEXT,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        main_price REAL,
        old_price REAL,
        main_seller TEXT,
        other_sellers TEXT,
        amazon_discount REAL,
        real_discount REAL,
        variation TEXT,
        page_found INTEGER DEFAULT 1,
        product_variations TEXT,
        installments_count INTEGER,
        installment_value REAL,
        installment_total REAL,
        interest_rate REAL,
        FOREIGN KEY (asin) REFERENCES products (asin)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);
    
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('cron_schedule', '0 0 * * *')`);
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('trash_retention_days', '60')`);

    db.run(`
      CREATE TABLE IF NOT EXISTS user_products (
        user_email TEXT,
        asin TEXT,
        is_active BOOLEAN DEFAULT 1,
        is_deleted BOOLEAN DEFAULT 0,
        deleted_at DATETIME,
        PRIMARY KEY(user_email, asin)
      )
    `);
  });
}

function saveProduct(asin, title, url, category = 'Geral', store = 'Amazon', image_url = null) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO products (asin, title, url, category, is_active, is_deleted, store, image_url, search_count, last_checked) 
       VALUES (?, ?, ?, ?, 1, 0, ?, ?, 1, CURRENT_TIMESTAMP)
       ON CONFLICT(asin) DO UPDATE SET 
         title=excluded.title, 
         is_deleted=0, 
         image_url=COALESCE(excluded.image_url, products.image_url),
         search_count=products.search_count + 1,
         last_checked=CURRENT_TIMESTAMP`,
      [asin, title, url, category, store, image_url],
      function(err) { if (err) reject(err); else resolve(); }
    );
  });
}

function saveHistory(historyData) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT main_price, date FROM price_history WHERE asin = ? ORDER BY date DESC LIMIT 1`,
      [historyData.asin],
      (err, row) => {
        if (err) return reject(err);

        let variation = 'SAME';
        if (row) {
          if (historyData.main_price > row.main_price) variation = 'UP';
          else if (historyData.main_price < row.main_price) variation = 'DOWN';
        }

        const localDate = new Date().toLocaleString('sv-SE').replace(' ', 'T');
        db.run(
          `INSERT INTO price_history 
          (asin, date, main_price, old_price, main_seller, other_sellers, amazon_discount, real_discount, variation, installments_count, installment_value, installment_total) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            historyData.asin, localDate, historyData.main_price, historyData.old_price,
            historyData.main_seller, JSON.stringify(historyData.other_sellers || []),
            historyData.amazon_discount, historyData.real_discount, variation,
            historyData.installments_count, historyData.installment_value, historyData.installment_total
          ],
          err2 => err2 ? reject(err2) : resolve()
        );
      }
    );
  });
}

function getHistory(includeDeleted = false, userRole = 'SUPERADMIN', userEmail = null) {
  return new Promise((resolve, reject) => {
    let query, params;
    if (userRole === 'SUPERADMIN') {
      query = `SELECT p.*, h.* FROM products p LEFT JOIN price_history h ON p.asin = h.asin WHERE p.is_deleted = ? ORDER BY COALESCE(h.date, '1970-01-01') DESC`;
      params = [includeDeleted ? 1 : 0];
    } else if (userEmail) {
      query = `SELECT p.*, h.* FROM products p JOIN user_products up ON p.asin = up.asin AND up.user_email = ? LEFT JOIN price_history h ON p.asin = h.asin WHERE up.is_deleted = ? ORDER BY COALESCE(h.date, '1970-01-01') DESC`;
      params = [userEmail, includeDeleted ? 1 : 0];
    } else {
      query = `SELECT p.*, h.* FROM products p LEFT JOIN price_history h ON p.asin = h.asin WHERE p.is_deleted = ? ORDER BY COALESCE(h.date, '1970-01-01') DESC`;
      params = [includeDeleted ? 1 : 0];
    }
    db.all(query, params, (err, rows) => err ? reject(err) : resolve(rows));
  });
}

function linkProductToUser(userEmail, asin) {
  return new Promise((resolve, reject) => {
    db.run(`INSERT OR IGNORE INTO user_products (user_email, asin) VALUES (?, ?)`, [userEmail, asin], err => err ? reject(err) : resolve());
  });
}

function updateProductStatus(asin, isActive) {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE products SET is_active = ? WHERE asin = ?`, [isActive ? 1 : 0, asin], err => err ? reject(err) : resolve());
  });
}

function trashProduct(asin, isDeleted, email = null) {
  return new Promise((resolve, reject) => {
    if (email) {
      db.run(`UPDATE user_products SET is_deleted = ?, deleted_at = ? WHERE user_email = ? AND asin = ?`, [isDeleted ? 1 : 0, isDeleted ? new Date().toISOString() : null, email, asin], err => err ? reject(err) : resolve());
    } else {
      db.run(`UPDATE products SET is_deleted = ? WHERE asin = ?`, [isDeleted ? 1 : 0, asin], err => err ? reject(err) : resolve());
    }
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
    db.all(`SELECT * FROM products WHERE is_active = 1 AND is_deleted = 0`, (err, rows) => err ? reject(err) : resolve(rows));
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
      db.run(`DELETE FROM price_history WHERE asin IN (SELECT asin FROM products WHERE is_deleted = 1)`);
      db.run(`DELETE FROM products WHERE is_deleted = 1`, err => err ? reject(err) : resolve());
    });
  });
}

function updateProductFeedback(asin, status) {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE products SET feedback_status = ? WHERE asin = ?`, [status, asin], err => err ? reject(err) : resolve());
  });
}

function getFlaggedProducts() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT p.*, h.main_price FROM products p LEFT JOIN price_history h ON p.asin = h.asin WHERE p.feedback_status = 'error' GROUP BY p.asin`, (err, rows) => err ? reject(err) : resolve(rows));
  });
}

function getAdminStats() {
  return new Promise((resolve, reject) => {
    const stats = {};
    db.get(`SELECT COUNT(*) as total FROM products WHERE is_deleted = 0`, (err, row) => {
      stats.totalProducts = row ? row.total : 0;
      db.get(`SELECT COUNT(*) as total FROM users`, (err, row) => {
        stats.totalUsers = row ? row.total : 0;
        resolve(stats);
      });
    });
  });
}

function cleanupTrash() {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM user_products WHERE is_deleted = 1`, err => err ? reject(err) : resolve());
  });
}

function getPublicStats() {
  return new Promise((resolve, reject) => {
    db.get(`SELECT COUNT(*) as total FROM products WHERE is_deleted = 0`, (err, row) => err ? reject(err) : resolve({ totalProducts: row ? row.total : 0 }));
  });
}

function getTopSearchedProducts() {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT p.*, h.main_price, h.old_price, h.date, h.main_seller
      FROM products p
      LEFT JOIN (
        SELECT asin, MAX(date) as max_date FROM price_history GROUP BY asin
      ) latest ON p.asin = latest.asin
      LEFT JOIN price_history h ON p.asin = h.asin AND h.date = latest.max_date
      WHERE p.is_deleted = 0
      ORDER BY p.search_count DESC
      LIMIT 20
    `;
    db.all(query, [], (err, rows) => err ? reject(err) : resolve(rows));
  });
}

module.exports = {
  initDb, saveProduct, saveHistory, getHistory, linkProductToUser, updateProductStatus, trashProduct, 
  getSetting, saveSetting, getActiveProducts, trashAllProducts, deleteAllTrash,
  updateProductFeedback, getFlaggedProducts, getAdminStats, cleanupTrash, getPublicStats, getTopSearchedProducts
};

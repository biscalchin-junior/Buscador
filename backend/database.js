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
        check_interval_minutes INTEGER DEFAULT 360
      )
    `);

    // Alter table to add new columns if they don't exist (SQLite doesn't support IF NOT EXISTS in ALTER)
    db.run(`ALTER TABLE products ADD COLUMN category TEXT`, () => {});
    db.run(`ALTER TABLE products ADD COLUMN is_active BOOLEAN DEFAULT 1`, () => {});
    db.run(`ALTER TABLE products ADD COLUMN is_deleted BOOLEAN DEFAULT 0`, () => {});
    db.run(`ALTER TABLE products ADD COLUMN store TEXT DEFAULT 'Amazon'`, () => {});
    db.run(`ALTER TABLE products ADD COLUMN image_url TEXT`, () => {});
    // Intelligence columns (future AI-ready)
    db.run(`ALTER TABLE products ADD COLUMN search_count INTEGER DEFAULT 0`, () => {});
    db.run(`ALTER TABLE products ADD COLUMN relevance_score REAL DEFAULT 0`, () => {});
    db.run(`ALTER TABLE products ADD COLUMN canonical_id TEXT`, () => {});
    db.run(`ALTER TABLE products ADD COLUMN last_checked DATETIME`, () => {});
    db.run(`ALTER TABLE products ADD COLUMN check_interval_minutes INTEGER DEFAULT 360`, () => {});
    db.run(`ALTER TABLE products ADD COLUMN feedback_status TEXT`, () => {});
    db.run(`ALTER TABLE products ADD COLUMN review_log TEXT`, () => {});

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
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('trash_retention_days', '60')`);
    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('trash_retention_days', '60')`);
    
    // Mapping table: Which user tracks which product
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
    db.run(`ALTER TABLE user_products ADD COLUMN deleted_at DATETIME`, () => {});
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
         last_checked=CURRENT_TIMESTAMP,
         check_interval_minutes=CASE 
           WHEN products.search_count + 1 > 50 THEN 30
           WHEN products.search_count + 1 > 10 THEN 120
           ELSE 360
         END,
         relevance_score=ROUND(
           (products.search_count + 1) * 1.0 +
           CASE WHEN products.last_checked > datetime('now', '-1 hour') THEN 5 ELSE 0 END,
           2
         )`,
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
          const lastPrice = row.main_price;
          const lastDate = new Date(row.date);
          const now = new Date();
          const hoursSinceLast = (now - lastDate) / (1000 * 60 * 60);

          // Se o preço for o mesmo E a última captura foi há menos de 12 horas, não salva redundante
          if (historyData.main_price === lastPrice && hoursSinceLast < 12) {
            console.log(`[DB] Preço idêntico para ${historyData.asin} em menos de 12h. Pulando registro histórico.`);
            return resolve(null);
          }

          if (historyData.main_price > lastPrice) variation = 'UP';
          else if (historyData.main_price < lastPrice) variation = 'DOWN';
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

function getHistory(includeDeleted = false, userRole = 'SUPERADMIN', userEmail = null) {
  return new Promise((resolve, reject) => {
    let query, params;
    
    if (userEmail) {
      // Isolamento total: Só vê o que VOCÊ adicionou
      query = `SELECT p.title, p.url, p.category, p.image_url, p.is_active, p.store, h.*, up.is_deleted
               FROM products p 
               JOIN price_history h ON p.asin = h.asin 
               JOIN user_products up ON p.asin = up.asin AND up.user_email = ?
               WHERE up.is_deleted = ? 
               ORDER BY h.date DESC`;
      params = [userEmail, includeDeleted ? 1 : 0];
    } else {
      // Visão global (ex: busca pública ou admin sem filtro)
      query = `SELECT p.title, p.url, p.category, p.image_url, p.is_active, p.store, h.*, p.is_deleted
               FROM products p 
               JOIN price_history h ON p.asin = h.asin 
               WHERE p.is_deleted = ? 
               ORDER BY h.date DESC`;
      params = [includeDeleted ? 1 : 0];
    }

    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function linkProductToUser(userEmail, asin) {
  return new Promise((resolve, reject) => {
    if (!userEmail || !asin) return resolve();
    db.run(
      `INSERT OR IGNORE INTO user_products (user_email, asin) VALUES (?, ?)`,
      [userEmail, asin],
      err => err ? reject(err) : resolve()
    );
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
      db.run(
        `UPDATE user_products SET is_deleted = ?, deleted_at = ? WHERE user_email = ? AND asin = ?`, 
        [isDeleted ? 1 : 0, isDeleted ? new Date().toISOString() : null, email, asin], 
        err => err ? reject(err) : resolve()
      );
    } else {
      db.run(`UPDATE products SET is_deleted = ? WHERE asin = ?`, [isDeleted ? 1 : 0, asin], err => err ? reject(err) : resolve());
    }
  });
}

function cleanupTrash() {
  return new Promise((resolve, reject) => {
    db.get(`SELECT value FROM settings WHERE key = 'trash_retention_days'`, (err, row) => {
      if (err) return reject(err);
      const days = parseInt(row?.value) || 60;
      db.run(`DELETE FROM user_products WHERE is_deleted = 1 AND deleted_at < datetime('now', '-' || ? || ' days')`, [days], err => err ? reject(err) : resolve());
    });
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
      db.run(`DELETE FROM price_history WHERE asin IN (SELECT asin FROM products WHERE is_deleted = 1)`, err => { if (err) return reject(err); });
      db.run(`DELETE FROM products WHERE is_deleted = 1`, err => err ? reject(err) : resolve());
    });
  });
}

function updateProductFeedback(asin, status, reviewLog = null) {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE products SET feedback_status = ?, review_log = ? WHERE asin = ?`, [status, reviewLog, asin], err => err ? reject(err) : resolve());
  });
}

function getFlaggedProducts() {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT p.*, h.main_price, h.old_price, h.date as history_date
      FROM products p
      LEFT JOIN price_history h ON h.asin = p.asin
      WHERE p.feedback_status = 'error'
      GROUP BY p.asin
      HAVING h.date = MAX(h.date) OR h.date IS NULL
      ORDER BY p.last_checked DESC
    `;
    db.all(query, [], (err, rows) => err ? reject(err) : resolve(rows));
  });
}

function getAdminStats() {
  return new Promise((resolve, reject) => {
    const stats = {};
    db.get(`SELECT COUNT(*) as total FROM products WHERE is_deleted = 0`, (err, row) => {
      if (err) { console.error('[DB] Error totalProducts:', err); return reject(err); }
      stats.totalProducts = row ? row.total : 0;
      
      db.get(`SELECT COUNT(*) as total FROM products WHERE feedback_status = 'error'`, (err, row) => {
        if (err) { console.error('[DB] Error totalErrors:', err); return reject(err); }
        stats.totalErrors = row ? row.total : 0;
        
        db.get(`SELECT COUNT(*) as total FROM users`, (err, row) => {
          if (err) { console.error('[DB] Error totalUsers:', err); return reject(err); }
          stats.totalUsers = row ? row.total : 0;
          
          db.get(`SELECT COUNT(*) as total FROM user_products WHERE is_deleted = 1`, (err, row) => {
            if (err) { console.error('[DB] Error totalTrash:', err); return reject(err); }
            stats.totalTrash = row ? row.total : 0;

            const topQuery = `
              SELECT 
                p.asin, p.title, p.store, 
                curr.main_price as current_price,
                prev.main_price as last_price,
                ((prev.main_price - curr.main_price) / prev.main_price * 100) as diff_percent
              FROM products p
              JOIN (
                SELECT asin, main_price, id 
                FROM price_history 
                WHERE id IN (SELECT MAX(id) FROM price_history GROUP BY asin)
              ) curr ON p.asin = curr.asin
              JOIN (
                SELECT h1.asin, h1.main_price
                FROM price_history h1
                WHERE h1.id = (
                  SELECT MAX(h2.id) 
                  FROM price_history h2 
                  WHERE h2.asin = h1.asin AND h2.id < (SELECT MAX(h3.id) FROM price_history h3 WHERE h3.asin = h1.asin)
                )
              ) prev ON p.asin = prev.asin
              WHERE p.is_deleted = 0 AND curr.main_price < prev.main_price
              ORDER BY diff_percent DESC
              LIMIT 100
            `;
            db.all(topQuery, (err, rows) => {
              if (err) { console.error('[DB] Error topDiscounts:', err); return reject(err); }
              stats.topDiscounts = rows || [];
              resolve(stats);
            });
          });
        });
      });
    });
  });
}

module.exports = {
  initDb, saveProduct, saveHistory, getHistory, linkProductToUser, updateProductStatus, trashProduct, 
  getSetting, saveSetting, getActiveProducts, trashAllProducts, deleteAllTrash,
  updateProductFeedback, getFlaggedProducts, getAdminStats, cleanupTrash
};

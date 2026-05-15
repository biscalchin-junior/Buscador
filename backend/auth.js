const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const JWT_SECRET = process.env.JWT_SECRET || 'buscador_jwt_secret_2026_change_in_prod';
const SUPERADMIN_EMAIL = 'superadmin';
const SUPERADMIN_PASSWORD = '10071961Jr@';

const dbPath = path.resolve(__dirname, 'auditor.db');
const db = new sqlite3.Database(dbPath);

// ── Tabelas de auth ──────────────────────────────────────────────
function initAuthDb() {
  db.serialize(() => {
    // Tabela de usuários completa
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        role TEXT DEFAULT 'USER',
        birth_date TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT 1
      )
    `);

    // Tabela de pesquisas públicas (guests + logados)
    db.run(`
      CREATE TABLE IF NOT EXISTS guest_searches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        term TEXT,
        user_label TEXT DEFAULT 'Guest User',
        user_id INTEGER DEFAULT NULL,
        item_title TEXT,
        item_asin TEXT,
        item_price REAL,
        item_store TEXT,
        searched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        search_count INTEGER DEFAULT 1
      )
    `);

    // Seed: superadmin (executado na inicialização, apenas se não existir)
    db.get(`SELECT id FROM users WHERE email = ?`, [SUPERADMIN_EMAIL], async (err, row) => {
      if (!row) {
        const hash = await bcrypt.hash(SUPERADMIN_PASSWORD, 12);
        db.run(
          `INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'SUPERADMIN')`,
          [SUPERADMIN_EMAIL, hash],
          (e) => { if (!e) console.log('[Auth] ✅ Superadmin criado com sucesso.'); }
        );
      }
    });
  });
}

// ── Helpers ──────────────────────────────────────────────────────
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// ── Middleware de autenticação ────────────────────────────────────
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido.' });
  }
  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: 'Token inválido ou expirado.' });
  req.user = decoded;
  next();
}

function superadminMiddleware(req, res, next) {
  authMiddleware(req, res, () => {
    if (req.user.role !== 'SUPERADMIN') return res.status(403).json({ error: 'Acesso negado.' });
    next();
  });
}

// ── DB helpers ───────────────────────────────────────────────────
function findUserByEmail(email) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, row) => err ? reject(err) : resolve(row));
  });
}

function createUser(email, passwordHash, birthDate) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO users (email, password_hash, role, birth_date) VALUES (?, ?, 'USER', ?)`,
      [email, passwordHash, birthDate],
      function(err) { err ? reject(err) : resolve({ id: this.lastID, email, role: 'USER' }); }
    );
  });
}

function saveGuestSearch({ term, userLabel = 'Guest User', userId = null, itemTitle, itemAsin, itemPrice, itemStore }) {
  return new Promise((resolve, reject) => {
    // Se já existe busca com mesmo termo hoje, incrementa contador
    db.get(
      `SELECT id, search_count FROM guest_searches WHERE term = ? AND date(searched_at) = date('now') AND user_label = ?`,
      [term, userLabel],
      (err, row) => {
        if (row) {
          db.run(`UPDATE guest_searches SET search_count = search_count + 1, item_price = ?, searched_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [itemPrice, row.id], (e) => e ? reject(e) : resolve());
        } else {
          db.run(
            `INSERT INTO guest_searches (term, user_label, user_id, item_title, item_asin, item_price, item_store) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [term, userLabel, userId, itemTitle, itemAsin, itemPrice, itemStore],
            (e) => e ? reject(e) : resolve()
          );
        }
      }
    );
  });
}

function getGuestSearches() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM guest_searches ORDER BY searched_at DESC LIMIT 200`, (err, rows) => err ? reject(err) : resolve(rows));
  });
}

function getAllUsers() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT id, email, role, birth_date, created_at, is_active FROM users ORDER BY created_at DESC`, (err, rows) => err ? reject(err) : resolve(rows));
  });
}

module.exports = {
  initAuthDb,
  generateToken,
  verifyToken,
  authMiddleware,
  superadminMiddleware,
  findUserByEmail,
  createUser,
  saveGuestSearch,
  getGuestSearches,
  getAllUsers,
  bcrypt,
};

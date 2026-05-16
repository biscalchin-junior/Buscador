const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../backend/auditor.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('--- INICIANDO LIMPEZA TOTAL DO SISTEMA ---');

  db.run('DELETE FROM price_history', (err) => {
    if (err) console.error('Erro ao limpar histórico:', err.message);
    else console.log('✅ Histórico de preços removido.');
  });

  db.run('DELETE FROM user_products', (err) => {
    if (err) console.error('Erro ao limpar vínculos de usuários:', err.message);
    else console.log('✅ Vínculos de produtos com usuários removidos.');
  });

  db.run('DELETE FROM products', (err) => {
    if (err) console.error('Erro ao limpar produtos:', err.message);
    else console.log('✅ Catálogo de produtos removido.');
  });

  db.run('DELETE FROM guest_searches', (err) => {
    if (err) console.error('Erro ao limpar pesquisas:', err.message);
    else console.log('✅ Histórico de pesquisas removido.');
  });

  // OPCIONAL: Limpar usuários que não sejam o superadmin?
  // O usuário disse "de todos", mas geralmente o admin quer manter o próprio acesso.
  // Vou manter a tabela de usuários para não quebrar o login.

  console.log('--- LIMPEZA CONCLUÍDA ---');
});

db.close();

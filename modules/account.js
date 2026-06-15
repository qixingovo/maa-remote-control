const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

function createAccount(username, password, role = 'user') {
  const existing = db.prepare('SELECT id FROM accounts WHERE username = ?').get(username);
  if (existing) return { error: '用户名已存在' };

  const maaUserId = uuidv4().replace(/-/g, '').substring(0, 12);
  const passwordHash = bcrypt.hashSync(password, 10);

  db.prepare(
    "INSERT INTO accounts (username, password_hash, maa_user_id, role, created_at) VALUES (?, ?, ?, ?, datetime('now'))"
  ).run(username, passwordHash, maaUserId, role);

  return db.prepare('SELECT id, username, maa_user_id, role, created_at FROM accounts WHERE username = ?').get(username);
}

function verifyLogin(username, password) {
  const account = db.prepare('SELECT * FROM accounts WHERE username = ?').get(username);
  if (!account) return null;
  if (!bcrypt.compareSync(password, account.password_hash)) return null;
  return { id: account.id, username: account.username, maa_user_id: account.maa_user_id, role: account.role };
}

function getById(id) {
  return db.prepare('SELECT id, username, maa_user_id, role, created_at FROM accounts WHERE id = ?').get(id);
}

function getByMaaUserId(maaUserId) {
  return db.prepare('SELECT id, username, maa_user_id, role FROM accounts WHERE maa_user_id = ?').get(maaUserId);
}

function listAll() {
  return db.prepare('SELECT id, username, maa_user_id, role, created_at FROM accounts ORDER BY created_at DESC').all();
}

function deleteAccount(id) {
  db.prepare('DELETE FROM accounts WHERE id = ? AND role != ?').run(id, 'admin');
  return db.prepare('SELECT changes() as c').get().c > 0;
}

function rotateMaaUserId(id) {
  const acct = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
  if (!acct) return { error: '账户不存在' };
  const newId = uuidv4().replace(/-/g, '').substring(0, 12);
  db.prepare('UPDATE accounts SET maa_user_id = ? WHERE id = ?').run(newId, id);
  return { maa_user_id: newId };
}

function changePassword(id, newPassword) {
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE accounts SET password_hash = ? WHERE id = ?').run(hash, id);
}

module.exports = { createAccount, verifyLogin, getById, getByMaaUserId, listAll, deleteAccount, rotateMaaUserId, changePassword };

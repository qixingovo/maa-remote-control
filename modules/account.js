const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

function createAccount(username, password, phone, email, role = 'user') {
  const existing = db.prepare('SELECT id FROM accounts WHERE username = ?').get(username);
  if (existing) return { error: '用户名已存在' };
  if (phone) {
    const phoneExists = db.prepare("SELECT id FROM accounts WHERE phone = ? AND phone != ''").get(phone);
    if (phoneExists) return { error: '该手机号已被注册' };
  }
  if (email) {
    const emailExists = db.prepare("SELECT id FROM accounts WHERE email = ? AND email != ''").get(email);
    if (emailExists) return { error: '该邮箱已被注册' };
  }

  const maaUserId = uuidv4().replace(/-/g, '').substring(0, 12);
  const passwordHash = bcrypt.hashSync(password, 10);

  db.prepare(
    "INSERT INTO accounts (username, password_hash, phone, email, maa_user_id, role, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"
  ).run(username, passwordHash, phone || '', email || '', maaUserId, role);

  return db.prepare('SELECT id, username, email, phone, email_verified, approved, maa_user_id, role, created_at FROM accounts WHERE username = ?').get(username);
}

function verifyLogin(login, password) {
  let account = db.prepare('SELECT * FROM accounts WHERE username = ?').get(login);
  if (!account) account = db.prepare("SELECT * FROM accounts WHERE phone = ? AND phone != ''").get(login);
  if (!account) account = db.prepare("SELECT * FROM accounts WHERE email = ? AND email != ''").get(login);
  if (!account) return null;
  if (!bcrypt.compareSync(password, account.password_hash)) return null;
  return {
    id: account.id, username: account.username, email: account.email, phone: account.phone,
    email_verified: account.email_verified, approved: account.approved,
    maa_user_id: account.maa_user_id, role: account.role
  };
}

function getById(id) {
  return db.prepare('SELECT id, username, email, phone, email_verified, approved, maa_user_id, role, created_at FROM accounts WHERE id = ?').get(id);
}

function verifyEmail(id) {
  db.prepare('UPDATE accounts SET email_verified = 1 WHERE id = ?').run(id);
}

function approveAccount(id) {
  db.prepare('UPDATE accounts SET approved = 1 WHERE id = ?').run(id);
}

function getByMaaUserId(maaUserId) {
  return db.prepare('SELECT id, username, maa_user_id, role FROM accounts WHERE maa_user_id = ?').get(maaUserId);
}

function listAll() {
  return db.prepare('SELECT id, username, email, approved, maa_user_id, role, created_at FROM accounts ORDER BY created_at DESC').all();
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

function changePhone(id, newPhone) {
  if (!/^1[3-9]\d{9}$/.test(newPhone)) return { error: '手机号格式不正确' };
  const dup = db.prepare("SELECT id FROM accounts WHERE phone = ? AND phone != '' AND id != ?").get(newPhone, id);
  if (dup) return { error: '该手机号已被其他账号绑定' };
  db.prepare('UPDATE accounts SET phone = ? WHERE id = ?').run(newPhone, id);
  return { success: true };
}

module.exports = { createAccount, verifyLogin, getById, getByMaaUserId, listAll, deleteAccount, rotateMaaUserId, changePassword, changePhone, verifyEmail, approveAccount };

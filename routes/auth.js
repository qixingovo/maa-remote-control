const express = require('express');
const config = require('../config');
const account = require('../modules/account');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(express.json());

// Register new account
router.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });
  if (username.length < 2 || password.length < 4) return res.status(400).json({ error: '用户名至少2位，密码至少4位' });

  const result = account.createAccount(username, password);
  if (result.error) return res.status(400).json({ error: result.error });

  res.status(201).json({
    username: result.username,
    maa_user_id: result.maa_user_id,
    message: '注册成功！在MAA用户标识符中填入上面的 maa_user_id'
  });
});

// Login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  // Try account login first
  if (username) {
    const acct = account.verifyLogin(username, password);
    if (acct) {
      req.session.accountId = acct.id;
      return res.json({ authenticated: true, username: acct.username, maa_user_id: acct.maa_user_id, role: acct.role });
    }
  }

  // Legacy password fallback
  if (config.adminPassword && password === config.adminPassword) {
    req.session.authenticated = true;
    return res.json({ authenticated: true, username: 'admin', role: 'admin' });
  }

  res.status(401).json({ error: '用户名或密码错误' });
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ authenticated: false });
});

// Check auth status
router.get('/check', (req, res) => {
  if (!config.adminPassword) return res.json({ authenticated: true, role: 'admin' });
  if (req.session.accountId) {
    const acct = account.getById(req.session.accountId);
    if (acct) return res.json({ authenticated: true, username: acct.username, maa_user_id: acct.maa_user_id, role: acct.role });
  }
  if (req.session.authenticated) return res.json({ authenticated: true, username: 'admin', role: 'admin' });
  res.json({ authenticated: false });
});

// Regenerate MAA user ID
router.post('/rotate-maa-id', (req, res) => {
  const acct = auth.getAccount(req);
  if (!acct || !acct.id) return res.status(401).json({ error: '请先登录' });
  const result = account.rotateMaaUserId(acct.id);
  if (result.error) return res.status(400).json({ error: result.error });
  res.json({ maa_user_id: result.maa_user_id });
});

// List accounts (admin only)
router.get('/accounts', (req, res) => {
  if (!req.session.authenticated && (!req.session.accountId || account.getById(req.session.accountId)?.role !== 'admin')) {
    return res.status(403).json({ error: '无权限' });
  }
  res.json({ accounts: account.listAll() });
});

// Delete account (admin only)
router.delete('/accounts/:id', (req, res) => {
  if (!req.session.authenticated && (!req.session.accountId || account.getById(req.session.accountId)?.role !== 'admin')) {
    return res.status(403).json({ error: '无权限' });
  }
  const ok = account.deleteAccount(parseInt(req.params.id));
  res.json({ deleted: ok });
});

module.exports = router;

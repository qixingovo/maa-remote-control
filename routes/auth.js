const express = require('express');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const account = require('../modules/account');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(express.json());

// Rate limit login: 10 attempts per minute per IP
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: '尝试次数过多，请1分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use('/login', loginLimiter);
router.use('/register', rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: '注册太频繁，请稍后再试' },
}));

// Register new account
router.post('/register', (req, res) => {
  const { username, password, phone } = req.body;
  if (!username || !password || !phone) return res.status(400).json({ error: '用户名、密码和手机号不能为空' });
  if (!/^[a-zA-Z0-9_\u4e00-\u9fff]{2,20}$/.test(username)) return res.status(400).json({ error: '用户名2-20位，仅支持中英文数字下划线' });
  if (password.length < 6) return res.status(400).json({ error: '密码至少6位' });
  if (!/^1[3-9]\d{9}$/.test(phone)) return res.status(400).json({ error: '请输入正确的手机号' });

  const result = account.createAccount(username, password, phone);
  if (result.error) return res.status(400).json({ error: result.error });

  res.status(201).json({
    username: result.username,
    maa_user_id: result.maa_user_id,
    message: '注册成功！在MAA用户标识符中填入上面的 maa_user_id'
  });
});

// Login
router.post('/login', (req, res) => {
  const { login, password, remember } = req.body;
  const loginId = login || req.body.username; // backward compat

  // If "remember me" checked, extend session to 30 days
  if (remember) {
    req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
  }

  // Try account login (username or phone)
  if (loginId) {
    const acct = account.verifyLogin(loginId, password);
    if (acct) {
      req.session.regenerate(() => {
        req.session.accountId = acct.id;
        res.json({ authenticated: true, username: acct.username, maa_user_id: acct.maa_user_id, role: acct.role });
      });
      return;
    }
  }

  // Legacy password fallback
  if (config.adminPassword && password === config.adminPassword) {
    req.session.regenerate(() => {
      req.session.authenticated = true;
      res.json({ authenticated: true, username: 'admin', role: 'admin' });
    });
    return;
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

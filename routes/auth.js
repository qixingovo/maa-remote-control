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

// Send email verification code
router.post('/send-code', rateLimit({ windowMs: 60*1000, max: 3, message: { error: '请稍后再试' } }), async (req, res) => {
  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: '请输入正确的邮箱' });
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const db = require('../db');
  db.prepare("DELETE FROM verify_codes WHERE email = ? OR expires_at < datetime('now')").run(email);
  db.prepare("INSERT INTO verify_codes (email, code, expires_at, created_at) VALUES (?, ?, datetime('now','+5 minutes'), datetime('now'))").run(email, code);
  try {
    await require('../modules/email').sendVerifyCode(email, code);
    res.json({ success: true, message: '验证码已发送' });
  } catch (e) {
    console.error('[send-code]', e.message);
    res.status(500).json({ error: '邮件发送失败，请检查SMTP配置' });
  }
});

// Register new account (email + password)
router.post('/register', (req, res) => {
  const { username, password, email, code } = req.body;
  if (!username || !password || !email) return res.status(400).json({ error: '用户名、密码和邮箱不能为空' });
  if (!/^[a-zA-Z0-9_\u4e00-\u9fff]{2,20}$/.test(username)) return res.status(400).json({ error: '用户名2-20位，仅支持中英文数字下划线' });
  if (password.length < 6) return res.status(400).json({ error: '密码至少6位' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: '请输入正确的邮箱' });

  // Verify email code
  const db = require('../db');
  const vc = db.prepare("SELECT * FROM verify_codes WHERE email = ? AND code = ? AND expires_at > datetime('now') AND used = 0").get(email, code);
  if (!vc) return res.status(400).json({ error: '验证码错误或已过期' });
  db.prepare('UPDATE verify_codes SET used = 1 WHERE id = ?').run(vc.id);

  const result = account.createAccount(username, password, '', email);
  if (result.error) return res.status(400).json({ error: result.error });
  account.verifyEmail(result.id);

  res.status(201).json({
    username: result.username,
    maa_user_id: result.maa_user_id,
    approved: result.approved,
    message: '注册成功！等待管理员审核通过后即可使用。'
  });
});

// Account registration: add phone later (optional)
router.post('/bind-phone', (req, res) => {
  const acct = auth.getAccount(req);
  if (!acct || !acct.id) return res.status(401).json({ error: '请先登录' });
  const { phone } = req.body;
  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) return res.status(400).json({ error: '请输入正确的手机号' });
  const result = account.changePhone(acct.id, phone);
  if (result.error) return res.status(400).json({ error: result.error });
  res.json({ success: true });
});

// Login
router.post('/login', (req, res) => {
  const { login, password, remember } = req.body;
  const loginId = login || req.body.username; // backward compat

  // If "remember me" checked, extend session to 30 days
  if (remember) {
    req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
  }

  // Try account login (username/phone/email)
  if (loginId) {
    const acct = account.verifyLogin(loginId, password);
    if (acct) {
      if (!acct.approved && acct.role !== 'admin') return res.status(403).json({ error: '账号尚未通过审核，请联系管理员' });
      req.session.regenerate(() => {
        req.session.accountId = acct.id;
        res.json({ authenticated: true, username: acct.username, email: acct.email, phone: acct.phone, maa_user_id: acct.maa_user_id, role: acct.role, approved: acct.approved });
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
    if (acct) return res.json({ authenticated: true, username: acct.username, email: acct.email, phone: acct.phone, email_verified: acct.email_verified, approved: acct.approved, maa_user_id: acct.maa_user_id, role: acct.role });
  }
  if (req.session.authenticated) return res.json({ authenticated: true, username: 'admin', role: 'admin' });
  res.json({ authenticated: false });
});

// Change phone number
router.post('/change-phone', (req, res) => {
  const acct = auth.getAccount(req);
  if (!acct || !acct.id) return res.status(401).json({ error: '请先登录' });
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: '请输入新手机号' });
  const result = account.changePhone(acct.id, phone);
  if (result.error) return res.status(400).json({ error: result.error });
  res.json({ success: true });
});

// Regenerate MAA user ID
router.post('/rotate-maa-id', (req, res) => {
  const acct = auth.getAccount(req);
  if (!acct || !acct.id) return res.status(401).json({ error: '请先登录' });
  const result = account.rotateMaaUserId(acct.id);
  if (result.error) return res.status(400).json({ error: result.error });
  res.json({ maa_user_id: result.maa_user_id });
});

// Approve account (admin only)
router.post('/approve/:id', (req, res) => {
  const adminAcct = auth.getAccount(req);
  if (!adminAcct || adminAcct.role !== 'admin') return res.status(403).json({ error: '无权限' });
  account.approveAccount(parseInt(req.params.id));
  res.json({ success: true });
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

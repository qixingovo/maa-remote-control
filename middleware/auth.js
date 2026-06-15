const config = require('../config');
const account = require('../modules/account');

function apiGuard(req, res, next) {
  if (!config.adminPassword && !req.session) return next();
  // New account-based auth
  if (req.session && req.session.accountId) return next();
  // Legacy password auth fallback
  if (config.adminPassword && req.session && req.session.authenticated) return next();
  if (req.path === '/auth/login' || req.path === '/auth/register' || req.path === '/auth/check') return next();
  res.status(401).json({ error: '请登录' });
}

function getAccount(req) {
  if (!req.session) return null;
  if (req.session.accountId) return account.getById(req.session.accountId);
  // Legacy admin
  if (req.session.authenticated) return { id: 0, username: 'admin', role: 'admin', maa_user_id: null };
  return null;
}

module.exports = { apiGuard, getAccount };

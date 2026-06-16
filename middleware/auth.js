const config = require('../config');
const account = require('../modules/account');

function apiGuard(req, res, next) {
  if (req.session && req.session.accountId) return next();
  if (['/auth/login', '/auth/register', '/auth/check', '/auth/send-code'].includes(req.path)) return next();
  res.status(401).json({ error: '请登录' });
}

function getAccount(req) {
  if (!req.session) return null;
  if (req.session.accountId) return account.getById(req.session.accountId);
  return null;
}

module.exports = { apiGuard, getAccount };

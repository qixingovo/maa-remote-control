const config = require('../config');

function apiGuard(req, res, next) {
  if (!config.adminPassword) {
    return next();
  }
  if (req.session && req.session.authenticated) {
    return next();
  }
  if (req.path === '/auth/login' || req.path === '/auth/check') {
    return next();
  }
  res.status(401).json({ error: 'Authentication required' });
}

function requireAuth(req, res, next) {
  if (!config.adminPassword) return next();
  if (req.session && req.session.authenticated) return next();
  res.status(401).json({ error: 'Authentication required' });
}

module.exports = { apiGuard, requireAuth };

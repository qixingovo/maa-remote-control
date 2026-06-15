const express = require('express');
const config = require('../config');

const router = express.Router();

router.post('/login', (req, res) => {
  const { password } = req.body;
  if (!config.adminPassword) {
    return res.json({ authenticated: true, message: 'Auth disabled' });
  }
  if (password === config.adminPassword) {
    req.session.authenticated = true;
    return res.json({ authenticated: true });
  }
  res.status(401).json({ error: 'Invalid password' });
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ authenticated: false });
});

router.get('/check', (req, res) => {
  if (!config.adminPassword) {
    return res.json({ authenticated: true });
  }
  res.json({ authenticated: !!req.session.authenticated });
});

module.exports = router;

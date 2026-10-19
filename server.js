const express = require('express');
const session = require('express-session');
const path = require('path');
const config = require('./config');

const app = express();

// Session for web UI auth (persistent across server restarts)
const sessionSecret = config.sessionSecret || require('crypto').randomBytes(32).toString('hex');
app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000,  // 30 days
    httpOnly: true,
    sameSite: 'strict'
  }
}));

// MAA protocol routes (no auth, large body for screenshots)
const maaRoutes = require('./routes/maa');
app.use('/maa', maaRoutes);

// Management API routes
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// Auth routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Serve immutable screenshot files. Filenames are UUIDs, so they can be cached safely.
app.get('/api/screenshots/:filename', (req, res, next) => {
  const { filename } = req.params;
  if (!/^[A-Za-z0-9-]+\.png$/.test(filename)) {
    return res.status(404).end();
  }

  const root = path.resolve(config.screenshotDir);
  const filePath = path.resolve(root, filename);
  if (!filePath.startsWith(root + path.sep)) {
    return res.status(404).end();
  }

  res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
  res.sendFile(filePath, (err) => {
    if (!err) return;
    if (err.code === 'ENOENT') return res.status(404).end();
    next(err);
  });
});

// Serve web UI
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback: serve index.html for any non-matched route
app.use((req, res, next) => {
  if (req.path.startsWith('/maa') || req.path.startsWith('/api')) {
    return next();
  }
  if (req.method === 'GET') {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  next();
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error('[ERROR]', err.stack || err.message || err);
  if (req.path.startsWith('/maa')) {
    // Never return non-200 to MAA
    if (req.path.endsWith('/getTask')) {
      return res.json({ tasks: [] });
    }
    return res.json({ received: true });
  }
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(config.port, () => {
  console.log(`MAA Remote Server running on http://localhost:${config.port}`);
  console.log(`Screenshot dir: ${config.screenshotDir}`);
  console.log(`Auth: ${config.adminPassword ? 'enabled' : 'disabled'}`);
});

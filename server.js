const express = require('express');
const session = require('express-session');
const path = require('path');
const config = require('./config');

const app = express();

// Session for optional web UI auth
app.use(session({
  secret: require('crypto').randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
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

// Serve screenshot files
app.use('/api/screenshots', express.static(config.screenshotDir));

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

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  dbPath: path.resolve(__dirname, '..', process.env.DB_PATH || './maa-remote.db'),
  screenshotDir: path.resolve(__dirname, '..', process.env.SCREENSHOT_DIR || './data/screenshots'),
  adminPassword: process.env.ADMIN_PASSWORD || '',
  sessionSecret: process.env.SESSION_SECRET || '',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT) || 465,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
};

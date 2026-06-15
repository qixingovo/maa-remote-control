const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  dbPath: path.resolve(__dirname, '..', process.env.DB_PATH || './maa-remote.db'),
  screenshotDir: path.resolve(__dirname, '..', process.env.SCREENSHOT_DIR || './data/screenshots'),
  adminPassword: process.env.ADMIN_PASSWORD || '',
};

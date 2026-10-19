const db = require('../db');

function getValue(key, defaultValue) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : defaultValue;
}

function setValue(key, value) {
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, String(value));
}

function getBoolean(key, defaultValue) {
  const value = getValue(key, null);
  if (value === null) return defaultValue;
  return value === 'true';
}

function setBoolean(key, value) {
  setValue(key, value ? 'true' : 'false');
}

function isServiceEnabled() {
  return getBoolean('service_enabled', true);
}

function setServiceEnabled(enabled) {
  setBoolean('service_enabled', enabled);
  return isServiceEnabled();
}

module.exports = {
  getValue,
  setValue,
  getBoolean,
  setBoolean,
  isServiceEnabled,
  setServiceEnabled
};

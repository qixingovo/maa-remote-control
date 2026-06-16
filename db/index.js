const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const schemaPath = path.join(__dirname, 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf-8');

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(schema);

// Migration: add account_id column if devices table exists but lacks it
const devCols = db.prepare("PRAGMA table_info(devices)").all().map(c => c.name);
if (devCols.length > 0 && !devCols.includes('account_id')) {
  db.exec("ALTER TABLE devices ADD COLUMN account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL");
}
// Migration: add phone column to accounts
const accCols = db.prepare("PRAGMA table_info(accounts)").all().map(c => c.name);
if (accCols.length > 0 && !accCols.includes('phone')) {
  db.exec("ALTER TABLE accounts ADD COLUMN phone TEXT NOT NULL DEFAULT ''");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_phone ON accounts(phone) WHERE phone != ''");
}

module.exports = db;

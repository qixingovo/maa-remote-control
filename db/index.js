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
// Migration: add columns to accounts
const accCols = db.prepare("PRAGMA table_info(accounts)").all().map(c => c.name);
if (accCols.length > 0) {
  if (!accCols.includes('phone')) db.exec("ALTER TABLE accounts ADD COLUMN phone TEXT NOT NULL DEFAULT ''");
  if (!accCols.includes('email')) db.exec("ALTER TABLE accounts ADD COLUMN email TEXT NOT NULL DEFAULT ''");
  if (!accCols.includes('email_verified')) db.exec("ALTER TABLE accounts ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0");
  if (!accCols.includes('approved')) db.exec("ALTER TABLE accounts ADD COLUMN approved INTEGER NOT NULL DEFAULT 0");
}

module.exports = db;

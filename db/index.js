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

module.exports = db;

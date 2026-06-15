const db = require('../db');
const account = require('./account');

function findOrCreate(userUuid, deviceUuid) {
  const existing = db.prepare('SELECT * FROM devices WHERE device_uuid = ?').get(deviceUuid);
  // Link to account based on MAA user identifier
  const acct = account.getByMaaUserId(userUuid);
  const accountId = acct ? acct.id : null;

  if (existing) {
    if (existing.user_uuid !== userUuid || existing.account_id !== accountId) {
      db.prepare('UPDATE devices SET user_uuid = ?, account_id = ?, updated_at = datetime(\'now\') WHERE device_uuid = ?')
        .run(userUuid, accountId, deviceUuid);
    }
    return existing;
  }
  db.prepare("INSERT INTO devices (device_uuid, user_uuid, account_id, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))")
    .run(deviceUuid, userUuid, accountId);
  return db.prepare('SELECT * FROM devices WHERE device_uuid = ?').get(deviceUuid);
}

function getDevice(deviceUuid) {
  return db.prepare('SELECT * FROM devices WHERE device_uuid = ?').get(deviceUuid) || null;
}

function listDevices({ onlineOnly = false, accountId = null } = {}) {
  let sql = 'SELECT * FROM devices WHERE 1=1';
  const params = [];
  if (onlineOnly) { sql += " AND last_seen_at > datetime('now', '-30 seconds')"; }
  if (accountId !== null) { sql += ' AND account_id = ?'; params.push(accountId); }
  sql += ' ORDER BY last_seen_at DESC';
  return db.prepare(sql).all(...params);
}

function updateDevice(deviceUuid, { name, emulatorType } = {}) {
  const device = getDevice(deviceUuid);
  if (!device) return null;

  const updates = [];
  const params = [];
  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (emulatorType !== undefined) { updates.push('emulator_type = ?'); params.push(emulatorType); }
  if (updates.length === 0) return device;

  updates.push("updated_at = datetime('now')");
  params.push(deviceUuid);
  db.prepare(`UPDATE devices SET ${updates.join(', ')} WHERE device_uuid = ?`).run(...params);
  return getDevice(deviceUuid);
}

function updateLastSeen(deviceUuid) {
  db.prepare("UPDATE devices SET last_seen_at = datetime('now'), updated_at = datetime('now') WHERE device_uuid = ?")
    .run(deviceUuid);
}

function deleteDevice(deviceUuid) {
  const device = getDevice(deviceUuid);
  if (!device) return false;
  db.prepare('DELETE FROM devices WHERE device_uuid = ?').run(deviceUuid);
  return true;
}

function getOnlineDevices() {
  return db.prepare(
    "SELECT * FROM devices WHERE last_seen_at > datetime('now', '-30 seconds')"
  ).all();
}

module.exports = {
  findOrCreate,
  getDevice,
  listDevices,
  updateDevice,
  updateLastSeen,
  deleteDevice,
  getOnlineDevices,
};

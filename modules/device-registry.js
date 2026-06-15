const db = require('../db');

function findOrCreate(userUuid, deviceUuid) {
  const existing = db.prepare('SELECT * FROM devices WHERE device_uuid = ?').get(deviceUuid);
  if (existing) {
    // Update user_uuid if it changed
    if (existing.user_uuid !== userUuid) {
      db.prepare('UPDATE devices SET user_uuid = ?, updated_at = datetime(\'now\') WHERE device_uuid = ?')
        .run(userUuid, deviceUuid);
    }
    return existing;
  }
  db.prepare('INSERT INTO devices (device_uuid, user_uuid) VALUES (?, ?)').run(deviceUuid, userUuid);
  return db.prepare('SELECT * FROM devices WHERE device_uuid = ?').get(deviceUuid);
}

function getDevice(deviceUuid) {
  return db.prepare('SELECT * FROM devices WHERE device_uuid = ?').get(deviceUuid) || null;
}

function listDevices({ onlineOnly = false } = {}) {
  if (onlineOnly) {
    return db.prepare(
      "SELECT * FROM devices WHERE last_seen_at > datetime('now', '-30 seconds') ORDER BY last_seen_at DESC"
    ).all();
  }
  return db.prepare('SELECT * FROM devices ORDER BY last_seen_at DESC').all();
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

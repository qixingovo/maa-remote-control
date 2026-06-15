const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const deviceRegistry = require('./device-registry');

function enqueue(deviceUuid, type, params = '', priority = 0) {
  // Auto-register device if not exists (tasks can be queued before device first connects)
  deviceRegistry.findOrCreate('pending', deviceUuid);
  const taskUuid = uuidv4();
  db.prepare(
    `INSERT INTO tasks (task_uuid, device_uuid, type, params, priority, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`
  ).run(taskUuid, deviceUuid, type, params, priority);
  return db.prepare('SELECT * FROM tasks WHERE task_uuid = ?').get(taskUuid);
}

function enqueueBatch(tasksArray) {
  const insert = db.prepare(
    `INSERT INTO tasks (task_uuid, device_uuid, type, params, priority, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`
  );
  const created = [];
  const txn = db.transaction((items) => {
    for (const item of items) {
      const devUuid = item.device_uuid || item.deviceUuid;
      deviceRegistry.findOrCreate('pending', devUuid);
      const taskUuid = uuidv4();
      insert.run(taskUuid, devUuid, item.type, item.params || '', item.priority || 0);
      created.push(db.prepare('SELECT * FROM tasks WHERE task_uuid = ?').get(taskUuid));
    }
  });
  txn(tasksArray);
  return created;
}

function dequeue(deviceUuid) {
  let task = null;
  const txn = db.transaction((device) => {
    const row = db.prepare(
      `SELECT * FROM tasks
       WHERE device_uuid = ? AND status = 'pending'
       ORDER BY priority DESC, created_at ASC
       LIMIT 1`
    ).get(device);

    if (row) {
      db.prepare(
        `UPDATE tasks SET status = 'dispatched', dispatched_at = datetime('now') WHERE task_uuid = ?`
      ).run(row.task_uuid);
      task = row;
      task.status = 'dispatched';
    }
  });
  txn(deviceUuid);
  return task;
}

function getTask(taskUuid) {
  return db.prepare('SELECT * FROM tasks WHERE task_uuid = ?').get(taskUuid) || null;
}

function listTasks({ deviceUuid, status, limit = 50, offset = 0 } = {}) {
  let sql = 'SELECT * FROM tasks WHERE 1=1';
  const params = [];
  if (deviceUuid) { sql += ' AND device_uuid = ?'; params.push(deviceUuid); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  return db.prepare(sql).all(...params);
}

function countTasks({ deviceUuid, status } = {}) {
  let sql = 'SELECT COUNT(*) as count FROM tasks WHERE 1=1';
  const params = [];
  if (deviceUuid) { sql += ' AND device_uuid = ?'; params.push(deviceUuid); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  return db.prepare(sql).get(...params).count;
}

function updateTaskStatus(taskUuid, status) {
  const field = status === 'completed' || status === 'failed'
    ? `status = ?, completed_at = datetime('now')`
    : `status = ?`;
  db.prepare(`UPDATE tasks SET ${field} WHERE task_uuid = ?`).run(status, taskUuid);
  return getTask(taskUuid);
}

function cancelTask(taskUuid) {
  const task = getTask(taskUuid);
  if (!task || task.status !== 'pending') return null;
  return updateTaskStatus(taskUuid, 'cancelled');
}

function getPendingCount(deviceUuid) {
  return db.prepare(
    "SELECT COUNT(*) as count FROM tasks WHERE device_uuid = ? AND status = 'pending'"
  ).get(deviceUuid).count;
}

function getTaskResults(taskUuid) {
  return db.prepare(
    'SELECT * FROM task_results WHERE task_uuid = ? ORDER BY created_at DESC'
  ).all(taskUuid);
}

function listResults({ deviceUuid, since, limit = 50 } = {}) {
  let sql = `
    SELECT tr.*, t.type, t.device_uuid
    FROM task_results tr
    LEFT JOIN tasks t ON tr.task_uuid = t.task_uuid
    WHERE 1=1
  `;
  const params = [];
  if (deviceUuid) { sql += ' AND t.device_uuid = ?'; params.push(deviceUuid); }
  if (since) { sql += ' AND tr.created_at > ?'; params.push(since); }
  sql += ' ORDER BY tr.created_at DESC LIMIT ?';
  params.push(limit);
  return db.prepare(sql).all(...params);
}

module.exports = {
  enqueue,
  enqueueBatch,
  dequeue,
  getTask,
  listTasks,
  countTasks,
  updateTaskStatus,
  cancelTask,
  getPendingCount,
  getTaskResults,
  listResults,
};

const express = require('express');
const deviceRegistry = require('../modules/device-registry');
const taskQueue = require('../modules/task-queue');
const db = require('../db');

const router = express.Router();
router.use(express.json());

// Optional auth: if ADMIN_PASSWORD is set, protect all API routes
const auth = require('../middleware/auth');
router.use(auth.apiGuard);

// Helper: get account ID for filtering (null = admin sees all)
function filterAccountId(req) {
  const acct = auth.getAccount(req);
  if (!acct || acct.role === 'admin') return null;
  return acct.id;
}

// ===== DEVICES =====

router.get('/devices', (req, res) => {
  const onlineOnly = req.query.online === 'true';
  const accountId = filterAccountId(req);
  const devices = deviceRegistry.listDevices({ onlineOnly, accountId });
  res.json({ devices });
});

router.get('/devices/:uuid', (req, res) => {
  const device = deviceRegistry.getDevice(req.params.uuid);
  if (!device) return res.status(404).json({ error: 'Device not found' });
  const accountId = filterAccountId(req);
  if (accountId !== null && device.account_id !== accountId) return res.status(403).json({ error: '无权访问此设备' });
  const pendingCount = taskQueue.getPendingCount(req.params.uuid);
  res.json({ ...device, pendingCount });
});

router.patch('/devices/:uuid', (req, res) => {
  const { name, emulator_type } = req.body;
  const device = deviceRegistry.updateDevice(req.params.uuid, { name, emulatorType: emulator_type });
  if (!device) return res.status(404).json({ error: 'Device not found' });
  res.json(device);
});

router.delete('/devices/:uuid', (req, res) => {
  const deleted = deviceRegistry.deleteDevice(req.params.uuid);
  if (!deleted) return res.status(404).json({ error: 'Device not found' });
  res.json({ deleted: true });
});

// ===== TASKS =====

router.get('/tasks', (req, res) => {
  const { device, status, limit, offset } = req.query;
  const accountId = filterAccountId(req);
  const tasks = taskQueue.listTasks({
    deviceUuid: device,
    status: status,
    accountId: accountId,
    limit: parseInt(limit) || 50,
    offset: parseInt(offset) || 0
  });
  const total = taskQueue.countTasks({ deviceUuid: device, status, accountId });
  res.json({ tasks, total });
});

router.post('/tasks', (req, res) => {
  const { device_uuid, type, params, priority } = req.body;
  if (!device_uuid || !type) {
    return res.status(400).json({ error: 'device_uuid and type are required' });
  }
  const task = taskQueue.enqueue(device_uuid, type, params || '', priority || 0);
  res.status(201).json(task);
});

router.post('/tasks/batch', (req, res) => {
  const { tasks } = req.body;
  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    return res.status(400).json({ error: 'tasks array is required' });
  }
  const created = taskQueue.enqueueBatch(tasks);
  res.status(201).json({ tasks: created });
});

router.get('/tasks/:uuid', (req, res) => {
  const task = taskQueue.getTask(req.params.uuid);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const results = taskQueue.getTaskResults(req.params.uuid);
  res.json({ ...task, results });
});

router.patch('/tasks/:uuid', (req, res) => {
  const { status } = req.body;
  if (status === 'cancelled') {
    const task = taskQueue.cancelTask(req.params.uuid);
    if (!task) return res.status(404).json({ error: 'Task not found or not cancellable' });
    return res.json(task);
  }
  res.status(400).json({ error: 'Only cancelling tasks is supported' });
});

// ===== RESULTS =====

router.get('/results', (req, res) => {
  const { device, since, limit } = req.query;
  const accountId = filterAccountId(req);
  const results = taskQueue.listResults({
    deviceUuid: device,
    since,
    accountId,
    limit: parseInt(limit) || 50
  });
  res.json({ results });
});

router.get('/results/:taskUuid', (req, res) => {
  const result = db.prepare('SELECT * FROM task_results WHERE task_uuid = ? ORDER BY created_at DESC').get(req.params.taskUuid);
  if (!result) return res.status(404).json({ error: 'Result not found' });
  res.json(result);
});

// ===== STATUS =====

router.get('/status', (req, res) => {
  const accountId = filterAccountId(req);
  const onlineDevices = deviceRegistry.listDevices({ onlineOnly: true, accountId });
  let whereTasks = "1=1";
  let whereDevices = "1=1";
  const params = [];
  if (accountId !== null) {
    whereTasks = "t.device_uuid IN (SELECT device_uuid FROM devices WHERE account_id = ?)";
    whereDevices = "account_id = ?";
    params.push(accountId);
  }
  const pendingTasks = db.prepare(
    `SELECT COUNT(*) as count FROM tasks t WHERE ${whereTasks} AND t.status = 'pending'`
  ).get(...params).count;
  const completedToday = db.prepare(
    `SELECT COUNT(*) as count FROM tasks t WHERE ${whereTasks} AND t.status = 'completed' AND date(t.completed_at) = date('now')`
  ).get(...params).count;
  const failedToday = db.prepare(
    `SELECT COUNT(*) as count FROM tasks t WHERE ${whereTasks} AND t.status = 'failed' AND date(t.completed_at) = date('now')`
  ).get(...params).count;

  res.json({
    onlineDevices: onlineDevices.length,
    pendingTasks,
    completedToday,
    failedToday
  });
});

module.exports = router;

const express = require('express');
const deviceRegistry = require('../modules/device-registry');
const taskQueue = require('../modules/task-queue');
const taskResultHandler = require('../modules/task-result-handler');

const router = express.Router();
// MAA sends screenshots as base64 which can be 10+ MB
router.use(express.json({ limit: '50mb' }));

// POST /maa/getTask - MAA polls every 1 second
router.post('/getTask', (req, res) => {
  try {
    const { user, device } = req.body;
    if (!user || !device) {
      console.log(`[${new Date().toLocaleTimeString()}] getTask 请求格式错误:`, req.body);
      return res.json({ tasks: [] });
    }

    const isNew = deviceRegistry.findOrCreate(user, device);
    if (isNew && isNew.id === (deviceRegistry.getDevice(device) || {}).id) {
      // Check if newly created by comparing created_at with updated_at
    }
    deviceRegistry.updateLastSeen(device);

    const task = taskQueue.dequeue(device);
    if (task) {
      console.log(`[${new Date().toLocaleTimeString()}] MAA轮询 device=${device.substring(0,8)}... → 下发任务: ${task.type}`);
      return res.json({
        tasks: [{
          id: task.task_uuid,
          type: task.type,
          ...(task.params ? { params: task.params } : {})
        }]
      });
    }
    // Log first poll and every 30th poll to avoid spam
    if (!req.app.locals._pollCount) req.app.locals._pollCount = {};
    const key = device;
    req.app.locals._pollCount[key] = (req.app.locals._pollCount[key] || 0) + 1;
    if (req.app.locals._pollCount[key] === 1) {
      console.log(`[${new Date().toLocaleTimeString()}] MAA首次轮询 device=${device.substring(0,8)}... user=${user.substring(0,8)}... → 无任务`);
    } else if (req.app.locals._pollCount[key] % 30 === 0) {
      console.log(`[${new Date().toLocaleTimeString()}] MAA轮询中 device=${device.substring(0,8)}... (第${req.app.locals._pollCount[key]}次) → 无任务`);
    }
    return res.json({ tasks: [] });
  } catch (err) {
    console.error('[getTask]', err.message);
    return res.json({ tasks: [] });
  }
});

// POST /maa/reportStatus - MAA reports task completion
router.post('/reportStatus', (req, res) => {
  try {
    const { user, device, task: taskUuid, status, payload } = req.body;
    if (!taskUuid) {
      return res.json({ received: true });
    }

    taskResultHandler.processReport({
      user,
      device,
      taskUuid,
      status: status || 'SUCCESS',
      payload: payload || ''
    });

    return res.json({ received: true });
  } catch (err) {
    console.error('[reportStatus]', err.message);
    return res.json({ received: true });
  }
});

module.exports = router;

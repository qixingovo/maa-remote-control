const db = require('../db');
const screenshotManager = require('./screenshot-manager');
const taskQueue = require('./task-queue');

function processReport({ user, device, taskUuid, status, payload }) {
  const resultStatus = status === 'FAILED' ? 'FAILED' : 'SUCCESS';

  let payloadType = 'empty';
  let payloadPath = null;
  let payloadText = '';

  if (payload && payload.length > 0) {
    const saveResult = screenshotManager.save(taskUuid, payload);
    payloadType = saveResult.type;
    if (saveResult.type === 'screenshot') {
      payloadPath = saveResult.relativePath;
    } else if (saveResult.type === 'text') {
      payloadText = saveResult.text;
    }
  }

  // Insert result
  db.prepare(
    `INSERT INTO task_results (task_uuid, status, payload_type, payload_path, payload_text)
     VALUES (?, ?, ?, ?, ?)`
  ).run(taskUuid, resultStatus, payloadType, payloadPath, payloadText);

  // Update task status
  const taskStatus = resultStatus === 'SUCCESS' ? 'completed' : 'failed';
  taskQueue.updateTaskStatus(taskUuid, taskStatus);

  return { taskStatus };
}

module.exports = { processReport };

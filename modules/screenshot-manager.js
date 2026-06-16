const fs = require('fs');
const path = require('path');
const config = require('../config');

// Validate taskUuid is a safe filename (UUID format only)
function isValidTaskId(id) {
  return /^[a-fA-F0-9-]{8,64}$/.test(id) && !id.includes('..');
}

function safePath(taskUuid) {
  if (!isValidTaskId(taskUuid)) throw new Error('Invalid task UUID');
  const filename = `${taskUuid}.png`;
  const resolved = path.resolve(config.screenshotDir, filename);
  // Ensure resolved path stays within screenshotDir
  if (!resolved.startsWith(path.resolve(config.screenshotDir))) {
    throw new Error('Path traversal blocked');
  }
  return resolved;
}

function save(taskUuid, base64Data) {
  if (!base64Data) {
    return { type: 'empty', relativePath: null };
  }

  let raw = base64Data;
  const commaIdx = raw.indexOf(',');
  if (commaIdx !== -1) {
    raw = raw.substring(commaIdx + 1);
  }

  let buffer;
  try {
    buffer = Buffer.from(raw, 'base64');
  } catch {
    return { type: 'text', text: raw.substring(0, 10000) };
  }

  const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
  if (buffer.length < 4 || !buffer.subarray(0, 4).equals(PNG_MAGIC)) {
    return { type: 'text', text: raw.substring(0, 10000) };
  }

  let filepath;
  try {
    filepath = safePath(taskUuid);
  } catch {
    return { type: 'text', text: '' };
  }

  fs.mkdirSync(config.screenshotDir, { recursive: true });
  fs.writeFileSync(filepath, buffer);

  return { type: 'screenshot', relativePath: `screenshots/${taskUuid}.png` };
}

function getPath(taskUuid) {
  let filepath;
  try { filepath = safePath(taskUuid); } catch { return null; }
  if (fs.existsSync(filepath)) return filepath;
  return null;
}

function deleteScreenshot(taskUuid) {
  let filepath;
  try { filepath = safePath(taskUuid); } catch { return false; }
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
    return true;
  }
  return false;
}

module.exports = { save, getPath, deleteScreenshot };

const fs = require('fs');
const path = require('path');
const config = require('../config');

function save(taskUuid, base64Data) {
  if (!base64Data) {
    return { type: 'empty', relativePath: null };
  }

  let raw = base64Data;
  // Strip data URI prefix if present (e.g. "data:image/png;base64,...")
  const commaIdx = raw.indexOf(',');
  if (commaIdx !== -1) {
    raw = raw.substring(commaIdx + 1);
  }

  // Decode
  let buffer;
  try {
    buffer = Buffer.from(raw, 'base64');
  } catch {
    return { type: 'text', text: raw.substring(0, 10000) };
  }

  // Validate PNG magic bytes
  const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
  if (buffer.length < 4 || !buffer.subarray(0, 4).equals(PNG_MAGIC)) {
    return { type: 'text', text: raw.substring(0, 10000) };
  }

  // Ensure directory exists
  fs.mkdirSync(config.screenshotDir, { recursive: true });

  // Write file
  const filename = `${taskUuid}.png`;
  const filepath = path.join(config.screenshotDir, filename);
  fs.writeFileSync(filepath, buffer);

  return { type: 'screenshot', relativePath: `screenshots/${filename}` };
}

function getPath(taskUuid) {
  const filename = `${taskUuid}.png`;
  const filepath = path.join(config.screenshotDir, filename);
  if (fs.existsSync(filepath)) {
    return filepath;
  }
  return null;
}

function deleteScreenshot(taskUuid) {
  const filename = `${taskUuid}.png`;
  const filepath = path.join(config.screenshotDir, filename);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
    return true;
  }
  return false;
}

module.exports = { save, getPath, deleteScreenshot };

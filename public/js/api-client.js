// API client: thin wrapper around fetch for /api/*
const api = {
  async request(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(path, opts);
    if (res.status === 401 && !path.includes('/auth/')) {
      APP.showLogin();
      throw new Error('Authentication required');
    }
    return res.json();
  },

  // Auth
  login(username, password, remember) { return this.request('POST', '/api/auth/login', { username, password, remember }); },
  register(username, password) { return this.request('POST', '/api/auth/register', { username, password }); },
  logout() { return this.request('POST', '/api/auth/logout'); },
  checkAuth() { return this.request('GET', '/api/auth/check'); },
  rotateMaaId() { return this.request('POST', '/api/auth/rotate-maa-id'); },

  // Devices
  getDevices(onlineOnly) {
    const q = onlineOnly ? '?online=true' : '';
    return this.request('GET', `/api/devices${q}`);
  },
  getDevice(uuid) { return this.request('GET', `/api/devices/${uuid}`); },
  updateDevice(uuid, data) { return this.request('PATCH', `/api/devices/${uuid}`, data); },
  deleteDevice(uuid) { return this.request('DELETE', `/api/devices/${uuid}`); },

  // Tasks
  getTasks(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request('GET', `/api/tasks?${q}`);
  },
  createTask(data) { return this.request('POST', '/api/tasks', data); },
  createTaskBatch(tasks) { return this.request('POST', '/api/tasks/batch', { tasks }); },
  getTask(uuid) { return this.request('GET', `/api/tasks/${uuid}`); },
  cancelTask(uuid) { return this.request('PATCH', `/api/tasks/${uuid}`, { status: 'cancelled' }); },

  // Results
  getResults(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request('GET', `/api/results?${q}`);
  },

  // Status
  getStatus() { return this.request('GET', '/api/status'); }
};

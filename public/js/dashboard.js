// Dashboard tab
const Dashboard = {
  interval: null,

  init() {
    document.getElementById('qd-send').addEventListener('click', () => this.quickDispatch());
    this.refresh();
  },

  async refresh() {
    try {
      const status = await api.getStatus();
      this.renderStats(status);
      const results = await api.getResults({ limit: 10 });
      this.renderActivity(results.results || []);
      // Populate quick dispatch device dropdown
      const devices = await api.getDevices();
      const sel = document.getElementById('qd-device');
      const current = sel.value;
      sel.innerHTML = (devices.devices || []).map(d =>
        `<option value="${d.device_uuid}" ${d.device_uuid === current ? 'selected' : ''}>${d.name || APP.truncate(d.device_uuid)}</option>`
      ).join('');
      if (!sel.innerHTML) sel.innerHTML = '<option value="">-- 无设备 --</option>';
    } catch { /* server not ready */ }
  },

  renderStats(s) {
    document.getElementById('stats-cards').innerHTML = `
      <div class="stat-card online"><div class="stat-value">${s.onlineDevices}</div><div class="stat-label">在线设备</div></div>
      <div class="stat-card pending"><div class="stat-value">${s.pendingTasks}</div><div class="stat-label">待执行任务</div></div>
      <div class="stat-card completed"><div class="stat-value">${s.completedToday}</div><div class="stat-label">今日已完成</div></div>
      <div class="stat-card failed"><div class="stat-value">${s.failedToday}</div><div class="stat-label">今日失败</div></div>
    `;
  },

  renderActivity(results) {
    const tbody = document.querySelector('#recent-activity tbody');
    if (results.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-secondary)">暂无活动</td></tr>';
      return;
    }
    tbody.innerHTML = results.map(r => `
      <tr>
        <td>${APP.timeAgo(r.created_at)}</td>
        <td>${APP.truncate(r.device_uuid || '')}</td>
        <td><span class="type-badge ${APP.typeClass(r.type || '')}">${APP.taskTypeLabel(r.type || '')}</span></td>
        <td><span class="badge ${r.status}">${r.status}</span></td>
      </tr>
    `).join('');
  },

  async quickDispatch() {
    const device = document.getElementById('qd-device').value;
    const type = document.getElementById('qd-type').value;
    if (!device) return alert('请先选择设备');
    try {
      await api.createTask({ device_uuid: device, type });
      this.refresh();
    } catch (e) { alert('下发失败: ' + e.message); }
  }
};

// Auto-refresh dashboard every 5 seconds
setInterval(() => {
  if (APP.currentTab === 'dashboard') Dashboard.refresh();
}, 5000);

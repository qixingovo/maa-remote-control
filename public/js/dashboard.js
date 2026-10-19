// Dashboard tab
const Dashboard = {
  interval: null,
  refreshing: false,

  init() {
    document.getElementById('qd-send').addEventListener('click', () => this.quickDispatch());
    this.refresh();
  },

  async refresh() {
    if (this.refreshing || document.hidden) return;
    this.refreshing = true;
    try {
      const overview = await api.getOverview();
      this.renderStats(overview);
      this.renderActivity(overview.results || []);
      this.renderDeviceSelect(overview.devices || []);
    } catch { /* server not ready */ } finally {
      this.refreshing = false;
    }
  },

  renderDeviceSelect(devices) {
    const sel = document.getElementById('qd-device');
    const current = sel.value;
    sel.innerHTML = devices.map(d =>
      `<option value="${d.device_uuid}" ${d.device_uuid === current ? 'selected' : ''}>${d.name || APP.truncate(d.device_uuid)}</option>`
    ).join('');
    if (!sel.innerHTML) sel.innerHTML = '<option value="">-- 无设备 --</option>';
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
    const cards = document.getElementById('recent-activity-cards');
    if (results.length === 0) {
      const empty = '<tr><td colspan="4" style="text-align:center;color:var(--text-secondary)">暂无活动</td></tr>';
      tbody.innerHTML = empty;
      cards.innerHTML = '<div style="text-align:center;color:var(--text-secondary);padding:16px">暂无活动</div>';
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
    // Mobile cards
    cards.innerHTML = results.map(r => `
      <div class="card-item">
        <div class="card-row">
          <span class="type-${APP.typeClass(r.type || '')}">${APP.taskTypeLabel(r.type || '')}</span>
          <span class="badge ${r.status}">${r.status}</span>
        </div>
        <div class="card-meta">${APP.truncate(r.device_uuid || '')} · ${APP.timeAgo(r.created_at)}</div>
      </div>
    `).join('');
  },

  async quickDispatch() {
    const device = document.getElementById('qd-device').value;
    const type = document.getElementById('qd-type').value;
    if (!device) { APP.toast('请先选择设备'); return; }
    try {
      await api.createTask({ device_uuid: device, type });
      APP.toast('任务已下发');
      this.refresh();
    } catch (e) { APP.toast('下发失败'); }
  }
};

// Auto-refresh dashboard every 15 seconds
setInterval(() => {
  if (APP.currentTab === 'dashboard' && !document.hidden) Dashboard.refresh();
}, 15000);

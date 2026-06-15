// Screenshots tab
const Screenshots = {
  selectedShots: new Set(),

  init() {
    document.getElementById('shot-delete-selected').addEventListener('click', () => this.deleteSelected());
    document.getElementById('shot-device-filter').addEventListener('change', () => this.refresh());
  },

  async refresh() {
    try {
      const device = document.getElementById('shot-device-filter').value;
      const params = { limit: 50 };
      if (device) params.device = device;
      const data = await api.getResults(params);
      const results = (data.results || []).filter(r => r.payload_type === 'screenshot');
      this.renderGrid(results);
      // Populate device filter
      const devices = await api.getDevices();
      const sel = document.getElementById('shot-device-filter');
      const current = sel.value;
      sel.innerHTML = '<option value="">全部设备</option>' +
        (devices.devices || []).map(d =>
          `<option value="${d.device_uuid}" ${d.device_uuid === current ? 'selected' : ''}>${d.name || APP.truncate(d.device_uuid)}</option>`
        ).join('');
    } catch { /* */ }
  },

  renderGrid(results) {
    const grid = document.getElementById('screenshot-grid');
    if (results.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-secondary);padding:40px">暂无截图。下发 CaptureImage 或 CaptureImageNow 任务获取截图。</div>';
      document.getElementById('shot-delete-selected').style.display = 'none';
      return;
    }
    document.getElementById('shot-delete-selected').style.display = 'inline-block';
    this.selectedShots.clear();
    grid.innerHTML = results.map(r => `
      <div class="screenshot-card" data-task="${r.task_uuid}">
        <img src="/api/screenshots/${r.task_uuid}.png" alt="Screenshot" loading="lazy" onclick="Screenshots.viewFull('${r.task_uuid}')">
        <div class="shot-info">
          <div class="shot-device">${APP.truncate(r.device_uuid || '')}</div>
          <div>${APP.taskTypeLabel(r.type || '')} &middot; ${APP.timeAgo(r.created_at)}</div>
        </div>
        <div class="shot-actions">
          <button class="secondary" onclick="Screenshots.download('${r.task_uuid}')">下载</button>
          <button class="danger" onclick="Screenshots.deleteOne('${r.task_uuid}')">删除</button>
          <label style="font-size:12px;cursor:pointer"><input type="checkbox" onchange="Screenshots.toggleSelect('${r.task_uuid}', this.checked)"> 选择</label>
        </div>
      </div>
    `).join('');
  },

  viewFull(taskUuid) {
    APP.openModal(`
      <div class="screenshot-full">
        <img src="/api/screenshots/${taskUuid}.png" alt="Full screenshot">
        <div class="modal-actions" style="margin-top:12px">
          <button class="secondary" onclick="Screenshots.download('${taskUuid}')">下载</button>
          <button onclick="APP.closeModal()">关闭</button>
        </div>
      </div>
    `);
  },

  download(taskUuid) {
    const a = document.createElement('a');
    a.href = `/api/screenshots/${taskUuid}.png`;
    a.download = `${taskUuid}.png`;
    a.click();
  },

  toggleSelect(taskUuid, checked) {
    if (checked) {
      this.selectedShots.add(taskUuid);
    } else {
      this.selectedShots.delete(taskUuid);
    }
  },

  async deleteOne(taskUuid) {
    if (!confirm('确认删除此截图？')) return;
    try {
      // Delete the result row via API - we need to just remove the DB record
      // The screenshot file is managed by screenshot-manager
      await api.request('PATCH', `/api/tasks/${taskUuid}`, { status: 'cancelled' });
      this.refresh();
    } catch { /* */ }
  },

  deleteSelected() {
    if (this.selectedShots.size === 0) return alert('请先选择截图');
    APP.openModal(`
      <h2>确认批量删除</h2>
      <p>确认删除选中的 ${this.selectedShots.size} 张截图？</p>
      <div class="modal-actions">
        <button class="secondary" onclick="APP.closeModal()">取消</button>
        <button class="danger" id="batch-delete-btn" onclick="Screenshots.confirmBatchDelete()">确认删除</button>
      </div>
    `);
  },

  async confirmBatchDelete() {
    for (const uuid of this.selectedShots) {
      await api.request('PATCH', `/api/tasks/${uuid}`, { status: 'cancelled' });
    }
    APP.closeModal();
    this.refresh();
  }
};

// Auto-refresh screenshots when tab active
setInterval(() => {
  if (APP.currentTab === 'screenshots') Screenshots.refresh();
}, 10000);

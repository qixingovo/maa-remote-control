// Task Queue tab
const TaskQueue = {
  currentFilter: { device: '', status: '' },
  currentSub: 'exec',

  init() {
    // Sub-tabs
    document.querySelectorAll('.sub-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentSub = btn.dataset.sub;
        document.querySelectorAll('.sub-tab').forEach(b => b.classList.toggle('active', b.dataset.sub === this.currentSub));
        document.querySelectorAll('.sub-panel').forEach(p => p.classList.toggle('active', p.id === 'sub-' + this.currentSub));
        if (this.currentSub === 'queue') this.loadTasks();
      });
    });

    // Quick buttons
    document.querySelectorAll('.quick-btn').forEach(btn => {
      btn.addEventListener('click', () => this.quickDispatch(btn.dataset.type));
    });

    // Config send all
    document.getElementById('cfg-send-all').addEventListener('click', () => this.sendAllConfigured());

    // Accordion expand/collapse
    document.getElementById('cfg-expand-all').addEventListener('click', () => {
      document.querySelectorAll('.accordion').forEach(a => a.classList.add('open'));
    });
    document.getElementById('cfg-collapse-all').addEventListener('click', () => {
      document.querySelectorAll('.accordion').forEach(a => a.classList.remove('open'));
    });

    // Filter
    document.getElementById('filter-apply').addEventListener('click', () => this.applyFilter());
  },

  async refresh() {
    try { await this.loadDevices(); } catch {}
    if (this.currentSub === 'queue') await this.loadTasks();
  },

  async loadDevices() {
    const data = await api.getDevices();
    const devices = data.devices || [];
    const opts = devices.map(d =>
      `<option value="${d.device_uuid}">${d.name || APP.truncate(d.device_uuid)}</option>`
    ).join('');
    const el = document.getElementById('task-device');
    if (el) el.innerHTML = opts || '<option value="">-- 无设备 --</option>';
    const fl = document.getElementById('filter-device');
    if (fl) fl.innerHTML = '<option value="">全部设备</option>' + opts;
    const ls = document.getElementById('ls-device');
    if (ls) ls.innerHTML = opts || '<option value="">-- 无设备 --</option>';
  },

  async loadTasks() {
    const { device, status } = this.currentFilter;
    const params = { limit: 100 };
    if (device) params.device = device;
    if (status) params.status = status;
    const data = await api.getTasks(params);
    this.renderTable(data.tasks || []);
  },

  renderTable(tasks) {
    const tbody = document.querySelector('#tasks-table tbody');
    const cards = document.getElementById('tasks-cards');
    if (tasks.length === 0) {
      const empty = '<tr><td colspan="6" style="text-align:center;color:var(--text-secondary)">暂无任务</td></tr>';
      if (tbody) tbody.innerHTML = empty;
      if (cards) cards.innerHTML = '<div style="text-align:center;color:var(--text-secondary);padding:16px">暂无任务</div>';
      return;
    }
    const statusLabels = { pending:'等待中', dispatched:'已下发', running:'执行中', completed:'已完成', failed:'失败', cancelled:'已取消' };
    if (tbody) {
      tbody.innerHTML = tasks.map(t => `
        <tr>
          <td><code>${APP.truncate(t.task_uuid)}</code></td>
          <td><code>${APP.truncate(t.device_uuid)}</code></td>
          <td><span class="type-badge ${APP.typeClass(t.type)}">${APP.taskTypeLabel(t.type)}</span></td>
          <td><span class="badge ${t.status}">${statusLabels[t.status] || t.status}</span></td>
          <td>${APP.timeAgo(t.created_at)}</td>
          <td>
            ${t.status === 'pending' ? `<button class="danger" onclick="TaskQueue.cancel('${t.task_uuid}')">取消</button>` : ''}
            ${t.status === 'completed' || t.status === 'failed' ? `<button class="secondary" onclick="TaskQueue.viewResult('${t.task_uuid}')">查看</button>` : ''}
          </td>
        </tr>
      `).join('');
    }
    if (cards) {
      cards.innerHTML = tasks.map(t => `
        <div class="card-item">
          <div class="card-row">
            <span class="type-${APP.typeClass(t.type)}">${APP.taskTypeLabel(t.type)}</span>
            <span class="badge ${t.status}">${statusLabels[t.status] || t.status}</span>
          </div>
          <div class="card-meta">${APP.truncate(t.device_uuid)} · ${APP.timeAgo(t.created_at)}</div>
          ${t.status === 'pending' || t.status === 'completed' || t.status === 'failed' ? `
          <div class="card-actions">
            ${t.status === 'pending' ? `<button class="danger" onclick="TaskQueue.cancel('${t.task_uuid}')">取消</button>` : ''}
            ${t.status === 'completed' || t.status === 'failed' ? `<button class="secondary" onclick="TaskQueue.viewResult('${t.task_uuid}')">查看</button>` : ''}
          </div>` : ''}
        </div>
      `).join('');
    }
  },

  async quickDispatch(type) {
    const device = document.getElementById('task-device').value;
    if (!device) { APP.toast('请先选择设备'); return; }
    try {
      await api.createTask({ device_uuid: device, type });
      APP.toast(`已下发: ${APP.taskTypeLabel(type)}`);
      this.refresh();
    } catch (e) { APP.toast('下发失败'); }
  },

  async sendAllConfigured() {
    const device = document.getElementById('ls-device').value;
    if (!device) { APP.toast('请选择目标设备'); return; }
    const tasks = [];
    // Settings from accordion
    const stageEl = document.querySelector('.cfg-sub-stage');
    if (stageEl && stageEl.value) tasks.push({ device_uuid: device, type: 'Settings-Stage1', params: stageEl.value });
    const addrEl = document.querySelector('.cfg-sub-addr');
    if (addrEl && addrEl.value.trim()) tasks.push({ device_uuid: device, type: 'Settings-ConnectionAddress', params: addrEl.value.trim() });
    // LinkStart tasks from checkboxes
    const types = Array.from(document.querySelectorAll('.ls-cb:checked')).map(cb => cb.dataset.type);
    types.forEach(type => tasks.push({ device_uuid: device, type }));
    if (tasks.length === 0) { APP.toast('请至少勾选一项'); return; }
    try {
      await api.createTaskBatch(tasks);
      APP.toast(`配置+${types.length}个任务已下发`);
      this.loadTasks();
    } catch (e) { APP.toast('下发失败'); }
  },

  async cancel(uuid) {
    if (!confirm('确认取消此任务？')) return;
    await api.cancelTask(uuid);
    this.refresh();
  },

  async viewResult(uuid) {
    try {
      const data = await api.getTask(uuid);
      const hasScreenshot = data.results && data.results.some(r => r.payload_type === 'screenshot');
      const result = data.results && data.results[0];
      let html = `<h2>任务详情</h2>
        <p><strong>类型:</strong> ${APP.taskTypeLabel(data.type)}</p>
        <p><strong>状态:</strong> <span class="badge ${data.status}">${data.status}</span></p>
        <p><strong>结果:</strong> <span class="badge ${result ? result.status : ''}">${result ? result.status : '无'}</span></p>`;
      if (result && result.payload_text) html += `<p><strong>数据:</strong> ${APP.escapeHtml(result.payload_text)}</p>`;
      if (hasScreenshot) {
        const screenshotResult = data.results.find(r => r.payload_type === 'screenshot');
        html += `<p><strong>截图:</strong></p><img src="/api/screenshots/${screenshotResult.task_uuid}.png" style="max-width:100%;border-radius:4px;border:1px solid var(--border)">`;
      }
      html += '<div class="modal-actions"><button onclick="APP.closeModal()">关闭</button></div>';
      APP.openModal(html);
    } catch (e) { APP.toast('获取详情失败'); }
  },

  applyFilter() {
    this.currentFilter.device = document.getElementById('filter-device').value;
    this.currentFilter.status = document.getElementById('filter-status').value;
    this.loadTasks();
  }
};

// Auto-refresh
setInterval(() => {
  if (APP.currentTab === 'tasks') TaskQueue.refresh();
}, 5000);

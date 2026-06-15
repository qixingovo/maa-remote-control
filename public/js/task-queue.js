// Task Queue tab
const TaskQueue = {
  currentFilter: { device: '', status: '' },

  init() {
    document.getElementById('task-enqueue').addEventListener('click', () => this.enqueue());
    document.getElementById('task-batch-btn').addEventListener('click', () => this.showBatchForm());
    document.getElementById('filter-apply').addEventListener('click', () => this.applyFilter());
    // Settings panel
    document.getElementById('cfg-apply').addEventListener('click', () => this.applySettings());
    // LinkStart presets
    document.getElementById('cfg-send-all').addEventListener('click', () => this.sendAllConfigured());
  },

  async refresh() {
    try {
      await this.loadDevices();
      await this.loadTasks();
    } catch { /* */ }
  },

  async loadDevices() {
    const data = await api.getDevices();
    const devices = data.devices || [];
    const opts = devices.map(d =>
      `<option value="${d.device_uuid}">${d.name || APP.truncate(d.device_uuid)}</option>`
    ).join('');
    document.getElementById('task-device').innerHTML = opts || '<option value="">-- 无设备 --</option>';
    document.getElementById('filter-device').innerHTML = '<option value="">全部设备</option>' + opts;
    document.getElementById('cfg-device').innerHTML = opts || '<option value="">-- 无设备 --</option>';
    document.getElementById('ls-device').innerHTML = opts || '<option value="">-- 无设备 --</option>';
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
      tbody.innerHTML = empty;
      cards.innerHTML = '<div style="text-align:center;color:var(--text-secondary);padding:16px">暂无任务</div>';
      return;
    }
    const statusLabels = { pending:'等待中', dispatched:'已下发', running:'执行中', completed:'已完成', failed:'失败', cancelled:'已取消' };
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
    // Mobile cards
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
  },

  async enqueue(uuid, type, params) {
    const device = uuid || document.getElementById('task-device').value;
    const taskType = type || document.getElementById('task-type').value;
    const taskParams = params !== undefined ? params : document.getElementById('task-params').value;
    if (!device) { APP.toast('请选择设备'); return; }
    try {
      await api.createTask({ device_uuid: device, type: taskType, params: taskParams });
      APP.toast('任务已加入队列');
      this.refresh();
    } catch (e) { APP.toast('创建失败'); }
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
      if (result && result.payload_text) {
        html += `<p><strong>数据:</strong> ${result.payload_text}</p>`;
      }
      if (hasScreenshot) {
        const screenshotResult = data.results.find(r => r.payload_type === 'screenshot');
        html += `<p><strong>截图:</strong></p>
          <img src="/api/screenshots/${screenshotResult.task_uuid}.png" style="max-width:100%;border-radius:4px;border:1px solid var(--border)">`;
      }
      html += '<div class="modal-actions"><button onclick="APP.closeModal()">关闭</button></div>';
      APP.openModal(html);
    } catch (e) { APP.toast('获取详情失败'); }
  },

  applyFilter() {
    this.currentFilter.device = document.getElementById('filter-device').value;
    this.currentFilter.status = document.getElementById('filter-status').value;
    this.loadTasks();
  },

  showBatchForm() {
    const device = document.getElementById('task-device').value;
    APP.openModal(`
      <h2>批量下发任务</h2>
      <div class="form-group">
        <label>目标设备</label>
        <select id="batch-device">
          ${document.getElementById('task-device').innerHTML}
        </select>
      </div>
      <p style="margin:12px 0;font-size:13px;color:var(--text-secondary)">选择要下发的任务类型（按住 Ctrl 多选）：</p>
      <select id="batch-types" multiple style="width:100%;height:200px">
        <optgroup label="一键长草">
          <option value="LinkStart">全部长草</option>
          <option value="LinkStart-Combat">刷理智</option>
          <option value="LinkStart-Recruiting">自动公招</option>
          <option value="LinkStart-Mall">信用购物</option>
          <option value="LinkStart-Mission">每日每周</option>
          <option value="LinkStart-AutoRoguelike">集成战略</option>
          <option value="LinkStart-Reclamation">生息演算</option>
        </optgroup>
        <optgroup label="截图">
          <option value="CaptureImage">截图(排队)</option>
          <option value="CaptureImageNow">截图(立即)</option>
        </optgroup>
        <optgroup label="工具箱">
          <option value="Toolbox-GachaOnce">抽卡x1</option>
          <option value="Toolbox-GachaTenTimes">抽卡x10</option>
        </optgroup>
      </select>
      <div class="modal-actions" style="margin-top:16px">
        <button class="secondary" onclick="APP.closeModal()">取消</button>
        <button id="batch-send" onclick="TaskQueue.doBatch()">下发选中任务</button>
      </div>
    `);
    document.getElementById('batch-device').value = device;
  },

  async doBatch() {
    const device = document.getElementById('batch-device').value;
    const sel = document.getElementById('batch-types');
    const types = Array.from(sel.selectedOptions).map(o => o.value);
    if (!device) { APP.toast('请选择设备'); return; }
    if (types.length === 0) { APP.toast('请选择至少一个任务类型'); return; }
    const tasks = types.map(type => ({ device_uuid: device, type }));
    try {
      await api.createTaskBatch(tasks);
      APP.closeModal();
      this.refresh();
    } catch (e) { APP.toast('批量下发失败'); }
  },

  async applySettings() {
    const device = document.getElementById('cfg-device').value;
    const stage = document.getElementById('cfg-stage').value;
    const address = document.getElementById('cfg-address').value.trim();
    if (!device) { APP.toast('请选择目标设备'); return; }
    const tasks = [];
    if (stage) tasks.push({ device_uuid: device, type: 'Settings-Stage1', params: stage });
    if (address) tasks.push({ device_uuid: device, type: 'Settings-ConnectionAddress', params: address });
    if (tasks.length === 0) { APP.toast('请选择要修改的配置'); return; }
    try {
      await api.createTaskBatch(tasks);
      const labels = [];
      if (stage) labels.push(`关卡=${stage}`);
      if (address) labels.push(`地址=${address}`);
      APP.toast('配置已下发: ' + labels.join(', '));
      this.refresh();
    } catch (e) { APP.toast('配置下发失败'); }
  },

  async sendAllConfigured() {
    const device = document.getElementById('ls-device').value;
    if (!device) { APP.toast('请选择目标设备'); return; }
    const tasks = [];
    // Check combat stage setting
    const stageEl = document.querySelector('.cfg-sub-stage');
    if (stageEl && stageEl.value) {
      tasks.push({ device_uuid: device, type: 'Settings-Stage1', params: stageEl.value });
    }
    // Collect checked LinkStart tasks
    const types = Array.from(document.querySelectorAll('.ls-cb:checked')).map(cb => cb.dataset.type);
    types.forEach(type => tasks.push({ device_uuid: device, type }));
    if (tasks.length === 0) { APP.toast('请至少勾选一项功能'); return; }
    try {
      await api.createTaskBatch(tasks);
      const configCount = stageEl && stageEl.value ? 1 : 0;
      APP.toast(`配置${configCount}项 + ${types.length}个任务已下发`);
      this.refresh();
    } catch (e) { APP.toast('下发失败'); }
  }
};

// Auto-refresh tasks when tab active
setInterval(() => {
  if (APP.currentTab === 'tasks') TaskQueue.refresh();
}, 5000);

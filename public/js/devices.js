// Devices tab
const Devices = {
  init() {
    document.getElementById('dev-add-btn').addEventListener('click', () => this.showAddForm());
  },

  async refresh() {
    try {
      const data = await api.getDevices();
      this.renderTable(data.devices || []);
    } catch { /* */ }
  },

  renderTable(devices) {
    const tbody = document.querySelector('#devices-table tbody');
    const cards = document.getElementById('devices-cards');
    if (devices.length === 0) {
      const empty = '<tr><td colspan="8" style="text-align:center;color:var(--text-secondary)">暂无设备</td></tr>';
      tbody.innerHTML = empty;
      cards.innerHTML = '<div style="text-align:center;color:var(--text-secondary);padding:16px">暂无设备</div>';
      return;
    }
    tbody.innerHTML = devices.map(d => {
      const isOnline = d.last_seen_at ? new Date() - new Date(d.last_seen_at + 'Z') < 30000 : false;
      const safeName = APP.escapeHtml(d.name || '');
      const safeEmu = APP.escapeHtml(d.emulator_type || '');
      const safeEscName = safeName.replace(/'/g, "\\'");
      const safeEscEmu = safeEmu.replace(/'/g, "\\'");
      return `
        <tr>
          <td><span class="online-dot ${isOnline ? 'online' : 'offline'}"></span>${isOnline ? '在线' : '离线'}</td>
          <td><span class="editable-name" onclick="Devices.quickRename('${d.device_uuid}','${safeEscName}')" title="点击改名">${safeName || APP.truncate(d.device_uuid)}</span></td>
          <td><code>${APP.truncate(d.device_uuid)}</code></td>
          <td><code>${APP.truncate(d.user_uuid)}</code></td>
          <td>${safeEmu || '-'}</td>
          <td>${APP.timeAgo(d.last_seen_at)}</td>
          <td><span class="badge pending">${d.pending_count || 0}</span></td>
          <td>
            <button class="secondary" onclick="Devices.showEditForm('${d.device_uuid}', '${safeEscName}', '${safeEscEmu}')">编辑</button>
            <button class="danger" onclick="Devices.confirmDelete('${d.device_uuid}')">删除</button>
          </td>
        </tr>
      `;
    }).join('');
    // Mobile cards
    cards.innerHTML = devices.map(d => {
      const isOnline = d.last_seen_at ? new Date() - new Date(d.last_seen_at + 'Z') < 30000 : false;
      const safeName = APP.escapeHtml(d.name || '');
      const safeEmu = APP.escapeHtml(d.emulator_type || '');
      const escName = safeName.replace(/'/g, "\\'");
      const escEmu = safeEmu.replace(/'/g, "\\'");
      return `
        <div class="card-item">
          <div class="card-row">
            <span><span class="online-dot ${isOnline ? 'online' : 'offline'}"></span><span class="editable-name" onclick="Devices.quickRename('${d.device_uuid}','${escName}')">${safeName || APP.truncate(d.device_uuid)}</span></span>
            <span class="badge ${isOnline ? 'completed' : 'cancelled'}">${isOnline ? '在线' : '离线'}</span>
          </div>
          <div class="card-meta">${safeEmu || '未设置'} · ${APP.timeAgo(d.last_seen_at)}</div>
          <div class="card-actions">
            <button class="secondary" onclick="Devices.showEditForm('${d.device_uuid}', '${escName}', '${escEmu}')">编辑</button>
            <button class="danger" onclick="Devices.confirmDelete('${d.device_uuid}')">删除</button>
          </div>
        </div>
      `;
    }).join('');
  },

  quickRename(uuid, currentName) {
    const newName = prompt('设备名称:', currentName);
    if (newName === null) return;
    api.updateDevice(uuid, { name: newName }).then(() => this.refresh());
  },

  showEditForm(uuid, name, emu) {
    APP.openModal(`
      <h2>编辑设备</h2>
      <div class="form-group">
        <label>设备名称</label>
        <input type="text" id="edit-name" value="${name}">
      </div>
      <div class="form-group">
        <label>模拟器类型</label>
        <input type="text" id="edit-emu" value="${emu}" placeholder="如: MuMu, BlueStacks, LDPlayer">
      </div>
      <div class="modal-actions">
        <button class="secondary" onclick="APP.closeModal()">取消</button>
        <button id="edit-save" onclick="Devices.saveEdit('${uuid}')">保存</button>
      </div>
    `);
  },

  async saveEdit(uuid) {
    const name = document.getElementById('edit-name').value;
    const emulator_type = document.getElementById('edit-emu').value;
    await api.updateDevice(uuid, { name, emulator_type });
    APP.closeModal();
    this.refresh();
  },

  showAddForm() {
    APP.openModal(`
      <h2>手动添加设备</h2>
      <div class="form-group">
        <label>设备 UUID</label>
        <input type="text" id="add-uuid" placeholder="从 MAA 设置的设备标识符中获取">
      </div>
      <div class="form-group">
        <label>名称 (可选)</label>
        <input type="text" id="add-name" placeholder="给设备起个名字">
      </div>
      <div class="modal-actions">
        <button class="secondary" onclick="APP.closeModal()">取消</button>
        <button id="add-save" onclick="Devices.saveAdd()">添加</button>
      </div>
    `);
  },

  async saveAdd() {
    const uuid = document.getElementById('add-uuid').value.trim();
    const name = document.getElementById('add-name').value.trim();
    if (!uuid) { APP.toast('请输入设备 UUID'); return; }
    // Create a task for this device will auto-register it, so just create a dummy heartbeat
    await api.createTask({ device_uuid: uuid, type: 'HeartBeat' });
    if (name) {
      await api.updateDevice(uuid, { name });
    }
    APP.closeModal();
    this.refresh();
  },

  confirmDelete(uuid) {
    APP.openModal(`
      <h2>确认删除</h2>
      <p>删除设备将同时删除其所有任务和截图。此操作不可恢复。</p>
      <div class="modal-actions">
        <button class="secondary" onclick="APP.closeModal()">取消</button>
        <button class="danger" id="delete-confirm" onclick="Devices.doDelete('${uuid}')">确认删除</button>
      </div>
    `);
  },

  async doDelete(uuid) {
    await api.deleteDevice(uuid);
    APP.closeModal();
    this.refresh();
  }
};

// Auto-refresh devices when tab active
setInterval(() => {
  if (APP.currentTab === 'devices') Devices.refresh();
}, 5000);

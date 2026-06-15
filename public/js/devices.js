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
    if (devices.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-secondary)">暂无设备连接。在 MAA 中配置获取任务端点后自动注册。</td></tr>';
      return;
    }
    tbody.innerHTML = devices.map(d => {
      const isOnline = d.last_seen_at ? new Date() - new Date(d.last_seen_at + 'Z') < 30000 : false;
      return `
        <tr>
          <td><span class="online-dot ${isOnline ? 'online' : 'offline'}"></span>${isOnline ? '在线' : '离线'}</td>
          <td>${d.name || '-'}</td>
          <td><code>${APP.truncate(d.device_uuid)}</code></td>
          <td><code>${APP.truncate(d.user_uuid)}</code></td>
          <td>${d.emulator_type || '-'}</td>
          <td>${APP.timeAgo(d.last_seen_at)}</td>
          <td><span class="badge pending">${d.pending_count || 0}</span></td>
          <td>
            <button class="secondary" onclick="Devices.showEditForm('${d.device_uuid}', '${(d.name || '').replace(/'/g, "\\'")}', '${(d.emulator_type || '').replace(/'/g, "\\'")}')">编辑</button>
            <button class="danger" onclick="Devices.confirmDelete('${d.device_uuid}')">删除</button>
          </td>
        </tr>
      `;
    }).join('');
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
    if (!uuid) return alert('请输入设备 UUID');
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

// App shell: tab routing, auth, shared utilities
const APP = {
  currentTab: 'dashboard',
  account: null,

  init() {
    this.bindTabs();
    this.bindLogout();
    this.checkAuth();
    Dashboard.init();
    Devices.init();
    TaskQueue.init();
    Screenshots.init();
  },

  bindTabs() {
    const handler = (e) => {
      e.preventDefault();
      this.switchTab(e.target.dataset.tab || e.currentTarget.dataset.tab);
    };
    document.querySelectorAll('.nav-item').forEach(link => link.addEventListener('click', handler));
    document.querySelectorAll('.bottom-nav-item').forEach(btn => btn.addEventListener('click', handler));
    window.addEventListener('hashchange', () => {
      this.switchTab((location.hash.replace('#', '') || 'dashboard'), false);
    });
    this.switchTab((location.hash.replace('#', '') || 'dashboard'), false);
  },

  bindLogout() {
    document.getElementById('topbar-logout').addEventListener('click', () => this.doLogout());
    document.getElementById('my-logout-btn').addEventListener('click', () => this.doLogout());
  },

  async doLogout() {
    await api.logout();
    this.showLogin(true);
  },

  switchTab(tab, updateHash = true) {
    if (updateHash) location.hash = tab;
    this.currentTab = tab;
    document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(n => n.classList.toggle('active', n.dataset.tab === tab));
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.id === tab));
    if (tab === 'dashboard') Dashboard.refresh();
    if (tab === 'devices') Devices.refresh();
    if (tab === 'tasks') TaskQueue.refresh();
    if (tab === 'screenshots') Screenshots.refresh();
    if (tab === 'my') this.renderMyPage();
  },

  async changePhone() {
    const phone = prompt('请输入新手机号:');
    if (!phone) return;
    try {
      const r = await api.changePhone(phone);
      if (r.error) { APP.toast(r.error); return; }
      APP.toast('手机号已更新');
      APP.checkAuth();
    } catch { APP.toast('修改失败'); }
  },

  async rotateMaaId() {
    if (!confirm('重新生成后旧标识符立即失效，MAA 需更新用户标识符。确认？')) return;
    try {
      const r = await api.rotateMaaId();
      this.account.maa_user_id = r.maa_user_id;
      this.updateUI();
      APP.toast('新标识符: ' + r.maa_user_id);
    } catch { APP.toast('操作失败'); }
  },

  toast(msg) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => { el.remove(); }, 2000);
  },

  async checkAuth() {
    try {
      const r = await api.checkAuth();
      if (r.authenticated) {
        this.account = r;
        this.updateUI();
        document.getElementById('login-page').style.display = 'none';
        document.getElementById('app-shell').style.display = '';
      }
      // If not authenticated, login page already visible by default, don't clear it
    } catch { /* */ }
  },

  updateUI() {
    const loggedIn = this.account && this.account.username;
    document.getElementById('user-info').textContent = loggedIn ? this.account.username : '未登录';
    document.getElementById('topbar-logout').style.display = loggedIn ? '' : 'none';
    document.getElementById('my-logged-out').style.display = loggedIn ? 'none' : '';
    document.getElementById('my-logged-in').style.display = loggedIn ? '' : 'none';
    document.getElementById('my-logout-btn').style.display = loggedIn ? '' : 'none';
    if (loggedIn) {
      document.getElementById('my-username').textContent = this.account.username;
      document.getElementById('my-phone').textContent = this.account.email || '未绑定';
      document.getElementById('my-maa-id').textContent = this.account.maa_user_id || '-';
      // Admin panel
      if (this.account.role === 'admin') {
        document.getElementById('admin-panel').style.display = '';
        this.loadAdminUsers();
      }
      const statusEl = document.getElementById('my-approval-status');
      if (statusEl) {
        statusEl.textContent = this.account.approved ? '已审核' : '待审核';
        statusEl.style.color = this.account.approved ? '#0d904f' : '#e37400';
      }
    }
  },

  showLogin(clearFields = false) {
    document.getElementById('login-page').style.display = 'flex';
    document.getElementById('app-shell').style.display = 'none';
    this.account = null;
    if (clearFields) {
      document.getElementById('login-username').value = '';
      document.getElementById('login-password').value = '';
    }
  },

  closeModal() {
    document.getElementById('modal-overlay').style.display = 'none';
    document.getElementById('modal-content').innerHTML = '';
  },

  openModal(html) {
    document.getElementById('modal-content').innerHTML = html;
    document.getElementById('modal-overlay').style.display = 'flex';
    document.getElementById('modal-overlay').onclick = function(e) {
      if (e.target === this) APP.closeModal();
    };
  },

  async loadAdminUsers() {
    try {
      const r = await api.request('GET', '/api/auth/accounts');
      const users = r.accounts || [];
      document.getElementById('user-list').innerHTML = users.map(u => `
        <div class="card-item">
          <div class="card-row">
            <span><strong>${this.escapeHtml(u.username)}</strong> <span class="badge ${u.role === 'admin' ? 'completed' : 'cancelled'}">${u.role}</span></span>
            ${u.approved ? '<span class="badge SUCCESS">已审核</span>' : '<span class="badge pending">待审核</span>'}
          </div>
          <div class="card-meta">${u.maa_user_id} · ${u.created_at || ''}</div>
          <div class="card-actions">
            ${!u.approved ? `<button class="sm" onclick="APP.approveUser(${u.id})">通过审核</button>` : ''}
            ${u.role !== 'admin' ? `<button class="danger" onclick="APP.deleteUser(${u.id})">删除</button>` : ''}
          </div>
        </div>
      `).join('');
    } catch { /* */ }
  },

  async approveUser(id) {
    try {
      await api.request('POST', '/api/auth/approve/' + id);
      APP.toast('已通过审核');
      this.loadAdminUsers();
    } catch { APP.toast('操作失败'); }
  },

  async deleteUser(id) {
    if (!confirm('确认删除此用户？所有关联设备将被解绑。')) return;
    try {
      await api.request('DELETE', '/api/auth/accounts/' + id);
      APP.toast('已删除');
      this.loadAdminUsers();
    } catch { APP.toast('操作失败'); }
  },

  renderMyPage() {
    this.updateUI();
  },

  escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  },

  truncate(uuid) { return uuid ? uuid.substring(0, 8) + '...' : ''; },

  timeAgo(dateStr) {
    if (!dateStr) return '从未';
    const diff = Math.floor((new Date() - new Date(dateStr + 'Z')) / 1000);
    if (diff < 10) return '刚刚';
    if (diff < 60) return diff + '秒前';
    if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
    if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
    return Math.floor(diff / 86400) + '天前';
  },

  taskTypeLabel(type) {
    const map = {
      'LinkStart': '全部长草', 'LinkStart-Base': '基建', 'LinkStart-WakeUp': '唤醒',
      'LinkStart-Combat': '刷理智', 'LinkStart-Recruiting': '自动公招', 'LinkStart-Mall': '信用购物',
      'LinkStart-Mission': '每日每周', 'LinkStart-AutoRoguelike': '集成战略', 'LinkStart-Reclamation': '生息演算',
      'CaptureImage': '截图', 'CaptureImageNow': '立即截图',
      'Toolbox-GachaOnce': '抽卡x1', 'Toolbox-GachaTenTimes': '抽卡x10',
      'Settings-ConnectionAddress': '修改地址', 'Settings-Stage1': '修改关卡',
      'StopTask': '停止任务', 'HeartBeat': '心跳'
    };
    return map[type] || type;
  },

  typeClass(type) {
    if (type.startsWith('LinkStart')) return 'linkstart';
    if (type.startsWith('CaptureImage')) return 'capture';
    if (type.startsWith('Toolbox')) return 'toolbox';
    if (type.startsWith('Settings') || type === 'StopTask' || type === 'HeartBeat') return 'control';
    return '';
  }
};

// Auth state
let isRegistering = false;

// Send verification code
document.getElementById('send-code-btn').addEventListener('click', async () => {
  const email = document.getElementById('reg-email').value.trim();
  if (!email) { APP.toast('请先输入邮箱'); return; }
  const btn = document.getElementById('send-code-btn');
  btn.disabled = true;
  try {
    const r = await api.sendCode(email);
    if (r.error) { APP.toast(r.error); btn.disabled = false; return; }
    APP.toast('验证码已发送');
    let sec = 60;
    btn.textContent = sec + 's';
    const timer = setInterval(() => { sec--; btn.textContent = sec + 's'; if (sec <= 0) { clearInterval(timer); btn.textContent = '发送验证码'; btn.disabled = false; } }, 1000);
  } catch { APP.toast('发送失败'); btn.disabled = false; }
});

document.getElementById('toggle-reg').addEventListener('click', (e) => {
  e.preventDefault();
  isRegistering = !isRegistering;
  document.getElementById('login-subtitle').textContent = isRegistering ? '注册新账号' : '登录以管理你的设备';
  document.getElementById('login-submit').textContent = isRegistering ? '注册' : '登录';
  document.getElementById('reg-extra').style.display = isRegistering ? 'block' : 'none';
  document.getElementById('login-only').style.display = isRegistering ? 'none' : 'block';
  document.getElementById('login-username').placeholder = isRegistering ? '用户名' : '用户名 / 邮箱';
  document.getElementById('toggle-reg').textContent = isRegistering ? '已有账号？登录' : '注册新账号';
  document.getElementById('login-error').style.display = 'none';
});

document.getElementById('login-submit').addEventListener('click', async () => {
  const username = document.getElementById('login-username').value.trim();
  const passwordEl = isRegistering ? document.getElementById('login-password-reg') : document.getElementById('login-password');
  const password = passwordEl.value;
  const errEl = document.getElementById('login-error');

  if (isRegistering) {
    const email = document.getElementById('reg-email').value.trim();
    const code = document.getElementById('reg-code').value.trim();
    const confirm = document.getElementById('reg-confirm').value;
    if (!email) { errEl.textContent = '请输入邮箱'; errEl.style.display = 'block'; return; }
    if (!code) { errEl.textContent = '请输入验证码'; errEl.style.display = 'block'; return; }
    if (password !== confirm) { errEl.textContent = '两次密码不一致'; errEl.style.display = 'block'; return; }
    const r = await api.register(username, password, email, code);
    if (r.error) { errEl.textContent = r.error; errEl.style.display = 'block'; return; }
    errEl.style.color = 'green'; errEl.textContent = '注册成功！等待管理员审核通过后即可使用。'; errEl.style.display = 'block';
    isRegistering = false;
    document.getElementById('reg-email').value = '';
    document.getElementById('reg-code').value = '';
    document.getElementById('login-password-reg').value = '';
    document.getElementById('reg-confirm').value = '';
    document.getElementById('login-submit').textContent = '登录';
    document.getElementById('reg-extra').style.display = 'none';
    document.getElementById('login-only').style.display = 'block';
    document.getElementById('login-username').placeholder = '用户名 / 邮箱';
    document.getElementById('toggle-reg').textContent = '注册新账号';
    document.getElementById('login-subtitle').textContent = '登录以管理你的设备';
    return;
  }

  const remember = document.getElementById('login-remember').checked;
  const r = await api.login(username, password, remember);
  if (r.authenticated) {
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('app-shell').style.display = '';
    APP.checkAuth();
  } else {
    errEl.textContent = r.error || '登录失败';
    errEl.style.display = 'block';
    errEl.style.color = 'red';
  }
});

document.addEventListener('DOMContentLoaded', () => APP.init());

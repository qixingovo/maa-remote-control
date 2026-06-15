// App shell: tab routing, auth, shared utilities
const APP = {
  currentTab: 'dashboard',

  init() {
    this.bindTabs();
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

  switchTab(tab, updateHash = true) {
    if (updateHash) location.hash = tab;
    this.currentTab = tab;
    document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(n => n.classList.toggle('active', n.dataset.tab === tab));
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.id === tab));
    if (tab === 'dashboard') Dashboard.refresh();
    if (tab === 'devices') Devices.refresh();
    if (tab === 'tasks') TaskQueue.refresh();
    if (tab === 'screenshots') Screenshots.refresh();
  },

  async rotateMaaId() {
    if (!confirm('重新生成 MAA 标识符后，旧标识符将立即失效。MAA 客户端需要更新用户标识符。确认？')) return;
    try {
      const r = await api.rotateMaaId();
      APP.toast('新标识符: ' + r.maa_user_id);
      APP.checkAuth();
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
      if (!r.authenticated) {
        this.showLogin();
      } else {
        document.getElementById('login-overlay').style.display = 'none';
        if (r.maa_user_id) {
          document.getElementById('auth-status').innerHTML = `${r.username || ''} | MAA: <code>${r.maa_user_id}</code> <button class=\"sm secondary\" onclick=\"APP.rotateMaaId()\">换号</button>`;
        } else {
          document.getElementById('auth-status').textContent = r.username || '';
        }
      }
    } catch { /* server not ready yet */ }
  },

  showLogin() {
    document.getElementById('login-overlay').style.display = 'flex';
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

  truncate(uuid) {
    return uuid ? uuid.substring(0, 8) + '...' : '';
  },

  timeAgo(dateStr) {
    if (!dateStr) return '从未';
    const now = new Date();
    const date = new Date(dateStr + 'Z');
    const diff = Math.floor((now - date) / 1000);
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

document.getElementById('toggle-reg').addEventListener('click', (e) => {
  e.preventDefault();
  isRegistering = !isRegistering;
  document.getElementById('auth-title').textContent = isRegistering ? '注册' : '登录';
  document.getElementById('login-submit').textContent = isRegistering ? '注册' : '登录';
  document.getElementById('reg-extra').style.display = isRegistering ? 'block' : 'none';
  document.getElementById('toggle-reg').textContent = isRegistering ? '已有账号？登录' : '注册新账号';
  document.getElementById('login-username').style.display = isRegistering ? 'block' : 'block';
  document.getElementById('login-error').style.display = 'none';
});

document.getElementById('login-submit').addEventListener('click', async () => {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');

  if (isRegistering) {
    const confirm = document.getElementById('reg-confirm').value;
    if (password !== confirm) { errEl.textContent = '两次密码不一致'; errEl.style.display = 'block'; return; }
    const r = await api.register(username, password);
    if (r.error) { errEl.textContent = r.error; errEl.style.display = 'block'; return; }
    // Show MAA user ID
    errEl.style.color = 'green'; errEl.textContent = '注册成功！MAA标识符: ' + r.maa_user_id; errEl.style.display = 'block';
    isRegistering = false;
    document.getElementById('auth-title').textContent = '登录';
    document.getElementById('login-submit').textContent = '登录';
    document.getElementById('reg-extra').style.display = 'none';
    document.getElementById('toggle-reg').textContent = '注册新账号';
    return;
  }

  const r = await api.login(username, password);
  if (r.authenticated) {
    document.getElementById('login-overlay').style.display = 'none';
    APP.checkAuth();
    if (r.maa_user_id) {
      document.getElementById('auth-status').innerHTML = `${r.username} | MAA: <code>${r.maa_user_id}</code> <button class=\"sm secondary\" onclick=\"APP.rotateMaaId()\" title=\"重新生成\">换号</button>`;
    } else {
      document.getElementById('auth-status').textContent = r.username || '';
    }
  } else {
    errEl.textContent = r.error || '登录失败';
    errEl.style.display = 'block';
    errEl.style.color = 'red';
  }
});

document.addEventListener('DOMContentLoaded', () => APP.init());

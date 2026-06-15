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
        document.getElementById('auth-status').textContent = '';
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

// Login
document.getElementById('login-submit').addEventListener('click', async () => {
  const pw = document.getElementById('login-password').value;
  const r = await api.login(pw);
  if (r.authenticated) {
    document.getElementById('login-overlay').style.display = 'none';
    APP.checkAuth();
  } else {
    document.getElementById('login-error').style.display = 'block';
  }
});

document.addEventListener('DOMContentLoaded', () => APP.init());

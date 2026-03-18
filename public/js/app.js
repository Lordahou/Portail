/* ============================================================
   Portail Mairie - Application principale
   ============================================================ */

const App = (() => {
  // --- State ---
  let currentUser = null;
  let currentPage = 'dashboard';

  // --- API Helper ---
  async function api(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    // Handle FormData - remove Content-Type to let browser set boundary
    if (options.body instanceof FormData) {
      delete headers['Content-Type'];
    }

    try {
      const res = await fetch(`/api${endpoint}`, {
        ...options,
        headers,
        body: options.body instanceof FormData ? options.body : (options.body ? JSON.stringify(options.body) : undefined)
      });

      if (res.status === 401) {
        logout();
        return null;
      }

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || data.error || `Erreur ${res.status}`);
      }

      return data;
    } catch (err) {
      if (err.message === 'Failed to fetch') {
        throw new Error('Impossible de contacter le serveur');
      }
      throw err;
    }
  }

  // --- Toast System ---
  function toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const icons = { success: '\u2705', error: '\u274C', warning: '\u26A0\uFE0F', info: '\u2139\uFE0F' };
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-msg">${message}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">\u00D7</button>
    `;
    container.appendChild(el);
    setTimeout(() => {
      el.classList.add('removing');
      setTimeout(() => el.remove(), 250);
    }, 4000);
  }

  // --- Modal System ---
  function openModal(id) {
    const overlay = document.getElementById(id);
    if (overlay) overlay.classList.add('active');
  }

  function closeModal(id) {
    const overlay = document.getElementById(id);
    if (overlay) overlay.classList.remove('active');
  }

  function closeAllModals() {
    document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
  }

  async function confirmDialog(message) {
    return new Promise((resolve) => {
      const overlay = document.getElementById('confirm-modal');
      document.getElementById('confirm-message').textContent = message;
      const btnOk = document.getElementById('confirm-ok');
      const btnCancel = document.getElementById('confirm-cancel');

      function cleanup() {
        overlay.classList.remove('active');
        btnOk.removeEventListener('click', onOk);
        btnCancel.removeEventListener('click', onCancel);
      }
      function onOk() { cleanup(); resolve(true); }
      function onCancel() { cleanup(); resolve(false); }

      btnOk.addEventListener('click', onOk);
      btnCancel.addEventListener('click', onCancel);
      overlay.classList.add('active');
    });
  }

  // --- Date Formatting ---
  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function formatDateISO(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return '';
    return d.toISOString().slice(0, 10);
  }

  function formatDateLong(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  // --- Auth ---
  async function login(username, password) {
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: { login: username, password }
      });
      if (data && data.token) {
        localStorage.setItem('token', data.token);
        currentUser = data.user || { login: username };
        localStorage.setItem('user', JSON.stringify(currentUser));
        showApp();
        toast('Bienvenue !', 'success');
        return true;
      }
      return false;
    } catch (err) {
      throw err;
    }
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    currentUser = null;
    showLogin();
  }

  function checkSession() {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      try {
        currentUser = JSON.parse(userStr);
        return true;
      } catch (e) {
        return false;
      }
    }
    return false;
  }

  function getUser() { return currentUser; }

  // --- Navigation ---
  function navigate(page) {
    currentPage = page;

    // Update sidebar active
    document.querySelectorAll('.sidebar-nav a').forEach(a => {
      a.classList.toggle('active', a.dataset.page === page);
    });

    // Show/hide pages
    document.querySelectorAll('.page').forEach(p => {
      p.classList.toggle('active', p.id === `page-${page}`);
    });

    // Update topbar title
    const titles = {
      dashboard: 'Tableau de bord',
      courriers: 'Gestion des courriers',
      conseil: 'Conseil municipal',
      demandes: 'Demandes des habitants',
      reservations: 'R\u00e9servations de salles',
      documents: 'Documents',
      ai: 'Assistant IA',
      admin: 'Administration'
    };
    document.getElementById('page-title').textContent = titles[page] || page;

    // Close mobile sidebar
    document.querySelector('.sidebar').classList.remove('open');
    document.querySelector('.sidebar-overlay').classList.remove('active');

    // Initialize module
    const modules = {
      dashboard: () => typeof Dashboard !== 'undefined' && Dashboard.init(),
      courriers: () => typeof Courriers !== 'undefined' && Courriers.init(),
      conseil: () => typeof Conseil !== 'undefined' && Conseil.init(),
      demandes: () => typeof Demandes !== 'undefined' && Demandes.init(),
      reservations: () => typeof Reservations !== 'undefined' && Reservations.init(),
      documents: () => typeof Documents !== 'undefined' && Documents.init(),
      ai: () => typeof AI !== 'undefined' && AI.init(),
      admin: () => typeof Admin !== 'undefined' && Admin.init(),
    };
    if (modules[page]) modules[page]();
  }

  // --- UI switching ---
  function showLogin() {
    document.getElementById('login-page').style.display = 'flex';
    document.getElementById('app-layout').classList.add('hidden');
  }

  function showApp() {
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('app-layout').classList.remove('hidden');
    updateUserInfo();
    navigate(currentPage);
  }

  function updateUserInfo() {
    if (currentUser) {
      const initials = (currentUser.nom || currentUser.login || 'U').substring(0, 2).toUpperCase();
      document.getElementById('user-avatar').textContent = initials;
      document.getElementById('user-name').textContent = currentUser.nom || currentUser.login || 'Utilisateur';
    }
  }

  // --- Init ---
  function init() {
    // Login form
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;
      const errorEl = document.getElementById('login-error');
      errorEl.style.display = 'none';

      if (!username || !password) {
        errorEl.textContent = 'Veuillez remplir tous les champs.';
        errorEl.style.display = 'block';
        return;
      }

      try {
        const ok = await login(username, password);
        if (!ok) {
          errorEl.textContent = 'Identifiants incorrects.';
          errorEl.style.display = 'block';
        }
      } catch (err) {
        errorEl.textContent = err.message || 'Erreur de connexion.';
        errorEl.style.display = 'block';
      }
    });

    // Sidebar navigation
    document.querySelectorAll('.sidebar-nav a[data-page]').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(a.dataset.page);
      });
    });

    // Logout
    document.getElementById('btn-logout').addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });

    // Hamburger menu
    document.querySelector('.hamburger').addEventListener('click', () => {
      document.querySelector('.sidebar').classList.add('open');
      document.querySelector('.sidebar-overlay').classList.add('active');
    });
    document.querySelector('.close-sidebar').addEventListener('click', () => {
      document.querySelector('.sidebar').classList.remove('open');
      document.querySelector('.sidebar-overlay').classList.remove('active');
    });
    document.querySelector('.sidebar-overlay').addEventListener('click', () => {
      document.querySelector('.sidebar').classList.remove('open');
      document.querySelector('.sidebar-overlay').classList.remove('active');
    });

    // Close modals on overlay click
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
      }
    });

    // Check session
    if (checkSession()) {
      showApp();
    } else {
      showLogin();
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    api,
    toast,
    openModal,
    closeModal,
    closeAllModals,
    confirmDialog,
    formatDate,
    formatDateTime,
    formatDateISO,
    formatDateLong,
    navigate,
    getUser,
    logout
  };
})();

/* ============================================================
   Module Administration
   ============================================================ */

const Admin = (() => {
  let users = [];
  let logs = [];

  async function init() {
    setupEvents();
    await Promise.all([loadUsers(), loadLogs()]);
  }

  function setupEvents() {
    const form = document.getElementById('user-form');
    if (form.dataset.bound) return;
    form.dataset.bound = 'true';

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveUser();
    });

    document.getElementById('logs-filter-btn')?.addEventListener('click', loadLogs);
  }

  // ===== Utilisateurs =====
  async function loadUsers() {
    try {
      const data = await App.api('/users');
      users = data?.users || data || [];
    } catch {
      users = [];
    }
    renderUsers();
  }

  function renderUsers() {
    const tbody = document.getElementById('users-tbody');
    if (!users.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state">
        <div class="empty-icon">\u{1F464}</div>
        <p>Aucun utilisateur</p>
      </td></tr>`;
      return;
    }
    tbody.innerHTML = users.map(u => `
      <tr>
        <td><strong>${esc(u.nom || u.name || '')}</strong></td>
        <td>${esc(u.login || u.username || '')}</td>
        <td><span class="badge ${u.role === 'admin' ? 'badge-purple' : 'badge-blue'}">${u.role === 'admin' ? 'Administrateur' : 'Secr\u00e9taire'}</span></td>
        <td>${App.formatDate(u.created_at || u.date_creation)}</td>
        <td class="table-actions">
          <button class="btn btn-ghost btn-sm" onclick="Admin.editUser('${u.id}')" title="Modifier">\u270F\uFE0F</button>
          <button class="btn btn-ghost btn-sm" onclick="Admin.removeUser('${u.id}')" title="Supprimer">\u{1F5D1}\uFE0F</button>
        </td>
      </tr>
    `).join('');
  }

  function openNewUser() {
    document.getElementById('user-modal-title').textContent = 'Nouvel utilisateur';
    document.getElementById('user-form').reset();
    document.getElementById('user-id').value = '';
    document.getElementById('user-password').required = true;
    document.getElementById('user-password-hint').style.display = 'none';
    App.openModal('user-modal');
  }

  function editUser(id) {
    const u = users.find(x => String(x.id) === String(id));
    if (!u) return;
    document.getElementById('user-modal-title').textContent = 'Modifier l\u2019utilisateur';
    document.getElementById('user-id').value = u.id;
    document.getElementById('user-nom').value = u.nom || u.name || '';
    document.getElementById('user-login').value = u.login || u.username || '';
    document.getElementById('user-password').value = '';
    document.getElementById('user-password').required = false;
    document.getElementById('user-password-hint').style.display = 'block';
    document.getElementById('user-role').value = u.role || 'secretaire';
    App.openModal('user-modal');
  }

  async function saveUser() {
    const id = document.getElementById('user-id').value;
    const body = {
      nom: document.getElementById('user-nom').value,
      login: document.getElementById('user-login').value,
      role: document.getElementById('user-role').value,
    };
    const pw = document.getElementById('user-password').value;
    if (pw) body.password = pw;

    try {
      if (id) {
        await App.api(`/users/${id}`, { method: 'PUT', body });
        App.toast('Utilisateur mis \u00e0 jour', 'success');
      } else {
        if (!pw) {
          App.toast('Le mot de passe est obligatoire', 'warning');
          return;
        }
        await App.api('/users', { method: 'POST', body });
        App.toast('Utilisateur cr\u00e9\u00e9', 'success');
      }
      App.closeModal('user-modal');
      await loadUsers();
    } catch (err) {
      App.toast(err.message || 'Erreur', 'error');
    }
  }

  async function removeUser(id) {
    const ok = await App.confirmDialog('Supprimer cet utilisateur ?');
    if (!ok) return;
    try {
      await App.api(`/users/${id}`, { method: 'DELETE' });
      App.toast('Utilisateur supprim\u00e9', 'success');
      await loadUsers();
    } catch (err) {
      App.toast(err.message || 'Erreur', 'error');
    }
  }

  // ===== Journaux d'activit\u00e9 =====
  async function loadLogs() {
    const dateFrom = document.getElementById('logs-date-from')?.value || '';
    const dateTo = document.getElementById('logs-date-to')?.value || '';

    let params = new URLSearchParams();
    if (dateFrom) params.append('date_from', dateFrom);
    if (dateTo) params.append('date_to', dateTo);

    try {
      const data = await App.api(`/logs?${params}`);
      logs = data?.logs || data || [];
    } catch {
      logs = [];
    }
    renderLogs();
  }

  function renderLogs() {
    const tbody = document.getElementById('logs-tbody');
    if (!logs.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty-state">
        <div class="empty-icon">\u{1F4CB}</div>
        <p>Aucun journal d\u2019activit\u00e9</p>
      </td></tr>`;
      return;
    }
    tbody.innerHTML = logs.map(l => `
      <tr>
        <td>${App.formatDateTime(l.date || l.created_at)}</td>
        <td>${esc(l.user || l.utilisateur || '-')}</td>
        <td>${esc(l.action || '')}</td>
        <td style="font-size:.82rem;color:var(--text-light);">${esc(l.details || '')}</td>
      </tr>
    `).join('');
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  return { init, openNewUser, editUser, removeUser };
})();

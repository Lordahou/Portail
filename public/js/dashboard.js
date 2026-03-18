/* ============================================================
   Module Tableau de bord
   ============================================================ */

const Dashboard = (() => {
  async function init() {
    loadStats();
    loadTasks();
    loadActivity();
  }

  async function loadStats() {
    try {
      const [courriers, demandes, reservations, conseil] = await Promise.all([
        App.api('/courriers?limit=0').catch(() => null),
        App.api('/demandes?statut=en_cours').catch(() => null),
        App.api('/reservations?date=' + new Date().toISOString().slice(0, 10)).catch(() => null),
        App.api('/conseil?limit=1&statut=programme').catch(() => null),
      ]);

      const courrierCount = courriers?.total ?? courriers?.length ?? 0;
      const demandesCount = demandes?.total ?? demandes?.length ?? 0;
      const resaCount = reservations?.total ?? reservations?.length ?? 0;
      const prochaine = conseil?.data?.[0] || conseil?.[0];

      document.getElementById('stat-courriers').textContent = courrierCount;
      document.getElementById('stat-demandes').textContent = demandesCount;
      document.getElementById('stat-reservations').textContent = resaCount;
      document.getElementById('stat-conseil').textContent = prochaine
        ? App.formatDate(prochaine.date)
        : 'Aucune';
    } catch (err) {
      // Fallback : afficher des tirets
      document.getElementById('stat-courriers').textContent = '-';
      document.getElementById('stat-demandes').textContent = '-';
      document.getElementById('stat-reservations').textContent = '-';
      document.getElementById('stat-conseil').textContent = '-';
    }
  }

  async function loadTasks() {
    const container = document.getElementById('task-list');
    try {
      const data = await App.api('/tasks');
      const tasks = data?.tasks || data || [];
      renderTasks(tasks);
    } catch {
      renderTasks([]);
    }
  }

  function renderTasks(tasks) {
    const container = document.getElementById('task-list');
    if (!tasks.length) {
      container.innerHTML = '<p style="color:var(--text-lighter);font-size:.88rem;padding:.5rem 0;">Aucune t\u00e2che pour le moment.</p>';
      return;
    }
    container.innerHTML = tasks.map((t, i) => `
      <div class="task-item ${t.completed ? 'completed' : ''}" data-id="${t.id || i}">
        <input type="checkbox" ${t.completed ? 'checked' : ''} onchange="Dashboard.toggleTask('${t.id || i}', this.checked)">
        <span class="task-text">${escapeHtml(t.text || t.title || '')}</span>
        <button class="task-delete" onclick="Dashboard.deleteTask('${t.id || i}')" title="Supprimer">\u00D7</button>
      </div>
    `).join('');
  }

  async function addTask() {
    const input = document.getElementById('new-task-input');
    const text = input.value.trim();
    if (!text) return;
    try {
      await App.api('/tasks', { method: 'POST', body: { text } });
      input.value = '';
      loadTasks();
    } catch {
      // Fallback local
      const container = document.getElementById('task-list');
      const id = Date.now();
      const div = document.createElement('div');
      div.className = 'task-item';
      div.dataset.id = id;
      div.innerHTML = `
        <input type="checkbox" onchange="Dashboard.toggleTask('${id}', this.checked)">
        <span class="task-text">${escapeHtml(text)}</span>
        <button class="task-delete" onclick="Dashboard.deleteTask('${id}')">\u00D7</button>
      `;
      if (container.querySelector('p')) container.innerHTML = '';
      container.appendChild(div);
      input.value = '';
    }
  }

  async function toggleTask(id, completed) {
    try {
      await App.api(`/tasks/${id}`, { method: 'PUT', body: { completed } });
    } catch {}
    const item = document.querySelector(`.task-item[data-id="${id}"]`);
    if (item) item.classList.toggle('completed', completed);
  }

  async function deleteTask(id) {
    try {
      await App.api(`/tasks/${id}`, { method: 'DELETE' });
    } catch {}
    const item = document.querySelector(`.task-item[data-id="${id}"]`);
    if (item) item.remove();
  }

  async function loadActivity() {
    const container = document.getElementById('activity-feed');
    try {
      const data = await App.api('/activity?limit=10');
      const activities = data?.activities || data || [];
      if (!activities.length) {
        container.innerHTML = '<p style="color:var(--text-lighter);font-size:.88rem;padding:.5rem 0;">Aucune activit\u00e9 r\u00e9cente.</p>';
        return;
      }
      container.innerHTML = activities.map(a => `
        <div class="activity-item">
          <div class="act-icon">${getActivityIcon(a.type || a.action)}</div>
          <div>
            <div class="act-text">${escapeHtml(a.description || a.message || a.action || '')}</div>
            <div class="act-date">${App.formatDateTime(a.date || a.created_at)}</div>
          </div>
        </div>
      `).join('');
    } catch {
      container.innerHTML = '<p style="color:var(--text-lighter);font-size:.88rem;padding:.5rem 0;">Aucune activit\u00e9 r\u00e9cente.</p>';
    }
  }

  function getActivityIcon(type) {
    const icons = {
      courrier: '\u2709\uFE0F',
      demande: '\u{1F4CB}',
      reservation: '\u{1F4C5}',
      conseil: '\u{1F3DB}\uFE0F',
      document: '\u{1F4C4}',
      user: '\u{1F464}',
    };
    return icons[type] || '\u{1F4CC}';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { init, addTask, toggleTask, deleteTask };
})();

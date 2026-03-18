/* ============================================================
   Module Conseil Municipal
   ============================================================ */

const Conseil = (() => {
  let sessions = [];
  let currentSession = null;

  async function init() {
    setupEvents();
    await loadSessions();
  }

  function setupEvents() {
    const form = document.getElementById('session-form');
    if (form.dataset.bound) return;
    form.dataset.bound = 'true';

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveSession();
    });

    document.getElementById('agenda-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveAgendaItem();
    });
  }

  async function loadSessions() {
    try {
      const data = await App.api('/conseil');
      sessions = data?.sessions || data || [];
      renderSessions();
    } catch (err) {
      App.toast('Erreur lors du chargement des s\u00e9ances', 'error');
      sessions = [];
      renderSessions();
    }
  }

  function renderSessions() {
    const container = document.getElementById('sessions-list');
    if (!sessions.length) {
      container.innerHTML = `<div class="empty-state">
        <div class="empty-icon">\u{1F3DB}\uFE0F</div>
        <p>Aucune s\u00e9ance programm\u00e9e</p>
      </div>`;
      return;
    }
    container.innerHTML = sessions.map(s => {
      const statusBadge = getStatusBadge(s.statut);
      return `
        <div class="card" style="cursor:pointer;" onclick="Conseil.viewSession('${s.id}')">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem;">
            <div>
              <h3 style="font-size:1rem;margin-bottom:.25rem;">${esc(s.type || 'S\u00e9ance')} \u2014 ${App.formatDateLong(s.date)}</h3>
              <p style="font-size:.82rem;color:var(--text-light);">${esc(s.lieu || '')}</p>
            </div>
            <div style="display:flex;align-items:center;gap:.5rem;">
              ${statusBadge}
              <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();Conseil.editSession('${s.id}')" title="Modifier">\u270F\uFE0F</button>
              <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();Conseil.removeSession('${s.id}')" title="Supprimer">\u{1F5D1}\uFE0F</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function getStatusBadge(statut) {
    const map = {
      programme: '<span class="badge badge-blue">Programm\u00e9</span>',
      en_cours: '<span class="badge badge-orange">En cours</span>',
      termine: '<span class="badge badge-green">Termin\u00e9</span>',
    };
    return map[statut] || `<span class="badge badge-gray">${esc(statut || 'Inconnu')}</span>`;
  }

  function openNew() {
    document.getElementById('session-modal-title').textContent = 'Nouvelle s\u00e9ance';
    document.getElementById('session-form').reset();
    document.getElementById('session-id').value = '';
    App.openModal('session-modal');
  }

  function editSession(id) {
    const s = sessions.find(x => String(x.id) === String(id));
    if (!s) return;
    document.getElementById('session-modal-title').textContent = 'Modifier la s\u00e9ance';
    document.getElementById('session-id').value = s.id;
    document.getElementById('session-type').value = s.type || 'ordinaire';
    document.getElementById('session-date').value = App.formatDateISO(s.date);
    document.getElementById('session-heure').value = s.heure || '';
    document.getElementById('session-lieu').value = s.lieu || '';
    document.getElementById('session-statut').value = s.statut || 'programme';
    App.openModal('session-modal');
  }

  async function saveSession() {
    const id = document.getElementById('session-id').value;
    const body = {
      type: document.getElementById('session-type').value,
      date: document.getElementById('session-date').value,
      heure: document.getElementById('session-heure').value,
      lieu: document.getElementById('session-lieu').value,
      statut: document.getElementById('session-statut').value,
    };

    try {
      if (id) {
        await App.api(`/conseil/${id}`, { method: 'PUT', body });
        App.toast('S\u00e9ance mise \u00e0 jour', 'success');
      } else {
        await App.api('/conseil', { method: 'POST', body });
        App.toast('S\u00e9ance cr\u00e9\u00e9e', 'success');
      }
      App.closeModal('session-modal');
      await loadSessions();
    } catch (err) {
      App.toast(err.message || 'Erreur lors de l\u2019enregistrement', 'error');
    }
  }

  async function removeSession(id) {
    const ok = await App.confirmDialog('Supprimer cette s\u00e9ance et son ordre du jour ?');
    if (!ok) return;
    try {
      await App.api(`/conseil/${id}`, { method: 'DELETE' });
      App.toast('S\u00e9ance supprim\u00e9e', 'success');
      await loadSessions();
    } catch (err) {
      App.toast(err.message || 'Erreur lors de la suppression', 'error');
    }
  }

  async function viewSession(id) {
    try {
      const data = await App.api(`/conseil/${id}`);
      currentSession = data?.session || data;
      if (!currentSession) throw new Error('S\u00e9ance introuvable');
      renderSessionDetail();
      App.openModal('session-detail-modal');
    } catch (err) {
      // Fallback: use local data
      currentSession = sessions.find(x => String(x.id) === String(id));
      if (currentSession) {
        if (!currentSession.points) currentSession.points = [];
        renderSessionDetail();
        App.openModal('session-detail-modal');
      } else {
        App.toast('Impossible de charger la s\u00e9ance', 'error');
      }
    }
  }

  function renderSessionDetail() {
    const s = currentSession;
    if (!s) return;

    document.getElementById('session-detail-title').textContent =
      `${s.type || 'S\u00e9ance'} \u2014 ${App.formatDateLong(s.date)}`;

    document.getElementById('session-detail-info').innerHTML = `
      <p><strong>Lieu :</strong> ${esc(s.lieu || '-')}</p>
      <p><strong>Heure :</strong> ${esc(s.heure || '-')}</p>
      <p><strong>Statut :</strong> ${getStatusBadge(s.statut)}</p>
    `;

    renderAgenda();
  }

  function renderAgenda() {
    const points = currentSession?.points || [];
    const container = document.getElementById('agenda-list');

    if (!points.length) {
      container.innerHTML = '<p style="color:var(--text-lighter);font-size:.88rem;">Aucun point \u00e0 l\u2019ordre du jour.</p>';
      return;
    }

    container.innerHTML = points.map((p, i) => `
      <div class="task-item" data-index="${i}" draggable="true"
           ondragstart="Conseil.dragStart(event, ${i})"
           ondragover="event.preventDefault()"
           ondrop="Conseil.drop(event, ${i})">
        <span style="font-weight:700;color:var(--text-light);min-width:1.5rem;">${i + 1}.</span>
        <span class="task-text">${esc(p.titre || p.title || '')}</span>
        <button class="btn btn-ghost btn-sm" onclick="Conseil.editAgendaItem(${i})" title="Modifier">\u270F\uFE0F</button>
        <button class="task-delete" onclick="Conseil.removeAgendaItem(${i})" title="Supprimer">\u00D7</button>
      </div>
    `).join('');
  }

  // Drag & drop reordering
  let dragIndex = null;
  function dragStart(e, index) { dragIndex = index; e.dataTransfer.effectAllowed = 'move'; }
  async function drop(e, targetIndex) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === targetIndex) return;
    const points = currentSession.points || [];
    const [item] = points.splice(dragIndex, 1);
    points.splice(targetIndex, 0, item);
    currentSession.points = points;
    renderAgenda();
    // Persist
    try {
      await App.api(`/conseil/${currentSession.id}/points/reorder`, {
        method: 'PUT',
        body: { points: points.map((p, i) => ({ ...p, ordre: i })) }
      });
    } catch {}
    dragIndex = null;
  }

  function openAddAgendaItem() {
    document.getElementById('agenda-modal-title').textContent = 'Ajouter un point';
    document.getElementById('agenda-form').reset();
    document.getElementById('agenda-item-index').value = '';
    App.openModal('agenda-modal');
  }

  function editAgendaItem(index) {
    const p = currentSession?.points?.[index];
    if (!p) return;
    document.getElementById('agenda-modal-title').textContent = 'Modifier le point';
    document.getElementById('agenda-item-index').value = index;
    document.getElementById('agenda-item-titre').value = p.titre || p.title || '';
    document.getElementById('agenda-item-description').value = p.description || '';
    document.getElementById('agenda-item-rapporteur').value = p.rapporteur || '';
    App.openModal('agenda-modal');
  }

  async function saveAgendaItem() {
    const index = document.getElementById('agenda-item-index').value;
    const item = {
      titre: document.getElementById('agenda-item-titre').value,
      description: document.getElementById('agenda-item-description').value,
      rapporteur: document.getElementById('agenda-item-rapporteur').value,
    };

    if (!currentSession.points) currentSession.points = [];

    try {
      if (index !== '') {
        // Update
        await App.api(`/conseil/${currentSession.id}/points/${index}`, { method: 'PUT', body: item });
        currentSession.points[parseInt(index)] = { ...currentSession.points[parseInt(index)], ...item };
      } else {
        // Add
        const result = await App.api(`/conseil/${currentSession.id}/points`, { method: 'POST', body: item });
        currentSession.points.push(result?.point || item);
      }
      App.toast('Point enregistr\u00e9', 'success');
    } catch {
      // Fallback local
      if (index !== '') {
        currentSession.points[parseInt(index)] = { ...currentSession.points[parseInt(index)], ...item };
      } else {
        currentSession.points.push(item);
      }
    }

    App.closeModal('agenda-modal');
    renderAgenda();
  }

  async function removeAgendaItem(index) {
    const ok = await App.confirmDialog('Supprimer ce point de l\u2019ordre du jour ?');
    if (!ok) return;
    try {
      await App.api(`/conseil/${currentSession.id}/points/${index}`, { method: 'DELETE' });
    } catch {}
    currentSession.points.splice(index, 1);
    renderAgenda();
    App.toast('Point supprim\u00e9', 'success');
  }

  async function generatePdf(type) {
    if (!currentSession) return;
    try {
      const token = localStorage.getItem('token');
      const link = document.createElement('a');
      link.href = `/api/conseil/${currentSession.id}/pdf?type=${type}&token=${token}`;
      link.download = `${type}_${currentSession.id}.pdf`;
      link.click();
    } catch {
      App.toast('Erreur lors de la g\u00e9n\u00e9ration du PDF', 'error');
    }
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  return {
    init, openNew, editSession, removeSession, viewSession,
    openAddAgendaItem, editAgendaItem, removeAgendaItem,
    generatePdf, dragStart, drop
  };
})();

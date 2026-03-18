/* ============================================================
   Module Courriers
   ============================================================ */

const Courriers = (() => {
  let courriers = [];

  async function init() {
    setupEvents();
    await loadCourriers();
  }

  function setupEvents() {
    // Avoid double-binding
    const form = document.getElementById('courrier-form');
    if (form.dataset.bound) return;
    form.dataset.bound = 'true';

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveCourrier();
    });

    document.getElementById('courrier-search-btn')?.addEventListener('click', loadCourriers);
    document.getElementById('courrier-search')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') loadCourriers();
    });
  }

  async function loadCourriers() {
    const search = document.getElementById('courrier-search')?.value || '';
    const type = document.getElementById('courrier-filter-type')?.value || '';
    const dateFrom = document.getElementById('courrier-date-from')?.value || '';
    const dateTo = document.getElementById('courrier-date-to')?.value || '';

    let params = new URLSearchParams();
    if (search) params.append('search', search);
    if (type) params.append('type', type);
    if (dateFrom) params.append('date_from', dateFrom);
    if (dateTo) params.append('date_to', dateTo);

    try {
      const data = await App.api(`/courriers?${params}`);
      courriers = data?.courriers || data || [];
      renderList();
    } catch (err) {
      App.toast('Erreur lors du chargement des courriers', 'error');
      courriers = [];
      renderList();
    }
  }

  function renderList() {
    const tbody = document.getElementById('courriers-tbody');
    if (!courriers.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state">
        <div class="empty-icon">\u2709\uFE0F</div>
        <p>Aucun courrier trouv\u00e9</p>
      </td></tr>`;
      return;
    }
    tbody.innerHTML = courriers.map(c => `
      <tr>
        <td><strong>${esc(c.reference || c.id || '')}</strong></td>
        <td>${App.formatDate(c.date)}</td>
        <td><span class="badge ${c.type === 'entrant' ? 'badge-blue' : 'badge-purple'}">${c.type === 'entrant' ? 'Entrant' : 'Sortant'}</span></td>
        <td>${esc(c.objet || '')}</td>
        <td>${esc(c.type === 'entrant' ? (c.expediteur || '') : (c.destinataire || ''))}</td>
        <td class="table-actions">
          <button class="btn btn-ghost btn-sm" onclick="Courriers.view('${c.id}')" title="Voir">\u{1F441}\uFE0F</button>
          <button class="btn btn-ghost btn-sm" onclick="Courriers.edit('${c.id}')" title="Modifier">\u270F\uFE0F</button>
          <button class="btn btn-ghost btn-sm" onclick="Courriers.downloadPdf('${c.id}')" title="T\u00e9l\u00e9charger PDF">\u{1F4E5}</button>
          <button class="btn btn-ghost btn-sm" onclick="Courriers.remove('${c.id}')" title="Supprimer">\u{1F5D1}\uFE0F</button>
        </td>
      </tr>
    `).join('');
  }

  function openNew() {
    document.getElementById('courrier-modal-title').textContent = 'Nouveau courrier';
    document.getElementById('courrier-form').reset();
    document.getElementById('courrier-id').value = '';
    App.openModal('courrier-modal');
  }

  function edit(id) {
    const c = courriers.find(x => String(x.id) === String(id));
    if (!c) return;
    document.getElementById('courrier-modal-title').textContent = 'Modifier le courrier';
    document.getElementById('courrier-id').value = c.id;
    document.getElementById('courrier-type').value = c.type || 'entrant';
    document.getElementById('courrier-objet').value = c.objet || '';
    document.getElementById('courrier-expediteur').value = c.expediteur || '';
    document.getElementById('courrier-destinataire').value = c.destinataire || '';
    document.getElementById('courrier-contenu').value = c.contenu || '';
    App.openModal('courrier-modal');
  }

  async function saveCourrier() {
    const id = document.getElementById('courrier-id').value;
    const body = {
      type: document.getElementById('courrier-type').value,
      objet: document.getElementById('courrier-objet').value,
      expediteur: document.getElementById('courrier-expediteur').value,
      destinataire: document.getElementById('courrier-destinataire').value,
      contenu: document.getElementById('courrier-contenu').value,
    };

    try {
      if (id) {
        await App.api(`/courriers/${id}`, { method: 'PUT', body });
        App.toast('Courrier mis \u00e0 jour', 'success');
      } else {
        await App.api('/courriers', { method: 'POST', body });
        App.toast('Courrier cr\u00e9\u00e9', 'success');
      }
      App.closeModal('courrier-modal');
      await loadCourriers();
    } catch (err) {
      App.toast(err.message || 'Erreur lors de l\u2019enregistrement', 'error');
    }
  }

  function view(id) {
    const c = courriers.find(x => String(x.id) === String(id));
    if (!c) return;
    document.getElementById('courrier-view-content').innerHTML = `
      <div style="margin-bottom:1rem;">
        <span class="badge ${c.type === 'entrant' ? 'badge-blue' : 'badge-purple'}" style="font-size:.85rem;">${c.type === 'entrant' ? 'Courrier entrant' : 'Courrier sortant'}</span>
        <span style="margin-left:.5rem;color:var(--text-light);font-size:.85rem;">${App.formatDateLong(c.date)}</span>
      </div>
      <h3 style="margin-bottom:.5rem;">${esc(c.objet || '')}</h3>
      <p style="font-size:.88rem;color:var(--text-light);margin-bottom:.25rem;"><strong>R\u00e9f\u00e9rence :</strong> ${esc(c.reference || c.id || '')}</p>
      <p style="font-size:.88rem;color:var(--text-light);margin-bottom:.25rem;"><strong>Exp\u00e9diteur :</strong> ${esc(c.expediteur || '-')}</p>
      <p style="font-size:.88rem;color:var(--text-light);margin-bottom:1rem;"><strong>Destinataire :</strong> ${esc(c.destinataire || '-')}</p>
      <hr style="border:none;border-top:1px solid var(--border);margin-bottom:1rem;">
      <div style="white-space:pre-wrap;font-size:.9rem;line-height:1.7;">${esc(c.contenu || 'Aucun contenu')}</div>
    `;
    App.openModal('courrier-view-modal');
  }

  async function remove(id) {
    const ok = await App.confirmDialog('Voulez-vous vraiment supprimer ce courrier ?');
    if (!ok) return;
    try {
      await App.api(`/courriers/${id}`, { method: 'DELETE' });
      App.toast('Courrier supprim\u00e9', 'success');
      await loadCourriers();
    } catch (err) {
      App.toast(err.message || 'Erreur lors de la suppression', 'error');
    }
  }

  async function downloadPdf(id) {
    try {
      const token = localStorage.getItem('token');
      const link = document.createElement('a');
      link.href = `/api/courriers/${id}/pdf?token=${token}`;
      link.download = `courrier_${id}.pdf`;
      link.click();
    } catch (err) {
      App.toast('Erreur lors du t\u00e9l\u00e9chargement', 'error');
    }
  }

  // Fill courrier from AI
  function fillFromAI(data) {
    App.navigate('courriers');
    setTimeout(() => {
      openNew();
      if (data.objet) document.getElementById('courrier-objet').value = data.objet;
      if (data.destinataire) document.getElementById('courrier-destinataire').value = data.destinataire;
      if (data.contenu) document.getElementById('courrier-contenu').value = data.contenu;
      document.getElementById('courrier-type').value = 'sortant';
    }, 200);
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  return { init, openNew, edit, view, remove, downloadPdf, fillFromAI };
})();

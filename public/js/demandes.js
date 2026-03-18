/* ============================================================
   Module Demandes des habitants
   ============================================================ */

const Demandes = (() => {
  let demandes = [];

  async function init() {
    setupEvents();
    await loadDemandes();
  }

  function setupEvents() {
    const form = document.getElementById('demande-form');
    if (form.dataset.bound) return;
    form.dataset.bound = 'true';

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveDemande();
    });

    document.getElementById('demande-filter-statut')?.addEventListener('change', loadDemandes);
    document.getElementById('demande-search-btn')?.addEventListener('click', loadDemandes);
    document.getElementById('demande-search')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') loadDemandes();
    });
  }

  async function loadDemandes() {
    const search = document.getElementById('demande-search')?.value || '';
    const statut = document.getElementById('demande-filter-statut')?.value || '';

    let params = new URLSearchParams();
    if (search) params.append('search', search);
    if (statut) params.append('statut', statut);

    try {
      const data = await App.api(`/demandes?${params}`);
      demandes = data?.demandes || data || [];
      renderList();
    } catch (err) {
      App.toast('Erreur lors du chargement des demandes', 'error');
      demandes = [];
      renderList();
    }
  }

  function renderList() {
    const tbody = document.getElementById('demandes-tbody');
    if (!demandes.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state">
        <div class="empty-icon">\u{1F4CB}</div>
        <p>Aucune demande trouv\u00e9e</p>
      </td></tr>`;
      return;
    }
    tbody.innerHTML = demandes.map(d => `
      <tr>
        <td>${App.formatDate(d.date || d.created_at)}</td>
        <td><strong>${esc(d.nom || '')} ${esc(d.prenom || '')}</strong></td>
        <td>${esc(d.categorie || '-')}</td>
        <td>${esc(d.objet || '')}</td>
        <td>${getStatusBadge(d.statut)}</td>
        <td class="table-actions">
          <button class="btn btn-ghost btn-sm" onclick="Demandes.view('${d.id}')" title="Voir">\u{1F441}\uFE0F</button>
          <button class="btn btn-ghost btn-sm" onclick="Demandes.remove('${d.id}')" title="Supprimer">\u{1F5D1}\uFE0F</button>
        </td>
      </tr>
    `).join('');
  }

  function getStatusBadge(statut) {
    const map = {
      nouveau: '<span class="badge badge-blue">Nouveau</span>',
      en_cours: '<span class="badge badge-orange">En cours</span>',
      traite: '<span class="badge badge-green">Trait\u00e9</span>',
      refuse: '<span class="badge badge-red">Refus\u00e9</span>',
    };
    return map[statut] || `<span class="badge badge-gray">${esc(statut || '-')}</span>`;
  }

  function openNew() {
    document.getElementById('demande-modal-title').textContent = 'Nouvelle demande';
    document.getElementById('demande-form').reset();
    document.getElementById('demande-id').value = '';
    App.openModal('demande-modal');
  }

  async function saveDemande() {
    const id = document.getElementById('demande-id').value;
    const body = {
      nom: document.getElementById('demande-nom').value,
      prenom: document.getElementById('demande-prenom').value,
      email: document.getElementById('demande-email').value,
      telephone: document.getElementById('demande-tel').value,
      objet: document.getElementById('demande-objet').value,
      description: document.getElementById('demande-description').value,
      categorie: document.getElementById('demande-categorie').value,
    };

    try {
      if (id) {
        await App.api(`/demandes/${id}`, { method: 'PUT', body });
        App.toast('Demande mise \u00e0 jour', 'success');
      } else {
        await App.api('/demandes', { method: 'POST', body });
        App.toast('Demande cr\u00e9\u00e9e', 'success');
      }
      App.closeModal('demande-modal');
      await loadDemandes();
    } catch (err) {
      App.toast(err.message || 'Erreur lors de l\u2019enregistrement', 'error');
    }
  }

  async function view(id) {
    const d = demandes.find(x => String(x.id) === String(id));
    if (!d) return;

    // Load detail from API for timeline
    let detail = d;
    try {
      const data = await App.api(`/demandes/${id}`);
      detail = data?.demande || data || d;
    } catch {}

    const container = document.getElementById('demande-view-content');
    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:1rem;margin-bottom:1.25rem;">
        <div>
          <h3 style="margin-bottom:.25rem;">${esc(detail.objet || '')}</h3>
          <p style="font-size:.85rem;color:var(--text-light);">Cat\u00e9gorie : ${esc(detail.categorie || '-')}</p>
        </div>
        <div>${getStatusBadge(detail.statut)}</div>
      </div>

      <div class="card" style="background:var(--bg);">
        <h4 style="font-size:.88rem;margin-bottom:.5rem;">Informations du demandeur</h4>
        <p style="font-size:.88rem;"><strong>Nom :</strong> ${esc(detail.nom || '')} ${esc(detail.prenom || '')}</p>
        <p style="font-size:.88rem;"><strong>Email :</strong> ${esc(detail.email || '-')}</p>
        <p style="font-size:.88rem;"><strong>T\u00e9l\u00e9phone :</strong> ${esc(detail.telephone || '-')}</p>
      </div>

      <div class="card" style="background:var(--bg);">
        <h4 style="font-size:.88rem;margin-bottom:.5rem;">Description</h4>
        <p style="font-size:.88rem;white-space:pre-wrap;">${esc(detail.description || 'Aucune description')}</p>
      </div>

      <div class="card" style="background:var(--bg);">
        <h4 style="font-size:.88rem;margin-bottom:.75rem;">Historique</h4>
        <div class="timeline">
          ${renderTimeline(detail)}
        </div>
      </div>

      <div style="margin-top:1rem;">
        <h4 style="font-size:.88rem;margin-bottom:.5rem;">Changer le statut</h4>
        <div class="btn-group">
          <button class="btn btn-sm ${detail.statut === 'nouveau' ? 'btn-primary' : 'btn-outline'}" onclick="Demandes.updateStatus('${id}','nouveau')">Nouveau</button>
          <button class="btn btn-sm ${detail.statut === 'en_cours' ? 'btn-warning' : 'btn-outline'}" onclick="Demandes.updateStatus('${id}','en_cours')">En cours</button>
          <button class="btn btn-sm ${detail.statut === 'traite' ? 'btn-success' : 'btn-outline'}" onclick="Demandes.updateStatus('${id}','traite')">Trait\u00e9</button>
          <button class="btn btn-sm ${detail.statut === 'refuse' ? 'btn-danger' : 'btn-outline-danger'}" onclick="Demandes.updateStatus('${id}','refuse')">Refus\u00e9</button>
        </div>
      </div>

      <div style="margin-top:1.25rem;">
        <div class="form-group">
          <label>R\u00e9ponse</label>
          <textarea id="demande-reponse" class="form-control" rows="3" placeholder="R\u00e9diger une r\u00e9ponse...">${esc(detail.reponse || '')}</textarea>
        </div>
        <button class="btn btn-primary btn-sm" onclick="Demandes.saveReponse('${id}')">Enregistrer la r\u00e9ponse</button>
      </div>
    `;
    App.openModal('demande-view-modal');
  }

  function renderTimeline(d) {
    const history = d.historique || d.history || [];
    if (!history.length) {
      // Build minimal timeline
      return `
        <div class="timeline-item">
          <div class="tl-date">${App.formatDateTime(d.date || d.created_at)}</div>
          <div class="tl-content">Demande cr\u00e9\u00e9e</div>
        </div>
      `;
    }
    return history.map(h => `
      <div class="timeline-item">
        <div class="tl-date">${App.formatDateTime(h.date)}</div>
        <div class="tl-content">${esc(h.action || h.description || '')}</div>
      </div>
    `).join('');
  }

  async function updateStatus(id, statut) {
    try {
      await App.api(`/demandes/${id}/statut`, { method: 'PUT', body: { statut } });
      App.toast('Statut mis \u00e0 jour', 'success');
      App.closeModal('demande-view-modal');
      await loadDemandes();
    } catch (err) {
      App.toast(err.message || 'Erreur', 'error');
    }
  }

  async function saveReponse(id) {
    const reponse = document.getElementById('demande-reponse').value;
    try {
      await App.api(`/demandes/${id}/reponse`, { method: 'PUT', body: { reponse } });
      App.toast('R\u00e9ponse enregistr\u00e9e', 'success');
    } catch (err) {
      App.toast(err.message || 'Erreur', 'error');
    }
  }

  async function remove(id) {
    const ok = await App.confirmDialog('Supprimer cette demande ?');
    if (!ok) return;
    try {
      await App.api(`/demandes/${id}`, { method: 'DELETE' });
      App.toast('Demande supprim\u00e9e', 'success');
      await loadDemandes();
    } catch (err) {
      App.toast(err.message || 'Erreur', 'error');
    }
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  return { init, openNew, view, remove, updateStatus, saveReponse };
})();

/* ============================================================
   Module R\u00e9servations
   ============================================================ */

const Reservations = (() => {
  let reservations = [];
  let currentWeekStart = getMonday(new Date());
  let viewMode = 'calendar'; // 'calendar' | 'list'

  const LIEUX = [
    'Salle des f\u00eates',
    'Salle du conseil',
    'Salle polyvalente',
    'Gymnase',
    'Terrain de sport'
  ];

  function getMonday(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    date.setDate(diff);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  async function init() {
    setupEvents();
    await loadReservations();
  }

  function setupEvents() {
    const form = document.getElementById('resa-form');
    if (form.dataset.bound) return;
    form.dataset.bound = 'true';

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveReservation();
    });

    // Populate lieu select
    const lieuSelect = document.getElementById('resa-lieu');
    if (lieuSelect && lieuSelect.options.length <= 1) {
      LIEUX.forEach((l, i) => {
        const opt = document.createElement('option');
        opt.value = l;
        opt.textContent = l;
        lieuSelect.appendChild(opt);
      });
    }
  }

  async function loadReservations() {
    const dateFrom = currentWeekStart.toISOString().slice(0, 10);
    const dateTo = new Date(currentWeekStart.getTime() + 6 * 86400000).toISOString().slice(0, 10);

    try {
      const data = await App.api(`/reservations?date_from=${dateFrom}&date_to=${dateTo}`);
      reservations = data?.reservations || data || [];
    } catch {
      reservations = [];
    }

    if (viewMode === 'calendar') {
      renderCalendar();
    } else {
      renderList();
    }
  }

  function setView(mode) {
    viewMode = mode;
    document.querySelectorAll('#resa-view-toggle button').forEach(b => {
      b.classList.toggle('active', b.dataset.view === mode);
    });
    if (mode === 'calendar') renderCalendar();
    else renderList();
  }

  function renderCalendar() {
    const container = document.getElementById('resa-calendar');
    const weekLabel = document.getElementById('resa-week-label');

    // Week dates
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(currentWeekStart.getTime() + i * 86400000);
      days.push(d);
    }

    const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    weekLabel.textContent = `Semaine du ${App.formatDate(days[0])} au ${App.formatDate(days[6])}`;

    // Hours
    const hours = [];
    for (let h = 8; h <= 20; h++) hours.push(h);

    let html = '<div class="planning-grid">';
    // Header row
    html += '<div class="grid-header"></div>';
    days.forEach((d, i) => {
      const isToday = d.toDateString() === new Date().toDateString();
      html += `<div class="grid-header" style="${isToday ? 'color:var(--primary);font-weight:700;' : ''}">${dayNames[i]}<br>${d.getDate()}/${d.getMonth() + 1}</div>`;
    });

    // Time rows
    hours.forEach(h => {
      html += `<div class="grid-time">${h}:00</div>`;
      days.forEach((day, di) => {
        const dayStr = day.toISOString().slice(0, 10);
        const cellResas = reservations.filter(r => {
          const rd = (r.date_debut || r.date || '').slice(0, 10);
          if (rd !== dayStr) return false;
          const startH = parseInt((r.heure_debut || r.date_debut || '').split('T')[1]?.split(':')[0] || r.heure_debut || '8');
          const endH = parseInt((r.heure_fin || r.date_fin || '').split('T')[1]?.split(':')[0] || r.heure_fin || '20');
          return h >= startH && h < endH;
        });

        html += `<div class="grid-cell" onclick="Reservations.openNewAt('${dayStr}','${h}')">`;
        cellResas.forEach(r => {
          const lieuIndex = LIEUX.indexOf(r.lieu) % 5;
          html += `<div class="resa-block lieu-${lieuIndex >= 0 ? lieuIndex : 0}" onclick="event.stopPropagation();Reservations.view('${r.id}')" title="${esc(r.objet || '')}">${esc(r.lieu || r.objet || '')}</div>`;
        });
        html += '</div>';
      });
    });

    html += '</div>';
    container.innerHTML = html;

    document.getElementById('resa-list-container').style.display = 'none';
    container.style.display = 'block';
  }

  function renderList() {
    document.getElementById('resa-calendar').style.display = 'none';
    const container = document.getElementById('resa-list-container');
    container.style.display = 'block';

    const tbody = document.getElementById('resa-tbody');
    if (!reservations.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state">
        <div class="empty-icon">\u{1F4C5}</div>
        <p>Aucune r\u00e9servation pour cette p\u00e9riode</p>
      </td></tr>`;
      return;
    }
    tbody.innerHTML = reservations.map(r => `
      <tr>
        <td>${App.formatDate(r.date_debut || r.date)}</td>
        <td><span class="badge badge-info">${esc(r.lieu || '-')}</span></td>
        <td>${esc(r.demandeur || r.demandeur_nom || '')}</td>
        <td>${esc(r.objet || '')}</td>
        <td>${getStatusBadge(r.statut)}</td>
        <td class="table-actions">
          <button class="btn btn-ghost btn-sm" onclick="Reservations.view('${r.id}')">\u{1F441}\uFE0F</button>
          <button class="btn btn-ghost btn-sm" onclick="Reservations.downloadFacture('${r.id}')">\u{1F4E5}</button>
          <button class="btn btn-ghost btn-sm" onclick="Reservations.remove('${r.id}')">\u{1F5D1}\uFE0F</button>
        </td>
      </tr>
    `).join('');
  }

  function getStatusBadge(statut) {
    const map = {
      en_attente: '<span class="badge badge-orange">En attente</span>',
      confirmee: '<span class="badge badge-green">Confirm\u00e9e</span>',
      annulee: '<span class="badge badge-red">Annul\u00e9e</span>',
    };
    return map[statut] || `<span class="badge badge-gray">${esc(statut || '-')}</span>`;
  }

  function prevWeek() {
    currentWeekStart = new Date(currentWeekStart.getTime() - 7 * 86400000);
    loadReservations();
  }

  function nextWeek() {
    currentWeekStart = new Date(currentWeekStart.getTime() + 7 * 86400000);
    loadReservations();
  }

  function todayWeek() {
    currentWeekStart = getMonday(new Date());
    loadReservations();
  }

  function openNew() {
    document.getElementById('resa-modal-title').textContent = 'Nouvelle r\u00e9servation';
    document.getElementById('resa-form').reset();
    document.getElementById('resa-id').value = '';
    App.openModal('resa-modal');
  }

  function openNewAt(date, hour) {
    openNew();
    document.getElementById('resa-date-debut').value = date;
    document.getElementById('resa-heure-debut').value = `${String(hour).padStart(2, '0')}:00`;
    document.getElementById('resa-heure-fin').value = `${String(parseInt(hour) + 1).padStart(2, '0')}:00`;
  }

  async function saveReservation() {
    const id = document.getElementById('resa-id').value;
    const body = {
      lieu: document.getElementById('resa-lieu').value,
      demandeur: document.getElementById('resa-demandeur').value,
      demandeur_tel: document.getElementById('resa-demandeur-tel').value,
      demandeur_email: document.getElementById('resa-demandeur-email').value,
      date_debut: document.getElementById('resa-date-debut').value,
      heure_debut: document.getElementById('resa-heure-debut').value,
      date_fin: document.getElementById('resa-date-fin').value || document.getElementById('resa-date-debut').value,
      heure_fin: document.getElementById('resa-heure-fin').value,
      objet: document.getElementById('resa-objet').value,
      montant: document.getElementById('resa-montant').value || 0,
    };

    try {
      if (id) {
        await App.api(`/reservations/${id}`, { method: 'PUT', body });
        App.toast('R\u00e9servation mise \u00e0 jour', 'success');
      } else {
        await App.api('/reservations', { method: 'POST', body });
        App.toast('R\u00e9servation cr\u00e9\u00e9e', 'success');
      }
      App.closeModal('resa-modal');
      await loadReservations();
    } catch (err) {
      App.toast(err.message || 'Erreur', 'error');
    }
  }

  async function view(id) {
    const r = reservations.find(x => String(x.id) === String(id));
    if (!r) return;

    document.getElementById('resa-view-content').innerHTML = `
      <div style="margin-bottom:1rem;">
        <span class="badge badge-info" style="font-size:.85rem;">${esc(r.lieu || '')}</span>
        ${getStatusBadge(r.statut)}
      </div>
      <h3 style="margin-bottom:.75rem;">${esc(r.objet || '')}</h3>
      <p style="font-size:.88rem;"><strong>Demandeur :</strong> ${esc(r.demandeur || r.demandeur_nom || '-')}</p>
      <p style="font-size:.88rem;"><strong>T\u00e9l\u00e9phone :</strong> ${esc(r.demandeur_tel || '-')}</p>
      <p style="font-size:.88rem;"><strong>Email :</strong> ${esc(r.demandeur_email || '-')}</p>
      <p style="font-size:.88rem;"><strong>Date :</strong> ${App.formatDate(r.date_debut || r.date)} ${esc(r.heure_debut || '')} - ${App.formatDate(r.date_fin || r.date_debut || r.date)} ${esc(r.heure_fin || '')}</p>
      <p style="font-size:.88rem;"><strong>Montant :</strong> ${r.montant ? r.montant + ' \u20AC' : 'Gratuit'}</p>

      <div style="margin-top:1.25rem;">
        <h4 style="font-size:.88rem;margin-bottom:.5rem;">Changer le statut</h4>
        <div class="btn-group">
          <button class="btn btn-sm btn-warning" onclick="Reservations.updateStatus('${id}','en_attente')">En attente</button>
          <button class="btn btn-sm btn-success" onclick="Reservations.updateStatus('${id}','confirmee')">Confirmer</button>
          <button class="btn btn-sm btn-danger" onclick="Reservations.updateStatus('${id}','annulee')">Annuler</button>
        </div>
      </div>
    `;
    App.openModal('resa-view-modal');
  }

  async function updateStatus(id, statut) {
    try {
      await App.api(`/reservations/${id}/statut`, { method: 'PUT', body: { statut } });
      App.toast('Statut mis \u00e0 jour', 'success');
      App.closeModal('resa-view-modal');
      await loadReservations();
    } catch (err) {
      App.toast(err.message || 'Erreur', 'error');
    }
  }

  async function downloadFacture(id) {
    try {
      const token = localStorage.getItem('token');
      const link = document.createElement('a');
      link.href = `/api/reservations/${id}/facture?token=${token}`;
      link.download = `facture_${id}.pdf`;
      link.click();
    } catch {
      App.toast('Erreur lors du t\u00e9l\u00e9chargement', 'error');
    }
  }

  async function remove(id) {
    const ok = await App.confirmDialog('Supprimer cette r\u00e9servation ?');
    if (!ok) return;
    try {
      await App.api(`/reservations/${id}`, { method: 'DELETE' });
      App.toast('R\u00e9servation supprim\u00e9e', 'success');
      await loadReservations();
    } catch (err) {
      App.toast(err.message || 'Erreur', 'error');
    }
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  return {
    init, openNew, openNewAt, view, remove, setView,
    prevWeek, nextWeek, todayWeek, updateStatus, downloadFacture
  };
})();

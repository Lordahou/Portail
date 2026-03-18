/* ============================================================
   Module Documents
   ============================================================ */

const Documents = (() => {
  let currentFolder = null;
  let folders = [];
  let files = [];

  async function init() {
    setupEvents();
    await loadFolders();
  }

  function setupEvents() {
    const dropZone = document.getElementById('doc-drop-zone');
    if (dropZone && !dropZone.dataset.bound) {
      dropZone.dataset.bound = 'true';

      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
      });
      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
      });
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const dt = e.dataTransfer;
        if (dt.files.length) uploadFiles(dt.files);
      });
      dropZone.addEventListener('click', () => {
        document.getElementById('doc-file-input').click();
      });

      document.getElementById('doc-file-input').addEventListener('change', (e) => {
        if (e.target.files.length) uploadFiles(e.target.files);
        e.target.value = '';
      });

      document.getElementById('doc-search')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') searchFiles();
      });
      document.getElementById('doc-search-btn')?.addEventListener('click', searchFiles);
    }
  }

  async function loadFolders() {
    try {
      const data = await App.api('/documents/folders');
      folders = data?.folders || data || [];
    } catch {
      folders = [
        { id: 'root', name: 'Racine', parent: null },
        { id: 'administratif', name: 'Administratif', parent: 'root' },
        { id: 'deliberations', name: 'D\u00e9lib\u00e9rations', parent: 'root' },
        { id: 'courriers', name: 'Courriers', parent: 'root' },
        { id: 'divers', name: 'Divers', parent: 'root' },
      ];
    }
    if (!currentFolder && folders.length) currentFolder = folders[0].id || 'root';
    renderFolderTree();
    await loadFiles();
  }

  function renderFolderTree() {
    const container = document.getElementById('folder-tree-list');
    container.innerHTML = folders.map(f => `
      <div class="folder-item ${f.id === currentFolder ? 'active' : ''}" onclick="Documents.selectFolder('${f.id}')">
        <span class="folder-icon">\u{1F4C1}</span>
        <span>${esc(f.name || f.nom || '')}</span>
      </div>
    `).join('');
  }

  function selectFolder(id) {
    currentFolder = id;
    renderFolderTree();
    loadFiles();
  }

  async function loadFiles() {
    try {
      const data = await App.api(`/documents?folder=${currentFolder || ''}`);
      files = data?.documents || data?.files || data || [];
    } catch {
      files = [];
    }
    renderFiles();
  }

  function renderFiles() {
    const container = document.getElementById('file-list');
    if (!files.length) {
      container.innerHTML = `<div class="empty-state">
        <div class="empty-icon">\u{1F4C4}</div>
        <p>Aucun document dans ce dossier</p>
      </div>`;
      return;
    }
    container.innerHTML = `
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Date</th>
              <th>Taille</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${files.map(f => `
              <tr>
                <td>
                  <span style="margin-right:.4rem;">${getFileIcon(f.type || f.mimetype || f.name || '')}</span>
                  ${esc(f.name || f.nom || '')}
                </td>
                <td>${App.formatDate(f.date || f.created_at || f.uploaded_at)}</td>
                <td>${formatSize(f.size || f.taille || 0)}</td>
                <td class="table-actions">
                  <button class="btn btn-ghost btn-sm" onclick="Documents.download('${f.id}')" title="T\u00e9l\u00e9charger">\u{1F4E5}</button>
                  <button class="btn btn-ghost btn-sm" onclick="Documents.removeFile('${f.id}')" title="Supprimer">\u{1F5D1}\uFE0F</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function getFileIcon(type) {
    if (!type) return '\u{1F4C4}';
    const t = type.toLowerCase();
    if (t.includes('pdf')) return '\u{1F4D5}';
    if (t.includes('word') || t.includes('doc')) return '\u{1F4DD}';
    if (t.includes('excel') || t.includes('xls') || t.includes('sheet')) return '\u{1F4CA}';
    if (t.includes('image') || t.includes('png') || t.includes('jpg') || t.includes('jpeg')) return '\u{1F5BC}\uFE0F';
    if (t.includes('zip') || t.includes('rar') || t.includes('archive')) return '\u{1F4E6}';
    return '\u{1F4C4}';
  }

  function formatSize(bytes) {
    if (!bytes || bytes === 0) return '-';
    const units = ['o', 'Ko', 'Mo', 'Go'];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) {
      size /= 1024;
      i++;
    }
    return `${size.toFixed(size < 10 ? 1 : 0)} ${units[i]}`;
  }

  async function uploadFiles(fileList) {
    for (const file of fileList) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', currentFolder || 'root');

      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/documents/upload', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || 'Erreur');
        }
        App.toast(`Fichier "${file.name}" envoy\u00e9`, 'success');
      } catch (err) {
        App.toast(`Erreur pour "${file.name}": ${err.message}`, 'error');
      }
    }
    await loadFiles();
  }

  async function createFolder() {
    const name = prompt('Nom du nouveau dossier :');
    if (!name || !name.trim()) return;

    try {
      await App.api('/documents/folders', {
        method: 'POST',
        body: { name: name.trim(), parent: currentFolder || 'root' }
      });
      App.toast('Dossier cr\u00e9\u00e9', 'success');
      await loadFolders();
    } catch (err) {
      App.toast(err.message || 'Erreur', 'error');
    }
  }

  function download(id) {
    const token = localStorage.getItem('token');
    const link = document.createElement('a');
    link.href = `/api/documents/${id}/download?token=${token}`;
    link.download = '';
    link.click();
  }

  async function removeFile(id) {
    const ok = await App.confirmDialog('Supprimer ce document ?');
    if (!ok) return;
    try {
      await App.api(`/documents/${id}`, { method: 'DELETE' });
      App.toast('Document supprim\u00e9', 'success');
      await loadFiles();
    } catch (err) {
      App.toast(err.message || 'Erreur', 'error');
    }
  }

  async function searchFiles() {
    const q = document.getElementById('doc-search')?.value || '';
    if (!q.trim()) { await loadFiles(); return; }
    try {
      const data = await App.api(`/documents?search=${encodeURIComponent(q)}`);
      files = data?.documents || data?.files || data || [];
      renderFiles();
    } catch {
      App.toast('Erreur lors de la recherche', 'error');
    }
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  return { init, selectFolder, createFolder, download, removeFile, uploadFiles };
})();

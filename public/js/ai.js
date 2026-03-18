/* ============================================================
   Module Assistant IA
   ============================================================ */

const AI = (() => {
  let lastResult = '';
  let lastType = '';

  function init() {
    setupEvents();
    updateForm();
  }

  function setupEvents() {
    const typeSelect = document.getElementById('ai-type');
    if (typeSelect && !typeSelect.dataset.bound) {
      typeSelect.dataset.bound = 'true';
      typeSelect.addEventListener('change', updateForm);
    }
  }

  function updateForm() {
    const type = document.getElementById('ai-type').value;
    const container = document.getElementById('ai-fields');

    const forms = {
      courrier: `
        <div class="form-group">
          <label>Destinataire</label>
          <input type="text" id="ai-destinataire" class="form-control" placeholder="Nom ou organisme du destinataire">
        </div>
        <div class="form-group">
          <label>Objet du courrier</label>
          <input type="text" id="ai-objet" class="form-control" placeholder="Ex: Demande de subvention">
        </div>
        <div class="form-group">
          <label>Ton</label>
          <select id="ai-ton" class="form-control">
            <option value="formel">Formel</option>
            <option value="cordial">Cordial</option>
          </select>
        </div>
        <div class="form-group">
          <label>Points cl\u00e9s \u00e0 aborder</label>
          <textarea id="ai-points" class="form-control" rows="4" placeholder="Listez les points importants, un par ligne..."></textarea>
        </div>
      `,
      deliberation: `
        <div class="form-group">
          <label>Titre de la d\u00e9lib\u00e9ration</label>
          <input type="text" id="ai-delib-titre" class="form-control" placeholder="Ex: Approbation du budget 2026">
        </div>
        <div class="form-group">
          <label>Contexte</label>
          <textarea id="ai-delib-contexte" class="form-control" rows="3" placeholder="D\u00e9crivez le contexte et les enjeux..."></textarea>
        </div>
        <div class="form-group">
          <label>D\u00e9cision souhait\u00e9e</label>
          <textarea id="ai-delib-decision" class="form-control" rows="3" placeholder="Quelle d\u00e9cision doit \u00eatre prise..."></textarea>
        </div>
      `,
      mail: `
        <div class="form-group">
          <label>Destinataire</label>
          <input type="text" id="ai-mail-dest" class="form-control" placeholder="Nom du destinataire">
        </div>
        <div class="form-group">
          <label>Objet du mail</label>
          <input type="text" id="ai-mail-objet" class="form-control" placeholder="Ex: Invitation r\u00e9union">
        </div>
        <div class="form-group">
          <label>Contenu souhait\u00e9</label>
          <textarea id="ai-mail-contenu" class="form-control" rows="4" placeholder="D\u00e9crivez ce que le mail doit contenir..."></textarea>
        </div>
      `,
      resume: `
        <div class="form-group">
          <label>Texte du document \u00e0 r\u00e9sumer</label>
          <textarea id="ai-resume-texte" class="form-control" rows="8" placeholder="Collez ici le texte du document..."></textarea>
        </div>
      `
    };

    container.innerHTML = forms[type] || '';
    lastType = type;

    // Clear result
    document.getElementById('ai-result').innerHTML = '<p style="color:var(--text-lighter);">Le r\u00e9sultat appara\u00eetra ici apr\u00e8s g\u00e9n\u00e9ration.</p>';
    document.getElementById('ai-actions').style.display = 'none';
  }

  async function generate() {
    const type = document.getElementById('ai-type').value;
    let prompt = {};

    switch (type) {
      case 'courrier':
        prompt = {
          type: 'courrier',
          destinataire: document.getElementById('ai-destinataire')?.value || '',
          objet: document.getElementById('ai-objet')?.value || '',
          ton: document.getElementById('ai-ton')?.value || 'formel',
          points: document.getElementById('ai-points')?.value || '',
        };
        break;
      case 'deliberation':
        prompt = {
          type: 'deliberation',
          titre: document.getElementById('ai-delib-titre')?.value || '',
          contexte: document.getElementById('ai-delib-contexte')?.value || '',
          decision: document.getElementById('ai-delib-decision')?.value || '',
        };
        break;
      case 'mail':
        prompt = {
          type: 'mail',
          destinataire: document.getElementById('ai-mail-dest')?.value || '',
          objet: document.getElementById('ai-mail-objet')?.value || '',
          contenu: document.getElementById('ai-mail-contenu')?.value || '',
        };
        break;
      case 'resume':
        prompt = {
          type: 'resume',
          texte: document.getElementById('ai-resume-texte')?.value || '',
        };
        break;
    }

    const resultEl = document.getElementById('ai-result');
    resultEl.innerHTML = '<div class="loading-overlay"><span class="spinner"></span> G\u00e9n\u00e9ration en cours...</div>';
    document.getElementById('ai-actions').style.display = 'none';

    try {
      const data = await App.api('/ai/generate', { method: 'POST', body: prompt });
      lastResult = data?.result || data?.text || data?.content || '';
      resultEl.textContent = lastResult;
      document.getElementById('ai-actions').style.display = 'flex';
      App.toast('Texte g\u00e9n\u00e9r\u00e9 avec succ\u00e8s', 'success');
    } catch (err) {
      resultEl.innerHTML = `<p style="color:var(--danger);">Erreur : ${esc(err.message || 'Impossible de g\u00e9n\u00e9rer le texte')}</p>`;
      App.toast('Erreur lors de la g\u00e9n\u00e9ration', 'error');
    }
  }

  function copyResult() {
    if (!lastResult) return;
    navigator.clipboard.writeText(lastResult).then(() => {
      App.toast('Texte copi\u00e9 dans le presse-papiers', 'success');
    }).catch(() => {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = lastResult;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      App.toast('Texte copi\u00e9', 'success');
    });
  }

  function useInCourrier() {
    if (!lastResult) return;
    const data = {};
    if (lastType === 'courrier') {
      data.objet = document.getElementById('ai-objet')?.value || '';
      data.destinataire = document.getElementById('ai-destinataire')?.value || '';
    } else if (lastType === 'mail') {
      data.objet = document.getElementById('ai-mail-objet')?.value || '';
      data.destinataire = document.getElementById('ai-mail-dest')?.value || '';
    }
    data.contenu = lastResult;

    if (typeof Courriers !== 'undefined') {
      Courriers.fillFromAI(data);
    } else {
      App.toast('Module courriers non disponible', 'warning');
    }
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  return { init, generate, copyResult, useInCourrier };
})();

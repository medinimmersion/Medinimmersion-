// ============================================================
// GESTION DU CONTENU — gestion-contenu.js (version onglet)
// Ajoute un onglet « 📝 Contenu » dans l'espace gérant pour
// modifier les textes et images du site.
//
// Installation : fichier à la racine du repo, puis dans
// admin-gerant.html ajouter juste avant </body> :
//   <script src="/gestion-contenu.js"></script>
// ============================================================

(function () {
  const S = document.createElement('style');
  S.textContent = `
  .cms-item{border:1px solid var(--beige);border-radius:12px;padding:0.9rem;margin-bottom:0.7rem;background:var(--cream);}
  .cms-label{font-weight:700;font-size:0.88rem;color:var(--green-deep);margin-bottom:0.45rem;}
  .cms-key{font-size:0.68rem;color:#999;font-weight:400;margin-left:0.4rem;}
  .cms-item textarea{width:100%;min-height:60px;padding:0.6rem 0.8rem;border:1.5px solid var(--beige);border-radius:10px;font-family:inherit;font-size:0.88rem;resize:vertical;box-sizing:border-box;background:#fff;}
  .cms-item textarea:focus{outline:2px solid var(--gold);border-color:var(--gold);}
  .cms-img-preview{max-width:100%;max-height:180px;border-radius:10px;display:block;margin-bottom:0.6rem;border:1px solid var(--beige);}
  .cms-status{font-size:0.76rem;margin-left:0.6rem;font-weight:700;}
  .cms-status.ok{color:var(--ok);} .cms-status.err{color:var(--bad);}
  .cms-file{font-size:0.82rem;margin:0.3rem 0;display:block;}
  `;
  document.head.appendChild(S);

  function getKey() {
    let k = localStorage.getItem('cms_admin_key');
    if (!k) {
      k = prompt('Clé de gestion du contenu (CONTENT_ADMIN_KEY définie sur Render) :');
      if (k) localStorage.setItem('cms_admin_key', k.trim());
    }
    return (k || '').trim();
  }

  async function api(path, opts = {}) {
    opts.headers = Object.assign({ 'x-admin-key': getKey(), 'Content-Type': 'application/json' }, opts.headers || {});
    const r = await fetch('/api/content' + path, opts);
    if (r.status === 401) { localStorage.removeItem('cms_admin_key'); throw new Error('Clé invalide. Rouvrez l\'onglet Contenu pour la ressaisir.'); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Erreur serveur');
    return j;
  }

  function setStatus(el, msg, ok) {
    el.textContent = msg;
    el.className = 'cms-status ' + (ok ? 'ok' : 'err');
    if (ok) setTimeout(() => (el.textContent = ''), 3000);
  }

  // Compression d'image côté navigateur (max 1400px, JPEG 85%)
  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const max = 1400;
        let w = img.width, h = img.height;
        if (w > max) { h = Math.round(h * max / w); w = max; }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', 0.85).split(',')[1]);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  let loaded = false;

  async function loadContent() {
    const box = document.getElementById('listContenu');
    box.innerHTML = '<div class="loading">Chargement…</div>';
    let items;
    try { items = await api('/admin/list'); }
    catch (e) { box.innerHTML = '<div class="empty">' + e.message + '</div>'; return; }
    loaded = true;
    box.innerHTML = '';

    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'cms-item';

      if (item.type === 'text') {
        div.innerHTML = `<div class="cms-label">${item.label || item.key}<span class="cms-key">(${item.key})</span></div>
          <textarea></textarea>
          <div class="acts"><button class="btn btn-green">💾 Enregistrer</button><span class="cms-status"></span></div>`;
        const ta = div.querySelector('textarea'), btn = div.querySelector('button'), st = div.querySelector('.cms-status');
        ta.value = item.value || '';
        btn.onclick = async () => {
          btn.disabled = true;
          try { await api('/admin/text', { method: 'POST', body: JSON.stringify({ key: item.key, value: ta.value }) }); setStatus(st, '✓ Enregistré', true); }
          catch (e) { setStatus(st, e.message, false); }
          btn.disabled = false;
        };
      } else {
        div.innerHTML = `<div class="cms-label">${item.label || item.key}<span class="cms-key">(${item.key})</span></div>
          ${item.has_image ? `<img class="cms-img-preview" src="/api/content/img/${item.key}?t=${Date.now()}">` : '<div style="font-size:0.8rem;color:var(--muted);margin-bottom:0.5rem;">Aucune image pour le moment</div>'}
          <input type="file" accept="image/*" class="cms-file">
          <div class="acts"><button class="btn btn-green">📤 Envoyer l'image</button><span class="cms-status"></span></div>`;
        const inp = div.querySelector('input'), btn = div.querySelector('button'), st = div.querySelector('.cms-status');
        btn.onclick = async () => {
          if (!inp.files.length) { setStatus(st, 'Choisissez une image', false); return; }
          btn.disabled = true; setStatus(st, 'Compression…', true);
          try {
            const b64 = await compressImage(inp.files[0]);
            setStatus(st, 'Envoi…', true);
            await api('/admin/image', { method: 'POST', body: JSON.stringify({ key: item.key, data: b64, mime: 'image/jpeg' }) });
            setStatus(st, '✓ Image en ligne', true);
            let prev = div.querySelector('.cms-img-preview');
            if (!prev) { prev = document.createElement('img'); prev.className = 'cms-img-preview'; div.insertBefore(prev, inp); }
            prev.src = '/api/content/img/' + item.key + '?t=' + Date.now();
          } catch (e) { setStatus(st, e.message, false); }
          btn.disabled = false;
        };
      }
      box.appendChild(div);
    });
  }

  function install() {
    const tabs = document.querySelector('.tabs');
    const app = document.getElementById('app');
    if (!tabs || !app) return; // structure inattendue

    // Onglet (en première position pour être visible immédiatement)
    const tab = document.createElement('button');
    tab.className = 'tab';
    tab.dataset.p = 'contenu';
    tab.textContent = '📝 Contenu';
    tabs.insertBefore(tab, tabs.firstChild);

    // Panneau
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.id = 'p-contenu';
    panel.innerHTML = `<h2>Contenu du site</h2>
      <p class="sub">Modifie les textes et images des pages publiques. Visible immédiatement, sans redéploiement.</p>
      <div id="listContenu" class="loading">Chargement…</div>`;
    app.appendChild(panel);

    // Clic : même comportement que les autres onglets
    tab.onclick = () => {
      document.querySelectorAll('.tab').forEach(x => x.classList.remove('on'));
      document.querySelectorAll('.panel').forEach(x => x.classList.remove('on'));
      tab.classList.add('on');
      panel.classList.add('on');
      if (!loaded) loadContent();
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();

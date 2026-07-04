// ============================================================
// GESTION DU CONTENU — gestion-contenu.js
// Interface de modification des textes et images du site,
// injectée dans l'espace gérant (même principe que
// maintenance-control.js).
//
// Dans admin-gerant.html, ajouter juste avant </body> :
//   <script src="/gestion-contenu.js"></script>
//
// Au premier usage, la clé gérant (CONTENT_ADMIN_KEY définie
// sur Render) est demandée puis mémorisée sur l'appareil.
// ============================================================

(function () {
  const S = document.createElement('style');
  S.textContent = `
  #cmsPanel{max-width:760px;margin:2rem auto;padding:0 1rem;font-family:'DM Sans',sans-serif;}
  #cmsPanel h2{font-family:'Cormorant Garamond',serif;color:#0F3D26;font-size:1.7rem;margin-bottom:0.3rem;}
  #cmsPanel .cms-sub{color:#5A5247;font-size:0.85rem;margin-bottom:1.5rem;}
  .cms-item{background:#fff;border:1px solid #EDE4C8;border-radius:14px;padding:1.1rem;margin-bottom:0.9rem;}
  .cms-label{font-weight:700;font-size:0.85rem;color:#1B5E3A;margin-bottom:0.5rem;}
  .cms-key{font-size:0.7rem;color:#999;font-weight:400;margin-left:0.4rem;}
  .cms-item textarea{width:100%;min-height:64px;padding:0.6rem 0.8rem;border:1.5px solid #EDE4C8;border-radius:9px;font-family:inherit;font-size:0.88rem;resize:vertical;box-sizing:border-box;}
  .cms-item textarea:focus{outline:none;border-color:#1B5E3A;}
  .cms-btn{background:#1B5E3A;color:#fff;border:none;border-radius:50px;padding:0.5rem 1.3rem;font-family:inherit;font-size:0.83rem;font-weight:700;cursor:pointer;margin-top:0.6rem;}
  .cms-btn:disabled{opacity:0.5;}
  .cms-img-preview{max-width:100%;max-height:180px;border-radius:10px;display:block;margin-bottom:0.6rem;border:1px solid #EDE4C8;}
  .cms-status{font-size:0.78rem;margin-left:0.7rem;font-weight:600;}
  .cms-status.ok{color:#1B5E3A;} .cms-status.err{color:#B91C1C;}
  .cms-file{font-size:0.82rem;margin-top:0.2rem;}
  `;
  document.head.appendChild(S);

  function getKey() {
    let k = localStorage.getItem('cms_admin_key');
    if (!k) {
      k = prompt('Clé gérant (CONTENT_ADMIN_KEY) :');
      if (k) localStorage.setItem('cms_admin_key', k.trim());
    }
    return (k || '').trim();
  }

  async function api(path, opts = {}) {
    opts.headers = Object.assign({ 'x-admin-key': getKey(), 'Content-Type': 'application/json' }, opts.headers || {});
    const r = await fetch('/api/content' + path, opts);
    if (r.status === 401) { localStorage.removeItem('cms_admin_key'); throw new Error('Clé invalide. Rechargez la page.'); }
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
        const dataUrl = c.toDataURL('image/jpeg', 0.85);
        resolve(dataUrl.split(',')[1]); // base64 sans préfixe
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  async function render() {
    const panel = document.createElement('section');
    panel.id = 'cmsPanel';
    panel.innerHTML = '<h2>📝 Contenu du site</h2><div class="cms-sub">Modifiez les textes et images des pages publiques. Les changements sont visibles immédiatement.</div><div id="cmsItems">Chargement…</div>';
    document.body.appendChild(panel);
    const box = panel.querySelector('#cmsItems');

    let items;
    try { items = await api('/admin/list'); }
    catch (e) { box.innerHTML = '<div style="color:#B91C1C;font-size:0.85rem;">' + e.message + '</div>'; return; }

    box.innerHTML = '';
    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'cms-item';

      if (item.type === 'text') {
        div.innerHTML = `<div class="cms-label">${item.label || item.key}<span class="cms-key">(${item.key})</span></div>
          <textarea>${item.value || ''}</textarea>
          <button class="cms-btn">Enregistrer</button><span class="cms-status"></span>`;
        const ta = div.querySelector('textarea'), btn = div.querySelector('button'), st = div.querySelector('.cms-status');
        btn.onclick = async () => {
          btn.disabled = true;
          try { await api('/admin/text', { method: 'POST', body: JSON.stringify({ key: item.key, value: ta.value }) }); setStatus(st, '✓ Enregistré', true); }
          catch (e) { setStatus(st, e.message, false); }
          btn.disabled = false;
        };
      } else {
        div.innerHTML = `<div class="cms-label">${item.label || item.key}<span class="cms-key">(${item.key})</span></div>
          ${item.has_image ? `<img class="cms-img-preview" src="/api/content/img/${item.key}?t=${Date.now()}">` : '<div style="font-size:0.8rem;color:#999;margin-bottom:0.5rem;">Aucune image pour le moment</div>'}
          <input type="file" accept="image/*" class="cms-file">
          <button class="cms-btn">Envoyer l'image</button><span class="cms-status"></span>`;
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

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();

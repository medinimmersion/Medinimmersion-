// ============================================================
// CHARGEUR DE CONTENU — content-loader.js
// À inclure dans chaque page publique, juste avant </body> :
//   <script src="/content-loader.js"></script>
//
// Usage dans le HTML :
//   Texte  : <span data-content="hero_titre">Texte par défaut</span>
//   Image  : <img data-content-img="inscription_photo" src="/images/defaut.jpg">
//
// Si la base contient une valeur, elle remplace le contenu par
// défaut. Sinon, le contenu écrit dans le HTML reste affiché.
// ============================================================

(function () {
  // Lien "Blog" dans le menu de toutes les pages (sans modifier chaque page)
  try {
    if (!document.querySelector('.nav-links a[href="/blog"]')) {
      const cta = document.querySelector('.nav-links .nav-cta');
      if (cta && cta.parentElement && cta.parentElement.parentElement) {
        const li = document.createElement('li');
        li.innerHTML = '<a href="/blog"' + (location.pathname.indexOf('/blog') === 0 ? ' class="active-page"' : '') + '>Blog</a>';
        cta.parentElement.parentElement.insertBefore(li, cta.parentElement);
      }
    }
    const mm = document.getElementById('mobileMenu');
    if (mm && !mm.querySelector('a[href="/blog"]')) {
      const last = mm.lastElementChild;
      const a = document.createElement('a');
      a.href = '/blog'; a.textContent = 'Blog';
      mm.insertBefore(a, last);
    }
  } catch (e) { /* silencieux */ }

  fetch('/api/content')
    .then(r => (r.ok ? r.json() : {}))
    .then(content => {
      // Textes
      document.querySelectorAll('[data-content]').forEach(el => {
        const c = content[el.getAttribute('data-content')];
        if (c && c.type === 'text' && c.value) el.textContent = c.value;
      });
      // Images
      document.querySelectorAll('[data-content-img]').forEach(el => {
        const key = el.getAttribute('data-content-img');
        const c = content[key];
        if (c && c.type === 'image' && c.has_image) {
          el.src = '/api/content/img/' + encodeURIComponent(key) + '?t=' + Date.now();
          if (el.parentElement && el.parentElement.style.display === 'none') {
            el.parentElement.style.display = '';
          }
        }
      });

      // Bannière automatique : photo de fond du bandeau de la page
      // (clé "banniere_<nom-de-page>", ex: banniere_tarifs, banniere_accueil)
      let page = location.pathname.replace(/\.html$/, '').replace(/^\//, '');
      if (page === '' || page === 'index') page = 'accueil';
      const bk = 'banniere_' + page;
      const bc = content[bk];
      if (bc && bc.type === 'image' && bc.has_image) {
        const hero = document.querySelector('.page-hero') || document.querySelector('.hero');
        if (hero) {
          const wrap = document.createElement('div');
          wrap.style.cssText = 'position:absolute;inset:0;';
          wrap.innerHTML = '<img src="/api/content/img/' + bk + '?t=' + Date.now() + '" alt="" style="width:100%;height:100%;object-fit:cover;">' +
            '<div style="position:absolute;inset:0;background:linear-gradient(rgba(15,61,38,0.5),rgba(15,61,38,0.72));"></div>';
          hero.prepend(wrap);
          Array.from(hero.children).forEach(ch => {
            if (ch !== wrap && getComputedStyle(ch).position === 'static') ch.style.position = 'relative';
          });
        }
      }

      // Photos de sections automatiques
      // (clé "img_<page>_section<N>" : N = numéro du bloc en partant du haut)
      let blocks = Array.from(document.querySelectorAll('section'));
      if (!blocks.length) {
        blocks = Array.from(document.body.children).filter(el =>
          !['NAV', 'FOOTER', 'SCRIPT', 'STYLE'].includes(el.tagName)
        );
      }
      blocks.forEach((sec, i) => {
        const sk = 'img_' + page + '_section' + (i + 1);
        const sc = content[sk];
        if (sc && sc.type === 'image' && sc.has_image) {
          const block = document.createElement('div');
          block.style.cssText = 'text-align:center;padding:2.5rem 1.5rem 0;position:relative;';
          block.innerHTML = '<img src="/api/content/img/' + sk + '?t=' + Date.now() + '" alt="" loading="lazy" style="max-width:820px;width:100%;border-radius:18px;box-shadow:0 12px 40px rgba(0,0,0,0.12);">';
          const target = sec.querySelector('.container') || sec;
          target.appendChild(block);
        }
      });
    })
    .catch(() => { /* silencieux : le contenu par défaut reste affiché */ });
})();

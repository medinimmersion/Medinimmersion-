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
    })
    .catch(() => { /* silencieux : le contenu par défaut reste affiché */ });
})();

/**
 * admin-kalam-time.js — Onglet ⏱️ Kalam de l'espace gérant.
 * À inclure dans admin-gerant.html : <script src="/admin-kalam-time.js"></script>
 *
 * Affiche, pour chaque élève : temps passé sur le site + temps passé sur Kalam.
 * Clic sur une ligne → détail de chaque session avec date, heure et durée.
 *
 * Le script se greffe tout seul sur le panneau Kalam existant. S'il ne le trouve
 * pas, il crée son propre panneau flottant accessible par un bouton.
 */
(function () {
  'use strict';

  var VERT = '#1B5E20';
  var OR = '#D4AF37';
  var TOKEN_SHAPE = /^[a-f0-9]{100,}$/i; // crypto.randomBytes(64).toString('hex')

  var mounted = null;   // conteneur où l'on dessine
  var loading = false;
  var loaded = false;

  // ── Jeton gérant ────────────────────────────────────────────
  function findToken() {
    var stores = [];
    try { stores.push(window.localStorage); } catch (e) {}
    try { stores.push(window.sessionStorage); } catch (e) {}

    var preferred = ['gerantToken', 'gerant_token', 'adminToken', 'admin_token', 'token'];
    for (var s = 0; s < stores.length; s++) {
      for (var p = 0; p < preferred.length; p++) {
        try {
          var v = stores[s].getItem(preferred[p]);
          if (v && TOKEN_SHAPE.test(v)) return v;
        } catch (e) {}
      }
    }
    for (var i = 0; i < stores.length; i++) {
      try {
        for (var k = 0; k < stores[i].length; k++) {
          var val = stores[i].getItem(stores[i].key(k));
          if (val && TOKEN_SHAPE.test(val)) return val;
        }
      } catch (e) {}
    }
    return null;
  }

  function api(path) {
    var token = findToken();
    if (!token) return Promise.reject(new Error('non-connecte'));
    return fetch(path, {
      headers: { 'x-gerant-token': token, 'x-admin-token': token }
    }).then(function (r) {
      if (r.status === 401) throw new Error('non-connecte');
      if (!r.ok) throw new Error('http-' + r.status);
      return r.json();
    });
  }

  // ── Mise en forme ───────────────────────────────────────────
  function duree(sec) {
    sec = parseInt(sec, 10) || 0;
    if (sec < 60) return sec + ' s';
    var h = Math.floor(sec / 3600);
    var m = Math.round((sec % 3600) / 60);
    if (h === 0) return m + ' min';
    return h + ' h ' + (m < 10 ? '0' + m : m);
  }

  function dateFr(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  function nomComplet(e) {
    var n = ((e.prenom || '') + ' ' + (e.nom || '')).trim();
    return n || e.kounia || e.email || ('Élève #' + e.id);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // ── Rendu ───────────────────────────────────────────────────
  function html(eleves) {
    if (!eleves.length) {
      return '<p style="color:#666">Aucun élève enregistré.</p>';
    }

    var actifs = eleves.filter(function (e) { return (e.site_seconds + e.kalam_seconds) > 0; });
    var totalSite = 0, totalKalam = 0;
    eleves.forEach(function (e) { totalSite += e.site_seconds; totalKalam += e.kalam_seconds; });

    var out = '' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">' +
        carte('Élèves actifs', actifs.length + ' / ' + eleves.length) +
        carte('Temps site cumulé', duree(totalSite)) +
        carte('Temps Kalam cumulé', duree(totalKalam)) +
      '</div>' +
      '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:14px">' +
      '<thead><tr style="background:' + VERT + ';color:#fff">' +
        '<th style="padding:10px 8px;text-align:left">Élève</th>' +
        '<th style="padding:10px 8px;text-align:right">Site</th>' +
        '<th style="padding:10px 8px;text-align:right">Kalam</th>' +
        '<th style="padding:10px 8px;text-align:right">Sessions Kalam</th>' +
        '<th style="padding:10px 8px;text-align:left">Dernière activité</th>' +
      '</tr></thead><tbody>';

    eleves.forEach(function (e) {
      var inactif = (e.site_seconds + e.kalam_seconds) === 0;
      out += '<tr data-eleve="' + e.id + '" style="border-bottom:1px solid #e5e5e5;cursor:pointer' +
             (inactif ? ';opacity:.5' : '') + '">' +
        '<td style="padding:10px 8px">' + esc(nomComplet(e)) + '</td>' +
        '<td style="padding:10px 8px;text-align:right">' + duree(e.site_seconds) + '</td>' +
        '<td style="padding:10px 8px;text-align:right;font-weight:600;color:' + VERT + '">' + duree(e.kalam_seconds) + '</td>' +
        '<td style="padding:10px 8px;text-align:right">' + e.kalam_sessions + '</td>' +
        '<td style="padding:10px 8px;color:#666">' + dateFr(e.last_seen_at) + '</td>' +
      '</tr>' +
      '<tr class="detail-' + e.id + '" style="display:none"><td colspan="5" style="padding:0;background:#fafafa"></td></tr>';
    });

    out += '</tbody></table></div>' +
      '<p style="margin-top:12px;color:#888;font-size:12px">Touchez une ligne pour voir le détail des sessions.</p>';
    return out;
  }

  function carte(titre, valeur) {
    return '<div style="flex:1;min-width:130px;background:#fff;border:1px solid #e0e0e0;border-left:4px solid ' + OR + ';border-radius:6px;padding:10px 12px">' +
      '<div style="font-size:12px;color:#777">' + titre + '</div>' +
      '<div style="font-size:20px;font-weight:700;color:' + VERT + '">' + valeur + '</div>' +
    '</div>';
  }

  function htmlSessions(sessions) {
    if (!sessions.length) return '<div style="padding:12px;color:#777">Aucune session enregistrée.</div>';
    var out = '<div style="padding:10px 14px"><table style="width:100%;border-collapse:collapse;font-size:13px">';
    sessions.forEach(function (s) {
      var badge = s.kind === 'kalam'
        ? '<span style="background:' + VERT + ';color:#fff;padding:2px 8px;border-radius:10px;font-size:11px">Kalam</span>'
        : '<span style="background:#ddd;color:#444;padding:2px 8px;border-radius:10px;font-size:11px">Site</span>';
      out += '<tr style="border-bottom:1px solid #eee">' +
        '<td style="padding:6px 4px;width:70px">' + badge + '</td>' +
        '<td style="padding:6px 4px">' + dateFr(s.started_at) + '</td>' +
        '<td style="padding:6px 4px;text-align:right;font-weight:600">' + duree(s.duration_seconds) + '</td>' +
      '</tr>';
    });
    return out + '</table></div>';
  }

  // ── Interactions ────────────────────────────────────────────
  function brancherClics(root) {
    root.addEventListener('click', function (ev) {
      var tr = ev.target.closest ? ev.target.closest('tr[data-eleve]') : null;
      if (!tr || !root.contains(tr)) return;

      var id = tr.getAttribute('data-eleve');
      var ligne = root.querySelector('.detail-' + id);
      if (!ligne) return;
      var cell = ligne.firstElementChild;

      if (ligne.style.display !== 'none') { ligne.style.display = 'none'; return; }
      ligne.style.display = '';
      cell.innerHTML = '<div style="padding:12px;color:#777">Chargement…</div>';

      api('/api/admin/tracking/students/' + id)
        .then(function (sessions) { cell.innerHTML = htmlSessions(sessions); })
        .catch(function () { cell.innerHTML = '<div style="padding:12px;color:#c00">Impossible de charger le détail.</div>'; });
    });
  }

  function charger() {
    if (!mounted || loading) return;
    loading = true;
    mounted.innerHTML = '<p style="color:#777">Chargement des temps de connexion…</p>';

    api('/api/admin/tracking/students')
      .then(function (eleves) {
        mounted.innerHTML = html(eleves);
        loaded = true;
      })
      .catch(function (err) {
        loaded = false;
        mounted.innerHTML = err.message === 'non-connecte'
          ? '<p style="color:#c00">Connectez-vous à l\'espace gérant pour voir ces données.</p>'
          : '<p style="color:#c00">Données indisponibles. Vérifiez que le serveur est bien à jour.</p>';
      })
      .then(function () { loading = false; });
  }

  // ── Trouver où se greffer ───────────────────────────────────
  function chercherPanneau() {
    var noeuds = document.querySelectorAll('div,section');
    var meilleur = null;
    for (var i = 0; i < noeuds.length; i++) {
      var n = noeuds[i];
      var sig = ((n.id || '') + ' ' + String(n.className || '')).toLowerCase();
      if (sig.indexOf('kalam') === -1) continue;
      // On garde le conteneur le plus profond qui contient encore peu de choses :
      // c'est le panneau de l'onglet, pas la page entière.
      if (!meilleur || n.contains(meilleur) === false) meilleur = n;
    }
    return meilleur;
  }

  function creerPanneauFlottant() {
    var btn = document.createElement('button');
    btn.textContent = '⏱️ Temps élèves';
    btn.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:9998;background:' + VERT +
      ';color:#fff;border:0;border-radius:24px;padding:12px 18px;font-size:14px;box-shadow:0 2px 10px rgba(0,0,0,.3)';

    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.5);display:none;padding:16px;overflow:auto';

    var boite = document.createElement('div');
    boite.style.cssText = 'background:#fff;border-radius:10px;padding:16px;max-width:900px;margin:0 auto';

    var fermer = document.createElement('button');
    fermer.textContent = '✕ Fermer';
    fermer.style.cssText = 'float:right;border:0;background:#eee;border-radius:6px;padding:6px 12px';

    var corps = document.createElement('div');
    corps.style.clear = 'both';

    boite.appendChild(fermer);
    boite.appendChild(corps);
    overlay.appendChild(boite);
    document.body.appendChild(btn);
    document.body.appendChild(overlay);

    btn.onclick = function () { overlay.style.display = 'block'; charger(); };
    fermer.onclick = function () { overlay.style.display = 'none'; };

    return corps;
  }

  function visible(el) {
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  function demarrer() {
    var panneau = chercherPanneau();

    if (panneau) {
      // On ajoute notre bloc sans toucher au contenu déjà présent
      var bloc = document.createElement('div');
      bloc.id = 'kalam-temps-eleves';
      bloc.style.marginTop = '16px';
      panneau.appendChild(bloc);
      mounted = bloc;
      brancherClics(bloc);

      // Charge quand l'onglet devient visible (et une fois au démarrage s'il l'est déjà)
      if (visible(panneau)) charger();
      setInterval(function () {
        if (!loaded && !loading && visible(panneau)) charger();
      }, 1000);
    } else {
      mounted = creerPanneauFlottant();
      brancherClics(mounted);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', demarrer);
  } else {
    demarrer();
  }
})();

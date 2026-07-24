/**
 * tracking-client.js — Mesure le temps de présence de l'élève sur le site.
 * À inclure dans espace-eleve.html : <script src="/tracking-client.js"></script>
 *
 * Envoie un ping toutes les 60 s tant que l'onglet est visible.
 * Le serveur (routes/tracking.js) regroupe les pings en sessions.
 * Aucune donnée n'est envoyée si l'élève n'est pas connecté.
 */
(function () {
  'use strict';

  var INTERVAL_MS = 60 * 1000;
  var timer = null;
  var stopped = false;

  // Les jetons du serveur sont générés par crypto.randomBytes(64).toString('hex')
  // → 128 caractères hexadécimaux. On s'appuie sur cette forme pour le retrouver,
  // quel que soit le nom de la clé utilisée par la page.
  var TOKEN_SHAPE = /^[a-f0-9]{100,}$/i;

  function findToken() {
    var stores = [];
    try { stores.push(window.localStorage); } catch (e) {}
    try { stores.push(window.sessionStorage); } catch (e) {}

    // 1) Noms de clés les plus probables d'abord
    var preferred = ['studentToken', 'student_token', 'token', 'authToken', 'eleveToken'];
    for (var s = 0; s < stores.length; s++) {
      for (var p = 0; p < preferred.length; p++) {
        try {
          var v = stores[s].getItem(preferred[p]);
          if (v && TOKEN_SHAPE.test(v)) return v;
        } catch (e) {}
      }
    }

    // 2) Sinon : n'importe quelle valeur ayant la forme d'un jeton serveur
    for (var i = 0; i < stores.length; i++) {
      try {
        for (var k = 0; k < stores[i].length; k++) {
          var key = stores[i].key(k);
          var val = stores[i].getItem(key);
          if (val && TOKEN_SHAPE.test(val)) return val;
        }
      } catch (e) {}
    }
    return null;
  }

  function ping() {
    if (stopped) return;
    if (document.hidden) return; // onglet en arrière-plan : on ne compte pas

    var token = findToken();
    if (!token) return; // élève non connecté : rien à mesurer

    fetch('/api/tracking/ping', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-student-token': token,
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ kind: 'site' }),
      keepalive: true
    }).then(function (r) {
      // Session expirée ou élève déconnecté : on arrête pour ne pas boucler dans le vide
      if (r.status === 401) stop();
    }).catch(function () {
      // Réseau coupé : on ignore, le prochain ping réessaiera
    });
  }

  function start() {
    if (timer) return;
    ping();
    timer = setInterval(ping, INTERVAL_MS);
  }

  function stop() {
    stopped = true;
    if (timer) { clearInterval(timer); timer = null; }
  }

  // Reprend le comptage dès que l'élève revient sur l'onglet
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && !stopped) ping();
  });

  // Dernier ping au moment de quitter la page, pour ne pas perdre les dernières minutes
  window.addEventListener('pagehide', function () {
    if (!stopped) ping();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();

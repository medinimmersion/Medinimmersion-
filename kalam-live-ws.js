/**
 * kalam-live-ws.js — Proxy WebSocket temps réel entre le navigateur et la Gemini Live API.
 * Le navigateur ne voit jamais la clé : il parle à /ws/kalam, on relaie vers Gemini Live.
 * Voix en streaming (comme le mode vocal de ChatGPT).
 */
'use strict';

const { WebSocketServer, WebSocket } = require('ws');

function getGeminiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
}

// On essaie plusieurs modèles/versions d'API Live jusqu'à en trouver un qui marche
// avec la clé (les noms/accès varient selon les comptes). Surchargable via env.
const ATTEMPTS = process.env.GEMINI_LIVE_MODEL
  ? [{ ver: 'v1beta', model: process.env.GEMINI_LIVE_MODEL }]
  : [
      { ver: 'v1beta', model: 'models/gemini-2.0-flash-live-001' },
      { ver: 'v1beta', model: 'models/gemini-live-2.5-flash-preview' },
      { ver: 'v1alpha', model: 'models/gemini-2.0-flash-live-001' },
      { ver: 'v1alpha', model: 'models/gemini-live-2.5-flash-preview' },
      { ver: 'v1beta', model: 'models/gemini-2.5-flash-preview-native-audio-dialog' },
    ];
function wsUrl(ver, key) {
  return `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.${ver}.GenerativeService.BidiGenerateContent?key=${key}`;
}

function buildSystemPrompt({ lang, level, gender, studentName, studentContext }) {
  const langName = lang === 'ar' ? 'arabe' : lang === 'en' ? 'anglais' : 'français';
  const levelTxt = level === 'avance' ? 'avancé — conversation riche, sujets variés'
    : level === 'intermediaire' ? 'intermédiaire — phrases complètes mais simples'
    : 'débutant — mots simples, phrases très courtes, beaucoup de répétition';
  const fem = String(gender || '').toLowerCase() === 'femme';
  return `Tu es ${fem ? 'Oustaza' : 'Oustaz'} Kalam, professeur d'arabe chaleureux de l'école Médin'Immersion. Tu parles à l'oral avec un élève (conversation vocale en temps réel).

RÈGLES ABSOLUES (voix) :
- Réponds en 1 à 3 phrases courtes MAXIMUM. C'est une conversation parlée, pas un cours écrit.
- Jamais d'énumération, jamais de listes. Uniquement du langage parlé naturel.
- RÉPONDS UNIQUEMENT EN ${langName}. NE MÉLANGE JAMAIS LES LANGUES.
- Niveau de l'élève : ${levelTxt}.
- ${fem ? 'TU ES UNE FEMME. Parle de toi au féminin.' : 'TU ES UN HOMME. Parle de toi au masculin.'}
${studentName ? `- L'élève s'appelle ${studentName}. Utilise son prénom de temps en temps.` : ''}

TON STYLE :
- Chaleureux, vivant, encourageant, comme un vrai professeur en face à face. Salue avec "as-salamou alaykoum" au premier échange seulement.
- Si l'élève fait une erreur en arabe, corrige doucement en une phrase, puis continue.
- Félicite brièvement quand l'élève réussit ("ahsant", "moumtaz").
- Pose UNE question simple à la fin de la plupart de tes réponses pour faire parler l'élève.
- Connaissances : arabe (fusha), bases de tajwid, culture de Médine, vocabulaire coranique. Ramène gentiment vers la pratique de l'arabe si on s'en éloigne.${studentContext || ''}`;
}

module.exports = function attachKalamLive(server, pool, opts) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    let pathname = '';
    try { pathname = new URL(req.url, 'http://x').pathname; } catch { pathname = ''; }
    if (pathname !== '/ws/kalam') return; // ne touche pas aux autres upgrades éventuels
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  wss.on('connection', async (client, req) => {
    const KEY = getGeminiKey();
    if (!KEY) {
      try { client.send(JSON.stringify({ error: 'Clé Gemini manquante côté serveur.' })); } catch {}
      try { client.close(); } catch {}
      return;
    }

    const params = new URL(req.url, 'http://x').searchParams;
    const lang = params.get('lang') || 'fr';
    const level = params.get('level') || 'debutant';
    const gender = params.get('gender') || 'homme';
    const studentName = params.get('name') || '';
    const voiceName = String(gender).toLowerCase() === 'femme' ? 'Sulafat' : 'Puck';

    // Contexte élève réel (niveau/page/notes) si un token valide est fourni
    let studentContext = '';
    try {
      const token = params.get('token');
      const entry = token && opts && opts.studentTokens && opts.studentTokens.get(token);
      const studentId = entry && Date.now() <= entry.expires ? entry.id : null;
      if (studentId && pool) {
        const pr = await pool.query('SELECT niveau, current_page, notes FROM student_progression WHERE student_id = $1', [studentId]);
        if (pr.rows.length) {
          const { niveau, current_page, notes } = pr.rows[0];
          studentContext = `

CONTEXTE RÉEL DE L'ÉLÈVE (confidentiel, ne le récite pas) : Niveau ${niveau} du programme Médine, page ${current_page || 1}. Adapte-toi strictement à ce niveau.${notes ? ` Remarque du professeur : « ${String(notes).slice(0, 200)} ».` : ''}`;
        }
      }
    } catch (e) { console.error('[kalam-live] contexte élève:', e.message); }

    const systemText = buildSystemPrompt({ lang, level, gender, studentName, studentContext });

    const setupMsg = JSON.stringify({
      setup: {
        generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } } },
        systemInstruction: { parts: [{ text: systemText }] }
      }
    });

    let upstream = null;      // upstream courant
    let setupOk = false;      // un modèle a réussi
    let idx = 0;              // index de tentative
    const queue = [];         // messages navigateur en attente
    const failReasons = [];

    function tryNext() {
      if (setupOk) return;
      if (idx >= ATTEMPTS.length) {
        try { client.send(JSON.stringify({ error: 'Aucun modèle Gemini Live accessible avec cette clé. Détails: ' + failReasons.join(' | ') })); } catch {}
        try { client.close(); } catch {}
        return;
      }
      const { ver, model } = ATTEMPTS[idx++];
      const up = new WebSocket(wsUrl(ver, KEY));
      upstream = up;
      let thisOk = false;

      up.on('open', () => {
        // injecte le modèle dans le setup pour cette tentative
        const m = JSON.parse(setupMsg); m.setup.model = model;
        up.send(JSON.stringify(m));
      });
      up.on('message', (data) => {
        const txt = typeof data === 'string' ? data : data.toString();
        if (!thisOk) {
          if (txt.indexOf('setupComplete') === -1) return; // essai en cours de validation : on ne transmet rien encore
          thisOk = true; setupOk = true;
          console.log('[kalam-live] ✓ modèle actif:', ver, model);
          while (queue.length) { try { up.send(queue.shift()); } catch {} }
        }
        if (client.readyState === WebSocket.OPEN) { try { client.send(txt); } catch {} }
      });
      up.on('close', (code, reason) => {
        const r = reason ? reason.toString() : '';
        if (!thisOk && !setupOk) {
          failReasons.push(`${model}(${code}${r ? ':' + r.slice(0, 80) : ''})`);
          console.log('[kalam-live] ✗', ver, model, 'code', code, r);
          setTimeout(tryNext, 120); // essai suivant
        } else if (thisOk) {
          try { client.close(); } catch {}
        }
      });
      up.on('error', (e) => { console.log('[kalam-live] err', ver, model, e.message); /* close suivra */ });
    }
    tryNext();

    // navigateur → Gemini (bufferise tant qu'aucun modèle n'a réussi)
    client.on('message', (data) => {
      const msg = typeof data === 'string' ? data : data.toString();
      if (setupOk && upstream && upstream.readyState === WebSocket.OPEN) upstream.send(msg);
      else queue.push(msg);
    });
    client.on('close', () => { try { upstream && upstream.close(); } catch {} });
    client.on('error', () => { try { upstream && upstream.close(); } catch {} });
  });

  console.log('[kalam-live] Proxy WebSocket Gemini Live actif sur /ws/kalam (' + ATTEMPTS.length + ' modèle(s) à essayer)');
};

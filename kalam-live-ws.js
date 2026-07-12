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

// Modèles de secours si la découverte automatique échoue. Surchargable via env.
const FALLBACK_MODELS = process.env.GEMINI_LIVE_MODEL
  ? [process.env.GEMINI_LIVE_MODEL]
  : [
      'models/gemini-3.1-flash-live-preview',
      'models/gemini-2.0-flash-exp',
      'models/gemini-2.0-flash-live-001',
      'models/gemini-live-2.5-flash-preview',
      'models/gemini-2.5-flash-preview-native-audio-dialog',
    ];
function wsUrl(ver, key) {
  return `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.${ver}.GenerativeService.BidiGenerateContent?key=${key}`;
}

// Demande à Google la liste des modèles qui supportent le temps réel (bidiGenerateContent).
async function discoverLiveModels(key) {
  const found = [];
  for (const ver of ['v1beta', 'v1alpha']) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/${ver}/models?key=${key}&pageSize=1000`);
      const d = await r.json();
      (d.models || []).forEach(m => {
        const methods = m.supportedGenerationMethods || m.supported_generation_methods || [];
        if (methods.some(x => /bidi/i.test(x))) found.push(m.name);
      });
      if (found.length) return { ver, models: [...new Set(found)] };
    } catch (e) { console.error('[kalam-live] discover ' + ver + ':', e.message); }
  }
  return { ver: 'v1beta', models: [] };
}

// Construit la liste d'essais (modèles découverts d'abord, puis secours), sur les deux versions.
function buildAttempts(discovered) {
  const attempts = [];
  const push = (ver, model) => { if (!attempts.some(a => a.ver === ver && a.model === model)) attempts.push({ ver, model }); };
  if (discovered.models.length) discovered.models.forEach(m => push(discovered.ver, m));
  FALLBACK_MODELS.forEach(m => { push('v1beta', m); push('v1alpha', m); });
  return attempts;
}

function buildSystemPrompt({ lang, level, gender, studentName, studentContext }) {
  const langName = lang === 'ar' ? 'arabe' : lang === 'en' ? 'anglais' : 'français';
  const levelTxt = level === 'avance' ? 'avancé — conversation riche, sujets variés'
    : level === 'intermediaire' ? 'intermédiaire — phrases complètes mais simples'
    : 'débutant — mots simples, phrases très courtes, beaucoup de répétition';
  const fem = String(gender || '').toLowerCase() === 'femme';
  const personaName = fem ? 'Oustaza Oum Adam' : 'Oustaz Abou Adam';
  return `Tu es ${personaName}, professeur d'arabe chaleureux de l'école Médin'Immersion. Tu parles à l'oral avec un élève (conversation vocale en temps réel).

RÈGLES ABSOLUES (voix) :
- Réponds en 1 à 3 phrases courtes MAXIMUM. C'est une conversation parlée, pas un cours écrit.
- Jamais d'énumération, jamais de listes. Uniquement du langage parlé naturel.
- RÉPONDS UNIQUEMENT EN ${langName}. NE MÉLANGE JAMAIS LES LANGUES.
- Niveau de l'élève : ${levelTxt}.
- Ton nom est ${personaName}. Si l'élève te demande ton nom, réponds ${personaName}.
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
        systemInstruction: { parts: [{ text: systemText }] },
        // Transcriptions texte de la voix (élève + Kalam) pour afficher la conversation
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        // Détection de fin de parole plus réactive : répond dès ~350ms de silence
        // (au lieu de ~1s+ par défaut) pour une conversation plus vive.
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false,
            startOfSpeechSensitivity: 'START_SENSITIVITY_HIGH',
            endOfSpeechSensitivity: 'END_SENSITIVITY_HIGH',
            prefixPaddingMs: 20,
            silenceDurationMs: 350
          }
        }
      }
    });

    // Découvre les modèles temps réel réellement dispo pour cette clé, puis construit la liste d'essais
    const discovered = await discoverLiveModels(KEY);
    const ATTEMPTS = buildAttempts(discovered);
    console.log('[kalam-live] modèles découverts:', discovered.models.join(', ') || '(aucun)', '| essais:', ATTEMPTS.length);

    let upstream = null;      // upstream courant
    let setupOk = false;      // un modèle a réussi
    let idx = 0;              // index de tentative
    const queue = [];         // messages navigateur en attente
    const failReasons = [];

    function tryNext() {
      if (setupOk) return;
      if (idx >= ATTEMPTS.length) {
        const disc = discovered.models.length ? 'Dispo: ' + discovered.models.join(', ') + '. ' : 'Aucun modèle temps réel trouvé pour cette clé. ';
        try { client.send(JSON.stringify({ error: disc + 'Refus: ' + failReasons.join(' | ') })); } catch {}
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

  console.log('[kalam-live] Proxy WebSocket Gemini Live actif sur /ws/kalam (découverte auto + ' + FALLBACK_MODELS.length + ' secours)');
};

// Crée un jeton éphémère pour que le NAVIGATEUR parle directement à Google (sans détour serveur).
async function createEphemeralToken(key, apiVersion) {
  const now = Date.now();
  const body = {
    uses: 1,
    expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
    newSessionExpireTime: new Date(now + 2 * 60 * 1000).toISOString()
  };
  const r = await fetch(`https://generativelanguage.googleapis.com/${apiVersion}/auth_tokens?key=${key}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d.error && d.error.message) || ('HTTP ' + r.status));
  return d.name; // ex: "auth_tokens/xxxxx"
}

// Découvre un modèle Live pour une version d'API précise (v1alpha pour les jetons éphémères).
async function discoverLiveModelsForVersion(key, apiVersion) {
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/${apiVersion}/models?key=${key}&pageSize=1000`);
    const d = await r.json();
    const models = (d.models || [])
      .filter(m => (m.supportedGenerationMethods || m.supported_generation_methods || []).some(x => /bidi/i.test(x)))
      .map(m => m.name);
    return [...new Set(models)];
  } catch { return []; }
}

module.exports.buildSystemPrompt = buildSystemPrompt;
module.exports.discoverLiveModels = discoverLiveModels;
module.exports.discoverLiveModelsForVersion = discoverLiveModelsForVersion;
module.exports.createEphemeralToken = createEphemeralToken;
module.exports.FALLBACK_MODELS = FALLBACK_MODELS;

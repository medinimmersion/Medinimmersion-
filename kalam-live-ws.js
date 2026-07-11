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

// Modèle Live (audio bidirectionnel temps réel). Surchargable via env.
const LIVE_MODEL = process.env.GEMINI_LIVE_MODEL || 'models/gemini-2.0-flash-live-001';
const GEMINI_WS = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

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

    // Connexion montante vers Gemini Live
    const upstream = new WebSocket(`${GEMINI_WS}?key=${KEY}`);
    let upstreamOpen = false;
    const queue = [];

    upstream.on('open', () => {
      upstreamOpen = true;
      upstream.send(JSON.stringify({
        setup: {
          model: LIVE_MODEL,
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } }
          },
          systemInstruction: { parts: [{ text: systemText }] }
        }
      }));
      // vide la file d'attente des messages client reçus avant l'ouverture
      while (queue.length) upstream.send(queue.shift());
    });

    // Gemini → navigateur
    upstream.on('message', (data) => {
      if (client.readyState === WebSocket.OPEN) {
        try { client.send(typeof data === 'string' ? data : data.toString()); } catch {}
      }
    });
    upstream.on('close', () => { try { client.close(); } catch {} });
    upstream.on('error', (e) => {
      console.error('[kalam-live] upstream error:', e.message);
      try { client.send(JSON.stringify({ error: 'Gemini Live: ' + e.message })); } catch {}
      try { client.close(); } catch {}
    });

    // navigateur → Gemini
    client.on('message', (data) => {
      const msg = typeof data === 'string' ? data : data.toString();
      if (upstreamOpen && upstream.readyState === WebSocket.OPEN) upstream.send(msg);
      else queue.push(msg);
    });
    client.on('close', () => { try { upstream.close(); } catch {} });
    client.on('error', () => { try { upstream.close(); } catch {} });
  });

  console.log('[kalam-live] Proxy WebSocket Gemini Live actif sur /ws/kalam (modèle ' + LIVE_MODEL + ')');
};

/**
 * routes/kalam-live-token.js — Fournit au navigateur un jeton éphémère + la config,
 * pour qu'il se connecte DIRECTEMENT à la Gemini Live API (latence réduite, sans détour serveur).
 * La clé Gemini reste côté serveur : seul un jeton court (2 min) est exposé.
 */
'use strict';

module.exports = function (pool, opts) {
  const router = require('express').Router();
  const live = require('../kalam-live-ws');

  function getKey() { return process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY; }
  function optionalStudentId(req) {
    try {
      const auth = req.headers.authorization || '';
      if (!auth.startsWith('Bearer ')) return null;
      const entry = opts.studentTokens && opts.studentTokens.get(auth.slice(7));
      return entry && Date.now() <= entry.expires ? entry.id : null;
    } catch { return null; }
  }

  router.get('/api/kalam/live-token', async (req, res) => {
    try {
      const key = getKey();
      if (!key) return res.status(503).json({ error: 'Clé Gemini manquante côté serveur.' });

      const lang = req.query.lang || 'fr';
      const level = req.query.level || 'debutant';
      const gender = req.query.gender || 'homme';
      const name = req.query.name || '';
      const voiceName = String(gender).toLowerCase() === 'femme' ? 'Sulafat' : 'Puck';

      // Contexte réel de l'élève (niveau/page/notes)
      let studentContext = '';
      const sid = optionalStudentId(req);
      if (sid && pool) {
        try {
          const pr = await pool.query('SELECT niveau, current_page, notes FROM student_progression WHERE student_id = $1', [sid]);
          if (pr.rows.length) {
            const { niveau, current_page, notes } = pr.rows[0];
            studentContext = `

CONTEXTE RÉEL DE L'ÉLÈVE (confidentiel, ne le récite pas) : Niveau ${niveau} du programme Médine, page ${current_page || 1}. Adapte-toi strictement à ce niveau.${notes ? ` Remarque du professeur : « ${String(notes).slice(0, 200)} ».` : ''}`;
          }
        } catch (e) { console.error('[live-token] contexte:', e.message); }
      }

      const systemText = live.buildSystemPrompt({ lang, level, gender, studentName: name, studentContext });

      // Les jetons éphémères sont servis en v1alpha
      const apiVersion = 'v1alpha';
      const models = await live.discoverLiveModelsForVersion(key, apiVersion);
      const model = models[0] || live.FALLBACK_MODELS[0] || 'models/gemini-2.0-flash-live-001';

      const token = await live.createEphemeralToken(key, apiVersion);

      const setup = {
        model,
        generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } } },
        systemInstruction: { parts: [{ text: systemText }] },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false,
            startOfSpeechSensitivity: 'START_SENSITIVITY_HIGH',
            endOfSpeechSensitivity: 'END_SENSITIVITY_HIGH',
            prefixPaddingMs: 20,
            silenceDurationMs: 350
          }
        }
      };

      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.${apiVersion}.GenerativeService.BidiGenerateContent?access_token=${encodeURIComponent(token)}`;
      res.json({ ok: true, wsUrl, setup, model });
    } catch (e) {
      console.error('[live-token]', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  return router;
};

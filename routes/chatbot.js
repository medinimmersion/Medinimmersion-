const express = require('express');

module.exports = function(pool, opts) {
  const router = express.Router();

// ════════════════════════════════════════════════════════════════
// KALAM AI TUTOR — GEMINI ONLY (No OpenAI dependency)
// Routes: /api/oustaz/chat, /api/oustaz/tts, /api/oustaz/quota
// ════════════════════════════════════════════════════════════════

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// ─── CHAT (Gemini) ───
router.post('/chat', async (req, res) => {
  const { message, history, lang, level, student_name, gender, persona } = req.body || {};
  if (!message || !GEMINI_KEY) return res.status(400).json({ error: 'Message et GEMINI_API_KEY requis' });

  const isFem = String(gender || '').toLowerCase() === 'femme';
  const pName = persona || (isFem ? 'Oustaza Oum Adam' : 'Oustaz Abou Adam');

  const systemPrompt = `Tu es ${pName}, ${isFem ? "professeure d'arabe chaleureuse" : "professeur d'arabe chaleureux"} de l'école Médin'Immersion. Tu parles à l'oral avec ${isFem ? 'une élève (une sœur)' : 'un élève (un frère)'} — conversation vocale en temps réel.
- Tu es ${isFem ? 'une femme : parle de toi au féminin' : 'un homme : parle de toi au masculin'}, et adresse-toi à l'élève ${isFem ? 'au féminin, en français comme en arabe (baraka Allahou fiki, ahsanti, kayfa hâluki...)' : 'au masculin, en français comme en arabe (baraka Allahou fik, ahsant, kayfa hâluk...)'}. 
- Niveau : ${level || 'Débutant'}. Langue : ${lang === 'ar' ? 'Arabe' : 'Français'}.
- Réponds en 2-3 phrases ORALES COURTES (comme dans une vraie conversation), jamais de listes ni de texte long.
- Si on te demande quelque chose en arabe, réponds d'abord en arabe, puis traduis brièvement en français.
- Sois bienveillant(e), encourage l'élève, utilise le bon genre de politesse.`;

  try {
    const historyFormatted = history.slice(-6).map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }));

    const gr = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent?key=' + GEMINI_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [
          ...historyFormatted,
          { role: 'user', parts: [{ text: message }] }
        ],
        generationConfig: {
          maxOutputTokens: 180,
          temperature: 0.75,
          thinkingConfig: { thinkingBudget: 0 }
        }
      })
    });

    const gd = await gr.json();
    if (!gr.ok) {
      console.error('[oustaz/chat gemini]', gd.error?.message || JSON.stringify(gd));
      return res.status(gr.status).json({ error: gd.error?.message || 'Gemini error' });
    }

    const text = gd.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) return res.status(500).json({ error: 'Pas de réponse de Gemini' });

    res.json({ response: text });
  } catch (e) {
    console.error('[oustaz/chat]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── TTS (Gemini Text-to-Speech) ───
function pcmToWav(pcm, sampleRate) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22); header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

router.post('/tts', async (req, res) => {
  const { text, lang, gender } = req.body || {};
  if (!text || !GEMINI_KEY) return res.status(400).json({ error: 'Texte et GEMINI_API_KEY requis' });

  const isFem = String(gender || '').toLowerCase() === 'femme';
  const voiceName = isFem ? (process.env.GEMINI_TTS_VOICE_F || 'Sulafat') : (process.env.GEMINI_TTS_VOICE_M || 'Charon');
  const ttsModel = 'gemini-2.5-flash-preview-tts';

  try {
    const gr = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + ttsModel + ':generateContent?key=' + GEMINI_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: String(text).slice(0, 1500) }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } }
        }
      })
    });

    const gd = await gr.json();
    if (gr.ok) {
      const part = gd.candidates?.[0]?.content?.parts?.find(p => p.inlineData && p.inlineData.data);
      if (part) {
        const pcm = Buffer.from(part.inlineData.data, 'base64');
        const rateMatch = /rate=(\d+)/.exec(part.inlineData.mimeType || '');
        const wav = pcmToWav(pcm, rateMatch ? parseInt(rateMatch[1], 10) : 24000);
        res.set({ 'Content-Type': 'audio/wav', 'Content-Length': wav.length, 'Cache-Control': 'no-store' });
        return res.send(wav);
      }
    }
    console.error('[oustaz/tts gemini]', gd.error?.message);
    return res.status(503).json({ error: gd.error?.message || 'TTS failed' });
  } catch (e) {
    console.error('[oustaz/tts]', e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ─── QUOTA ───
router.get('/quota', (req, res) => {
  res.json({ gemini: 'active', openai: 'disabled' });
});

  return router;
};

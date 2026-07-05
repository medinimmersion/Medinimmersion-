const express = require('express');

module.exports = function(pool, opts) {
  const router = express.Router();
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  router.post('/api/oustaz/chat', async (req, res) => {
    try {
      const { message, history, lang, level, student_name, gender, persona } = req.body || {};
      
      if (!message) return res.status(400).json({ error: 'Message required' });
      if (!GEMINI_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

      const isFem = String(gender || '').toLowerCase() === 'femme';
      const pName = persona || (isFem ? 'Oustaza Oum Adam' : 'Oustaz Abou Adam');

      const systemPrompt = 'Tu es ' + pName + '. Réponds en 2-3 phrases courtes en ' + (lang === 'ar' ? 'arabe' : 'français') + '.';

      const contents = [
        ...(history || []).slice(-4).map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.text }]
        })),
        { role: 'user', parts: [{ text: message }] }
      ];

      const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent?key=' + GEMINI_KEY;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { maxOutputTokens: 150, temperature: 0.7 }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[GEMINI ERROR]', data);
        return res.status(response.status).json({ error: data.error?.message || 'Gemini API error' });
      }

      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!reply) return res.status(500).json({ error: 'No response from Gemini' });

      res.json({ response: reply });
    } catch (err) {
      console.error('[CHAT EXCEPTION]', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/api/oustaz/tts', async (req, res) => {
    try {
      const { text, gender } = req.body || {};
      if (!text) return res.status(400).json({ error: 'Text required' });
      if (!GEMINI_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

      const isFem = String(gender || '').toLowerCase() === 'femme';
      const voiceName = isFem ? 'Sulafat' : 'Charon';

      const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=' + GEMINI_KEY;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: String(text).slice(0, 500) }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } }
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[TTS ERROR]', data);
        return res.status(response.status).json({ error: data.error?.message || 'TTS failed' });
      }

      const audio = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      if (!audio) return res.status(500).json({ error: 'No audio data' });

      const wav = Buffer.from(audio.inlineData.data, 'base64');
      res.set('Content-Type', 'audio/wav');
      res.send(wav);
    } catch (err) {
      console.error('[TTS EXCEPTION]', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/api/oustaz/quota', (req, res) => {
    res.json({ status: 'ok', gemini: GEMINI_KEY ? 'configured' : 'missing' });
  });

  return router;
};

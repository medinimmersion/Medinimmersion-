const express = require('express');

module.exports = function(pool, opts) {
  const router = express.Router();

  router.post('/api/oustaz/chat', async (req, res) => {
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    try {
      const { message, history, lang, level, student_name, gender, persona } = req.body;
      if (!message || !GEMINI_KEY) return res.status(400).json({ error: 'Missing data' });

      const isFem = String(gender || '').toLowerCase() === 'femme';
      const name = persona || (isFem ? 'Oustaza Oum Adam' : 'Oustaz Abou Adam');

      const systemPrompt = 'Tu es ' + name + '. Réponds en 2-3 phrases courtes uniquement.';
      const recentHistory = (history || []).slice(-4);

      const contents = [
        ...recentHistory.map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: String(m.text) }]
        })),
        { role: 'user', parts: [{ text: String(message) }] }
      ];

      const payload = {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: contents,
        generationConfig: {
          maxOutputTokens: 100,
          temperature: 0.7
        }
      };

      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent?key=' + GEMINI_KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        console.error('Gemini error:', data.error || data);
        return res.status(500).json({ error: data.error?.message || 'Gemini failed' });
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return res.status(500).json({ error: 'No response' });

      res.json({ response: text });
    } catch (e) {
      console.error('Chat error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/api/oustaz/tts', async (req, res) => {
    const GEMINI_KEY = process.env.GEMINI_API_KEY;

    try {
      const { text, gender } = req.body;
      if (!text || !GEMINI_KEY) return res.status(400).json({ error: 'Missing data' });

      const isFem = String(gender || '').toLowerCase() === 'femme';
      const voice = isFem ? 'Sulafat' : 'Charon';

      const payload = {
        contents: [{ parts: [{ text: String(text).slice(0, 500) }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice }
            }
          }
        }
      };

      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=' + GEMINI_KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        console.error('TTS error:', data.error || data);
        return res.status(500).json({ error: data.error?.message || 'TTS failed' });
      }

      const audioData = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      if (!audioData) return res.status(500).json({ error: 'No audio' });

      const wav = Buffer.from(audioData.inlineData.data, 'base64');
      res.set('Content-Type', 'audio/wav');
      res.set('Content-Length', wav.length);
      res.set('Cache-Control', 'no-store');
      res.send(wav);
    } catch (e) {
      console.error('TTS error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/api/oustaz/quota', (req, res) => {
    res.json({ ok: true });
  });

  return router;
};

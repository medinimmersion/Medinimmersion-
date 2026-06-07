/**
 * routes/chatbot.js — AI chat integration (OpenAI GPT-4o-mini)
 * Owns: /api/chat, /api/ia/chat (free conversation), /api/student/oustaz/chat (voice tutor)
 */
'use strict';

module.exports = function (pool, opts) {
  const router = require('express').Router();
  const OpenAI = require('openai');

  function getClient() {
    return new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || undefined
    });
  }

  // POST /api/chatbot — general AI chatbot (floating widget on homepage)
  router.post('/api/chatbot', async (req, res) => {
    try {
      const { message, conversation_id } = req.body;
      if (!message) return res.status(400).json({ error: 'Message requis' });

      const client = getClient();
      const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
      const messages = [
        { role: 'system', content: 'Tu es un assistant d apprentissage de l arabe pour MedinImmersion. Réponds en français, sois clair et encourageant.' }
      ];

      if (conversation_id) {
        const hist = await pool.query(
          'SELECT role, content FROM ai_messages WHERE conversation_id = $1 ORDER BY created_at LIMIT 50',
          [conversation_id]
        );
        hist.rows.forEach(m => messages.push({ role: m.role, content: m.content }));
      }
      messages.push({ role: 'user', content: message });

      const resp = await client.chat.completions.create({ model, messages });
      res.json({ response: resp.choices[0].message.content });
    } catch (err) { console.error('[chat]', err.message); res.status(500).json({ error: 'Erreur IA' }); }
  });

  // POST /api/ia/chat — free conversation (student ↔ Arabic AI tutor)
  router.post('/api/ia/chat', async (req, res) => {
    try {
      const { message, teacher_type, student_level, conversation_id, student_id } = req.body;
      if (!message) return res.status(400).json({ error: 'Message requis' });

      const client = getClient();
      const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
      const teacherT = teacher_type || 'oustaz';
      const level = student_level || 'debutant';

      const systemPrompt = `Tu es un professeur d'arabe/${teacherT === 'oustaza' ? 'femme' : 'homme'} à MedinImmersion.
Niveau de l'élève: ${level === 'debutant' ? 'Débutant (مبتدئ) — utilise vocabulaire simple et phrases courtes' : level === 'intermediaire' ? 'Intermédiaire (متوسط) — peux utiliser des phrases plus complexes' : 'Avancé (متقدم) — peux discuter de sujets variés'}.
Règles:
- Réponds EN FRANÇAIS mais inclots des mots/arabes courts naturellement
- Corrige les erreurs arabes avec emoji ✏️ suivi de la correction
- Encourage avec 🌟 أحسنت quand correct
- Si erreur grave, explique doucement sans humilier
- Réponds de manière encourageante et chaleureuse
- Intégration culturelle: mentionne la culture arabo-islamique naturellement`;

      // Get or create conversation
      let convId = conversation_id;
      if (!convId && student_id) {
        const conv = await pool.query(
          'INSERT INTO ai_conversations (student_id, teacher_type, student_level) VALUES ($1, $2, $3) RETURNING id',
          [student_id, teacherT, level]
        );
        convId = conv.rows[0].id;
      }

      // Get history
      const hist = convId ? await pool.query(
        'SELECT role, content FROM ai_messages WHERE conversation_id = $1 ORDER BY created_at LIMIT 20',
        [convId]
      ) : { rows: [] };

      const messages = [{ role: 'system', content: systemPrompt }];
      hist.rows.forEach(m => messages.push({ role: m.role, content: m.content }));
      messages.push({ role: 'user', content: message });

      const resp = await client.chat.completions.create({ model, messages });
      const reply = resp.choices[0].message.content;

      // Save messages
      if (convId) {
        await pool.query(
          'INSERT INTO ai_messages (conversation_id, role, content) VALUES ($1, $2, $3)',
          [convId, 'user', message]
        );
        await pool.query(
          'INSERT INTO ai_messages (conversation_id, role, content) VALUES ($1, $2, $3)',
          [convId, 'assistant', reply]
        );
        await pool.query(
          'UPDATE ai_conversations SET message_count = message_count + 1 WHERE id = $1',
          [convId]
        );
      }

      res.json({ response: reply, conversation_id: convId });
    } catch (err) { console.error('[ia/chat]', err.message); res.status(500).json({ error: 'Erreur IA' }); }
  });

  // POST /api/student/oustaz/chat — voice tutor with grammar correction
  router.post('/api/student/oustaz/chat', async (req, res) => {
    try {
      const { message, conversation_id } = req.body;
      if (!message) return res.status(400).json({ error: 'Message requis' });

      const client = getClient();
      const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

      const systemPrompt = `Tu es le Oustaz (professeur masculin) de MedinImmersion. Un professeur d'arabe qualifié et chaleureux.

Règles strictes:
- Réponds en français (90%+) avec des mots arabes courts intégrés
- Analyse le texte arabes de l'élève: si erreurs majeures de tajwid/grammaire, corrige avec ✏️ تصحيح
- Quand l'élève fait bien, encourage 🌟 أحسنت
- Tu es patient et bienveillant
- Tu peux poser des questions pour faire pratiquer
- Intègre la culture arabo-islamique naturellement (salams, références coraniques douces)`;

      const hist = conversation_id ? await pool.query(
        'SELECT role, content FROM ai_messages WHERE conversation_id = $1 ORDER BY created_at LIMIT 20',
        [conversation_id]
      ) : { rows: [] };

      const messages = [{ role: 'system', content: systemPrompt }];
      hist.rows.forEach(m => messages.push({ role: m.role, content: m.content }));
      messages.push({ role: 'user', content: message });

      const resp = await client.chat.completions.create({ model, messages });
      const reply = resp.choices[0].message.content;

      if (conversation_id) {
        await pool.query(
          'INSERT INTO ai_messages (conversation_id, role, content) VALUES ($1, $2, $3)',
          [conversation_id, 'user', message]
        );
        await pool.query(
          'INSERT INTO ai_messages (conversation_id, role, content) VALUES ($1, $2, $3)',
          [conversation_id, 'assistant', reply]
        );
      }

      res.json({ response: reply, conversation_id });
    } catch (err) { console.error('[oustaz/chat]', err.message); res.status(500).json({ error: 'Erreur IA' }); }
  });

  return router;
};
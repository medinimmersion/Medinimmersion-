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

  // POST /api/student/oustaz/chat — tuteur vocal conversationnel (Kalam)
  router.post('/api/student/oustaz/chat', async (req, res) => {
    try {
      const { message, history, lang, level, student_name } = req.body;
      if (!message) return res.status(400).json({ error: 'Message requis' });

      const client = getClient();
      const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

      const langName = lang === 'ar' ? 'arabe' : lang === 'en' ? 'anglais' : 'français';
      const levelTxt = level === 'avance' ? 'avancé — conversation riche, sujets variés'
        : level === 'intermediaire' ? 'intermédiaire — phrases complètes mais simples'
        : 'débutant — mots simples, phrases très courtes, beaucoup de répétition';

      const systemPrompt = `Tu es Oustaz Kalam, professeur d'arabe chaleureux de l'école Médin'Immersion, formé à Médine. Tu parles à l'oral avec un élève (conversation vocale en temps réel).

RÈGLES ABSOLUES (voix) :
- Réponds en 1 à 3 phrases courtes MAXIMUM. C'est une conversation parlée, pas un cours écrit.
- JAMAIS d'emoji, JAMAIS de markdown, JAMAIS de listes, JAMAIS d'astérisques. Uniquement du texte parlé naturel.
- Langue principale de l'élève : ${langName}. Réponds dans cette langue, en intégrant naturellement des mots et expressions arabes utiles (avec leur sens bref si l'élève est débutant).
- Niveau de l'élève : ${levelTxt}.
${student_name ? `- L'élève s'appelle ${student_name}. Utilise son prénom de temps en temps.` : ''}

TON STYLE :
- Chaleureux, vivant, encourageant, comme un vrai professeur en face à face. Salue avec "as-salamou alaykoum" au premier échange seulement.
- Si l'élève parle arabe et fait une erreur, corrige-la doucement en une phrase ("On dit plutôt..."), puis continue la conversation.
- Si l'élève réussit, félicite brièvement ("ahsant !", "mumtaz !") sans en faire trop.
- Pose UNE question simple à la fin de la plupart de tes réponses pour faire parler l'élève.
- Adapte-toi aux sujets de l'élève : vie quotidienne, famille, Coran, voyage, nourriture... Reste naturel.
- Connaissances : langue arabe (fusha), bases de tajwid, culture de Médine, vocabulaire coranique. Si on te demande autre chose, ramène gentiment vers la pratique de l'arabe.`;

      const messages = [{ role: 'system', content: systemPrompt }];
      if (Array.isArray(history)) {
        history.slice(-12).forEach(m => {
          if (m && m.role && m.content) messages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content).slice(0, 1000) });
        });
      }
      messages.push({ role: 'user', content: String(message).slice(0, 1000) });

      const resp = await client.chat.completions.create({ model, messages, max_tokens: 220, temperature: 0.8 });
      let reply = resp.choices[0].message.content || '';
      // Nettoyage pour la voix : retire emojis, markdown, listes
      reply = reply.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
                   .replace(/[*_#`>]/g, '')
                   .replace(/^\s*[-•]\s*/gm, '')
                   .replace(/\s{2,}/g, ' ')
                   .trim();

      res.json({ response: reply });
    } catch (err) {
      console.error('[oustaz/chat]', err.message);
      const noKey = !process.env.OPENAI_API_KEY;
      res.status(500).json({ error: noKey ? "Clé IA manquante : ajoute OPENAI_API_KEY dans Render → Environment." : 'Erreur IA, réessaie.' });
    }
  });

  // POST /api/oustaz/tts — voix naturelle (OpenAI TTS), fallback navigateur côté client
  router.post('/api/oustaz/tts', async (req, res) => {
    try {
      const { text, lang } = req.body;
      if (!text) return res.status(400).json({ error: 'Texte requis' });
      if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'TTS non configuré' });

      const client = getClient();
      const voice = lang === 'ar' ? 'onyx' : 'alloy';
      const speech = await client.audio.speech.create({
        model: process.env.OPENAI_TTS_MODEL || 'tts-1',
        voice,
        input: String(text).slice(0, 1500),
        response_format: 'mp3',
        speed: 0.95,
      });
      const buffer = Buffer.from(await speech.arrayBuffer());
      res.set({ 'Content-Type': 'audio/mpeg', 'Content-Length': buffer.length, 'Cache-Control': 'no-store' });
      res.send(buffer);
    } catch (err) {
      console.error('[oustaz/tts]', err.message);
      res.status(500).json({ error: 'TTS indisponible' });
    }
  });

  return router;
};

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
      const { message, history, lang, level, student_name, gender, persona } = req.body;
      const isFem = String(gender || '').toLowerCase() === 'femme';
      const pName = persona || (isFem ? 'Oustaza Oum Adam' : 'Oustaz Abou Adam');
      if (!message) return res.status(400).json({ error: 'Message requis' });

      const client = getClient();
      const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

      const langName = lang === 'ar' ? 'arabe' : lang === 'en' ? 'anglais' : 'français';
      const levelTxt = level === 'avance' ? 'avancé — conversation riche, sujets variés'
        : level === 'intermediaire' ? 'intermédiaire — phrases complètes mais simples'
        : 'débutant — mots simples, phrases très courtes, beaucoup de répétition';

      const systemPrompt = `Tu es ${pName}, ${isFem ? "professeure d'arabe chaleureuse" : "professeur d'arabe chaleureux"} de l'école Médin'Immersion. Tu parles à l'oral avec ${isFem ? 'une élève (une sœur)' : 'un élève (un frère)'} — conversation vocale en temps réel.
- Tu es ${isFem ? 'une femme : parle de toi au féminin' : 'un homme : parle de toi au masculin'}, et adresse-toi à l'élève ${isFem ? 'au féminin, en français comme en arabe (baraka Allahou fiki, ahsanti, kayfa hâluki...)' : 'au masculin, en français comme en arabe (baraka Allahou fik, ahsant, kayfa hâluk...)'}.

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

      let reply = '';
      const GEMINI_KEY = process.env.GEMINI_API_KEY;
      if (GEMINI_KEY) {
        // ── Gemini (gratuit) ──
        const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
        const contents = [];
        if (Array.isArray(history)) {
          history.slice(-12).forEach(m => {
            if (m && m.role && m.content) contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content).slice(0, 1000) }] });
          });
        }
        contents.push({ role: 'user', parts: [{ text: String(message).slice(0, 1000) }] });
        const gr = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${GEMINI_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents,
            generationConfig: { maxOutputTokens: 220, temperature: 0.8, thinkingConfig: { thinkingBudget: 0 } }
          })
        });
        const gd = await gr.json();
        if (!gr.ok) { const e = new Error(gd.error?.message || 'Gemini error'); e.status = gr.status; throw e; }
        reply = gd.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else {
        // ── OpenAI (fallback si pas de clé Gemini) ──
        const client = getClient();
        const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
        const resp = await client.chat.completions.create({ model, messages, max_tokens: 220, temperature: 0.8 });
        reply = resp.choices[0].message.content || '';
      }
      // Nettoyage pour la voix : retire emojis, markdown, listes
      reply = reply.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
                   .replace(/[*_#`>]/g, '')
                   .replace(/^\s*[-•]\s*/gm, '')
                   .replace(/\s{2,}/g, ' ')
                   .trim();

      res.json({ response: reply });
    } catch (err) {
      console.error('[oustaz/chat]', err.status || '', err.message);
      const noKey = !process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY;
      const detail = err && (err.status || err.code) ? `${err.status||''} ${err.code||''} ${err.message||''}`.trim() : (err.message || 'inconnue');
      res.status(500).json({
        error: noKey ? "Clé IA manquante : ajoute GEMINI_API_KEY dans Render → Environment." : 'Erreur IA, réessaie.',
        detail
      });
    }
  });

  // POST /api/oustaz/tts — voix naturelle : Gemini TTS (homme/femme), fallback OpenAI puis navigateur
  function pcmToWav(pcm, sampleRate) {
    const header = Buffer.alloc(44);
    header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVE', 8);
    header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
    header.writeUInt16LE(1, 22); header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
    header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
    return Buffer.concat([header, pcm]);
  }
  router.post('/api/oustaz/tts', async (req, res) => {
    const { text, lang, gender } = req.body || {};
    if (!text) return res.status(400).json({ error: 'Texte requis' });
    const isFem = String(gender || '').toLowerCase() === 'femme';

    // 1) Gemini TTS (clé déjà en place, voix naturelles)
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    if (GEMINI_KEY) {
      try {
        const voiceName = isFem ? (process.env.GEMINI_TTS_VOICE_F || 'Sulafat') : (process.env.GEMINI_TTS_VOICE_M || 'Charon');
        const ttsModel = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';
        const gr = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${ttsModel}:generateContent?key=${GEMINI_KEY}`, {
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
        } else {
          console.error('[oustaz/tts gemini]', gd.error && gd.error.message);
        }
      } catch (e) { console.error('[oustaz/tts gemini]', e.message); }
    }

    // 2) Fallback OpenAI TTS (si une clé existe encore)
    if (process.env.OPENAI_API_KEY) {
      try {
        const client = getClient();
        const voice = isFem ? 'nova' : 'onyx';
        const speech = await client.audio.speech.create({
          model: process.env.OPENAI_TTS_MODEL || 'tts-1',
          voice,
          input: String(text).slice(0, 1500),
          response_format: 'mp3',
          speed: 0.95,
        });
        const buffer = Buffer.from(await speech.arrayBuffer());
        res.set({ 'Content-Type': 'audio/mpeg', 'Content-Length': buffer.length, 'Cache-Control': 'no-store' });
        return res.send(buffer);
      } catch (err) { console.error('[oustaz/tts openai]', err.message); }
    }

    // 3) Rien de disponible → le client utilisera la voix du navigateur
    return res.status(503).json({ error: 'TTS non configuré' });
  });

  router.get('/api/oustaz/quota', opts.requireStudentAuth, async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT COALESCE(kalam_seconds_total,180) AS total,
                COALESCE(kalam_seconds_used,0) AS used, kalam_quota_date
         FROM students WHERE id = $1`, [req.studentId]);
      if (!r.rows.length) return res.status(404).json({ error: 'Élève introuvable' });
      let { total, used, kalam_quota_date } = r.rows[0];
      const today = new Date().toISOString().slice(0, 10);
      // reset quotidien
      if (!kalam_quota_date || kalam_quota_date.toISOString().slice(0,10) !== today) {
        used = 0;
        await pool.query('UPDATE students SET kalam_seconds_used = 0, kalam_quota_date = $2 WHERE id = $1', [req.studentId, today]);
      }
      const unlimited = total === -1;
      res.json({ unlimited, total, used, remaining: unlimited ? 999999 : Math.max(0, total - used) });
    } catch (err) { console.error('[oustaz/quota]', err.message); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // ── Temps Kalam : l'élève consomme des secondes (appelé pendant la conversation) ──
  router.post('/api/oustaz/quota/consume', opts.requireStudentAuth, async (req, res) => {
    try {
      const seconds = Math.max(0, Math.min(120, parseInt(req.body.seconds, 10) || 0));
      const today = new Date().toISOString().slice(0, 10);
      const r = await pool.query(
        `UPDATE students
         SET kalam_seconds_used = CASE WHEN kalam_quota_date = $3 THEN COALESCE(kalam_seconds_used,0) + $2 ELSE $2 END,
             kalam_quota_date = $3
         WHERE id = $1
         RETURNING COALESCE(kalam_seconds_total,180) AS total, COALESCE(kalam_seconds_used,0) AS used`,
        [req.studentId, seconds, today]);
      const { total, used } = r.rows[0];
      const unlimited = total === -1;
      res.json({ unlimited, remaining: unlimited ? 999999 : Math.max(0, total - used) });
    } catch (err) { console.error('[oustaz/quota/consume]', err.message); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // ── Temps Kalam : le gérant définit le temps d'un élève ──
  // body: { seconds: nombre } ou { minutes: nombre } ou { unlimited: true }
  router.put('/api/admin/students/:id/kalam-time', opts.requireAdmin, async (req, res) => {
    try {
      let total;
      if (req.body.unlimited) total = -1;
      else if (req.body.minutes !== undefined) total = Math.max(0, parseInt(req.body.minutes, 10) || 0) * 60;
      else total = Math.max(0, parseInt(req.body.seconds, 10) || 0);
      await pool.query('UPDATE students SET kalam_seconds_total = $2 WHERE id = $1', [req.params.id, total]);
      res.json({ success: true, kalam_seconds_total: total });
    } catch (err) { console.error('[admin/kalam-time]', err.message); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // ── Le gérant peut aussi réinitialiser le temps consommé du jour ──
  router.post('/api/admin/students/:id/kalam-reset', opts.requireAdmin, async (req, res) => {
    try {
      await pool.query('UPDATE students SET kalam_seconds_used = 0 WHERE id = $1', [req.params.id]);
      res.json({ success: true });
    } catch (err) { console.error('[admin/kalam-reset]', err.message); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // ════════ FORFAITS & PAIEMENTS KALAM ════════

  // Liste des forfaits actifs (public — pour l'élève et le gérant)
  router.get('/api/kalam/packages', async (req, res) => {
    try {
      const r = await pool.query('SELECT * FROM kalam_packages WHERE active = true ORDER BY price_euros');
      res.json(r.rows);
    } catch (err) { console.error('[kalam/packages]', err.message); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // Gérant : créer un forfait
  router.post('/api/admin/kalam/packages', opts.requireAdmin, async (req, res) => {
    try {
      const { name, minutes_per_day, price_euros, duration_days } = req.body;
      if (!name) return res.status(400).json({ error: 'Nom requis' });
      const r = await pool.query(
        `INSERT INTO kalam_packages (name, minutes_per_day, price_euros, duration_days)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [name.trim(), parseInt(minutes_per_day,10), parseFloat(price_euros)||0, parseInt(duration_days,10)||30]);
      res.json(r.rows[0]);
    } catch (err) { console.error('[admin/kalam/packages]', err.message); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // Gérant : supprimer un forfait
  router.delete('/api/admin/kalam/packages/:id', opts.requireAdmin, async (req, res) => {
    try {
      await pool.query('UPDATE kalam_packages SET active = false WHERE id = $1', [req.params.id]);
      res.json({ success: true });
    } catch (err) { console.error('[admin/kalam/del-pkg]', err.message); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // Gérant : liste des paiements Kalam (avec nom élève)
  router.get('/api/admin/kalam/payments', opts.requireAdmin, async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT kp.*, s.nom, s.prenom, s.kounia, pk.name AS package_name
         FROM kalam_payments kp
         JOIN students s ON s.id = kp.student_id
         LEFT JOIN kalam_packages pk ON pk.id = kp.package_id
         ORDER BY kp.created_at DESC LIMIT 200`);
      res.json(r.rows);
    } catch (err) { console.error('[admin/kalam/payments]', err.message); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // Gérant : attribuer un forfait à un élève (création d'un paiement, payé ou non)
  router.post('/api/admin/kalam/assign', opts.requireAdmin, async (req, res) => {
    try {
      const { student_id, package_id, payment_status } = req.body;
      if (!student_id || !package_id) return res.status(400).json({ error: 'student_id et package_id requis' });
      const pk = await pool.query('SELECT * FROM kalam_packages WHERE id = $1', [package_id]);
      if (!pk.rows.length) return res.status(404).json({ error: 'Forfait introuvable' });
      const p = pk.rows[0];
      const paid = payment_status === 'paid';
      const expires = paid ? `NOW() + INTERVAL '${parseInt(p.duration_days,10)||30} days'` : 'NULL';
      const r = await pool.query(
        `INSERT INTO kalam_payments (student_id, package_id, minutes_per_day, price_euros, payment_status, paid_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, ${paid?'NOW()':'NULL'}, ${expires}) RETURNING *`,
        [student_id, package_id, p.minutes_per_day, p.price_euros, paid ? 'paid' : 'unpaid']);
      // Si payé, appliquer immédiatement le temps Kalam à l'élève
      if (paid) {
        await pool.query('UPDATE students SET kalam_seconds_total = $2 WHERE id = $1',
          [student_id, p.minutes_per_day === -1 ? -1 : p.minutes_per_day * 60]);
      }
      res.json(r.rows[0]);
    } catch (err) { console.error('[admin/kalam/assign]', err.message); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // Gérant : valider/dévalider un paiement Kalam existant
  router.patch('/api/admin/kalam/payments/:id', opts.requireAdmin, async (req, res) => {
    try {
      const paid = req.body.payment_status === 'paid';
      const pay = await pool.query('SELECT * FROM kalam_payments WHERE id = $1', [req.params.id]);
      if (!pay.rows.length) return res.status(404).json({ error: 'Paiement introuvable' });
      const p = pay.rows[0];
      const pkg = await pool.query('SELECT duration_days FROM kalam_packages WHERE id = $1', [p.package_id]);
      const days = pkg.rows[0]?.duration_days || 30;
      await pool.query(
        `UPDATE kalam_payments
         SET payment_status = $2, paid_at = ${paid?'NOW()':'NULL'}, expires_at = ${paid?`NOW() + INTERVAL '${days} days'`:'NULL'}
         WHERE id = $1`,
        [req.params.id, paid ? 'paid' : 'unpaid']);
      // Appliquer ou retirer le temps Kalam
      await pool.query('UPDATE students SET kalam_seconds_total = $2 WHERE id = $1',
        [p.student_id, paid ? (p.minutes_per_day === -1 ? -1 : p.minutes_per_day * 60) : 180]);
      res.json({ success: true });
    } catch (err) { console.error('[admin/kalam/pay-update]', err.message); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  return router;
};
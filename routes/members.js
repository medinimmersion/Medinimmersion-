/**
 * routes/members.js — Student login, registration, password reset
 * Owns: /api/member/* auth endpoints
 * Does NOT own: admin-student operations, bookings
 */
'use strict';
const crypto = require('crypto');

module.exports = function (pool, opts) {
  const { hashPassword, verifyPassword, generateToken, studentTokens, sendEmail, sendWhatsApp, requireStudentAuth, authLimiter } = opts;
  const router = require('express').Router();

  // POST /api/member/login — identifiant (email, WhatsApp, nom ou kounia) + mot de passe
  router.post('/api/member/login', authLimiter, async (req, res) => {
    try {
      const { whatsapp, email, identifier, password } = req.body;
      const ident = String(identifier || email || whatsapp || '').trim();
      if (!ident) return res.status(400).json({ error: 'Email, WhatsApp, nom ou kounia requis' });
      if (!password) return res.status(400).json({ error: 'Mot de passe requis' });

      const low = ident.toLowerCase();
      // Numéro nettoyé (piste WhatsApp) : chiffres seuls, avec et sans zéros initiaux
      const digits = ident.replace(/\/.*$/, '').replace(/[^0-9]/g, '');
      const digitsNoZero = digits.replace(/^0+/, '');

      // On cherche sur tous les identifiants possibles ; le mot de passe départage
      const result = await pool.query(
        `SELECT id, nom, prenom, kounia, whatsapp, email, status, validation_status, password_hash
         FROM students
         WHERE LOWER(email) = $1
            OR LOWER(COALESCE(kounia, '')) = $1
            OR LOWER(nom) = $1
            OR LOWER(prenom) = $1
            OR LOWER(TRIM(prenom || ' ' || nom)) = $1
            OR LOWER(TRIM(nom || ' ' || prenom)) = $1
            OR ($2 <> '' AND REPLACE(REPLACE(whatsapp, '+', ''), ' ', '') IN ($2, $3))
         LIMIT 10`,
        [low, digits, digitsNoZero || digits]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Aucun compte trouvé avec ces informations' });

      const withPwd = result.rows.filter(s => s.password_hash);
      if (!withPwd.length) {
        return res.status(401).json({ error: 'Votre compte n a pas de mot de passe. Utilisez "Mot de passe oublié" pour en créer un.', needs_reset: true });
      }
      const student = withPwd.find(s => verifyPassword(password, s.password_hash));
      if (!student) {
        return res.status(401).json({ error: 'Mot de passe incorrect' });
      }

      const vs = student.validation_status;
      if (vs && vs !== 'validated' && vs !== 'valide') {
        const msgs = { pending: 'Votre inscription est en attente de validation.', unpaid: 'Votre inscription est en attente de paiement.' };
        return res.status(403).json({ error: msgs[vs] || 'Compte non activé.', validation_status: vs });
      }

      delete student.password_hash;

      const bookings = await pool.query(
        `SELECT id, course_type, hours, format, price_euros, status, payment_status, created_at
         FROM bookings WHERE student_id = $1 ORDER BY created_at DESC`, [student.id]
      );

      const token = generateToken(studentTokens, student.id, 7);
      console.log(`[member] Login: ${student.prenom} ${student.nom} (id=${student.id})`);

      res.json({ student, bookings: bookings.rows, token });
    } catch (err) { console.error('[member/login]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // POST /api/member/forgot-password
  router.post('/api/member/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || !email.trim()) return res.status(400).json({ error: 'Adresse email requise' });

      const result = await pool.query('SELECT id, nom, prenom, email FROM students WHERE LOWER(email) = $1', [email.trim().toLowerCase()]);
      if (result.rows.length === 0) return res.json({ success: true, message: 'Si cette adresse email est associée à un compte, un email de réinitialisation a été envoyé.' });

      const student = result.rows[0];

      // Invalidate old tokens
      await pool.query('UPDATE password_reset_tokens SET used = TRUE WHERE student_id = $1 AND used = FALSE', [student.id]);

      const token = crypto.randomBytes(48).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await pool.query('INSERT INTO password_reset_tokens (student_id, token, expires_at) VALUES ($1, $2, $3)', [student.id, token, expiresAt]);

      const baseUrl = process.env.APP_URL || 'https://medinimmersion.com';
      const resetUrl = `${baseUrl}/reset-password?token=${token}`;

      const html = `
        <p dir="rtl" style="font-family:Amiri,serif;font-size:1.3em;text-align:center;">السلام عليكم ورحمة الله وبركاته</p>
        <p>Cher(e) <strong>${student.prenom} ${student.nom}</strong>,</p>
        <p>Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
        <p style="text-align:center; margin: 2rem 0;">
          <a href="${resetUrl}" style="background:#1B5E3A;color:white;padding:14px 32px;border-radius:50px;text-decoration:none;font-weight:bold;font-size:1.1rem;">Réinitialiser mon mot de passe</a>
        </p>
        <p style="font-size:0.9rem; color:#6B6560;">Ce lien est valable pendant <strong>1 heure</strong>.</p>
        <hr>
        <p style="font-size:0.85em; color:#666;">MedinImmersion</p>
      `;

      await sendEmail(student.email, 'Réinitialisation de votre mot de passe — MedinImmersion', html);
      console.log('[reset] Token sent to', student.email);
      res.json({ success: true, message: 'Si cette adresse email est associée à un compte, un email de réinitialisation a été envoyé.' });
    } catch (err) { console.error('[forgot-password]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // POST /api/member/reset-password
  router.post('/api/member/reset-password', async (req, res) => {
    try {
      const { token, password } = req.body;
      if (!token || !password) return res.status(400).json({ error: 'Token et nouveau mot de passe requis' });
      if (password.length < 6) return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });

      const result = await pool.query(
        'SELECT * FROM password_reset_tokens WHERE token = $1 AND used = FALSE AND expires_at > NOW()', [token]
      );

      if (result.rows.length === 0) return res.status(400).json({ error: 'Lien invalide ou expiré.' });

      const entry = result.rows[0];
      const newHash = hashPassword(password);

      await pool.query('UPDATE students SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, entry.student_id]);
      await pool.query('UPDATE password_reset_tokens SET used = TRUE WHERE id = $1', [entry.id]);

      res.json({ success: true, message: 'Mot de passe réinitialisé avec succès.' });
    } catch (err) { console.error('[reset-password]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // POST /api/member/forgot-by-phone
  router.post('/api/member/forgot-by-phone', async (req, res) => {
    try {
      const { phone } = req.body;
      if (!phone || !phone.trim()) return res.status(400).json({ error: 'Numéro de téléphone requis' });

      const result = await pool.query('SELECT id, nom, prenom, whatsapp FROM students WHERE whatsapp = $1', [phone.trim()]);
      if (result.rows.length === 0) {
        return res.json({ success: true, message: 'Contactez-nous par email.', email: 'contact.medinimmersion@gmail.com' });
      }

      const student = result.rows[0];
      await pool.query('UPDATE password_reset_tokens SET used = TRUE WHERE student_id = $1 AND used = FALSE', [student.id]);

      const token = crypto.randomBytes(48).toString('hex');
      await pool.query('INSERT INTO password_reset_tokens (student_id, token, expires_at) VALUES ($1, $2, $3)',
        [student.id, token, new Date(Date.now() + 3600000)]);

      const baseUrl = process.env.APP_URL || 'https://medinimmersion.com';
      const resetUrl = `${baseUrl}/reset-password?token=${token}`;
      const waText = encodeURIComponent(`Salam ${student.prenom}, votre lien MedinImmersion (1h) : ${resetUrl}`);
      const waLink = `https://wa.me/${student.whatsapp.replace(/\u002B|\/|\u0020/g,'')}?text=${waText}`;

      console.log('[reset-phone] WA link for student', student.id);
      res.json({ success: true, whatsapp_link: waLink, reset_url: resetUrl, student_name: `${student.prenom} ${student.nom}` });
    } catch (err) { console.error('[forgot-by-phone]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // ── Alias /api/member/* pour l'espace élève (lecture vraies tables) ──
  router.get('/api/member/me', requireStudentAuth, async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT s.id, s.nom, s.prenom, s.kounia, s.email, s.whatsapp, s.gender, s.status, s.validation_status,
                COALESCE(sp.niveau, 1) AS niveau, COALESCE(sp.current_page, 1) AS current_page,
                t.nom AS teacher_nom, t.prenom AS teacher_prenom, t.zoom_link AS teacher_zoom,
                COALESCE((SELECT SUM(hours_done) FROM course_sessions cs WHERE cs.student_id = s.id AND cs.status IN ('done','effectue','completed')),0) AS hours_done,
                COALESCE((SELECT SUM(hours) FROM bookings b WHERE b.student_id = s.id),0) AS hours_total
         FROM students s
         LEFT JOIN student_progression sp ON sp.student_id = s.id
         LEFT JOIN teacher_student_assignments tsa ON tsa.student_id = s.id
         LEFT JOIN teachers t ON t.id = tsa.teacher_id
         WHERE s.id = $1 LIMIT 1`,
        [req.studentId]
      );
      if (!r.rows.length) return res.status(404).json({ error: 'Élève non trouvé' });
      const s = r.rows[0];
      s.teacher_name = [s.teacher_prenom, s.teacher_nom].filter(Boolean).join(' ') || null;
      // Cours/format depuis la dernière réservation
      const bk = await pool.query('SELECT course_type, format, hours FROM bookings WHERE student_id = $1 ORDER BY created_at DESC LIMIT 1', [s.id]).catch(()=>({rows:[]}));
      if (bk.rows[0]) { s.course_type = bk.rows[0].course_type; s.format = bk.rows[0].format; }
      const pdfc = await pool.query('SELECT COUNT(*) AS n FROM student_pdfs WHERE student_id = $1 AND file_url IS NOT NULL', [s.id]).catch(()=>({rows:[{n:0}]}));
      // Aliases attendus par la page
      s.level = s.niveau || 1;
      s.remaining_hours = Math.max(0, Number(s.hours_total||0) - Number(s.hours_done||0));
      s.pdf_count = Number(pdfc.rows[0].n) || 0;
      res.json(s);
    } catch (err) { console.error('[member/me]', err.message); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // Planning : sessions planifiées (scheduled_sessions via session_students) + cours simples
  router.get('/api/member/sessions', requireStudentAuth, async (req, res) => {
    try {
      const planning = await pool.query(
        `SELECT ss.id, ss.session_date, ss.time_start, ss.time_end, ss.status, ss.seance_statut,
                ss.course_type, t.nom AS teacher_nom, t.prenom AS teacher_prenom, t.zoom_link
         FROM session_students sstd
         JOIN scheduled_sessions ss ON ss.id = sstd.session_id
         LEFT JOIN teachers t ON t.id = ss.teacher_id
         WHERE sstd.student_id = $1
         ORDER BY ss.session_date DESC, ss.time_start DESC LIMIT 200`,
        [req.studentId]
      ).catch(e => { console.error('[member/sessions planning]', e.message); return { rows: [] }; });
      const sessions = await pool.query(
        `SELECT id, session_date, status, hours_done, notes
         FROM course_sessions WHERE student_id = $1
         ORDER BY session_date DESC LIMIT 200`,
        [req.studentId]
      ).catch(e => { console.error('[member/sessions simple]', e.message); return { rows: [] }; });
      const out = planning.rows.map(p => ({
        date_heure: p.session_date && p.time_start ? (new Date(p.session_date).toISOString().slice(0,10) + 'T' + p.time_start) : p.session_date,
        course_type: p.course_type, status: p.seance_statut || p.status,
        teacher_name: [p.teacher_prenom, p.teacher_nom].filter(Boolean).join(' ') || null,
        zoom_link: p.zoom_link || null
      }));
      res.json(out);
    } catch (err) { console.error('[member/sessions]', err.message); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // Progression : niveau + page + heures effectuées/totales
  router.get('/api/member/progression', requireStudentAuth, async (req, res) => {
    try {
      const p = await pool.query('SELECT niveau, current_page, notes FROM student_progression WHERE student_id = $1', [req.studentId]).catch(()=>({rows:[]}));
      const h = await pool.query(
        `SELECT COALESCE(SUM(hours_done),0) AS done FROM course_sessions WHERE student_id = $1 AND status IN ('done','effectue','completed')`,
        [req.studentId]
      ).catch(()=>({rows:[{done:0}]}));
      const tot = await pool.query('SELECT COALESCE(SUM(hours),0) AS total FROM bookings WHERE student_id = $1', [req.studentId]).catch(()=>({rows:[{total:0}]}));
      const prog = p.rows[0] || { niveau: 1, current_page: 1 };
      const bk = await pool.query(
        `SELECT b.course_type, t.nom AS tn, t.prenom AS tp
         FROM bookings b
         LEFT JOIN teacher_student_assignments tsa ON tsa.student_id = b.student_id
         LEFT JOIN teachers t ON t.id = tsa.teacher_id
         WHERE b.student_id = $1 ORDER BY b.created_at DESC LIMIT 1`, [req.studentId]
      ).catch(()=>({rows:[]}));
      const done = Number(h.rows[0].done) || 0, total = Number(tot.rows[0].total) || 0;
      res.json({
        niveau: prog.niveau || 1, level: prog.niveau || 1, current_page: prog.current_page || 1, notes: prog.notes || null,
        hours_done: done, hours_total: total, remaining_hours: Math.max(0, total - done),
        course_type: bk.rows[0]?.course_type || null,
        teacher_name: bk.rows[0] ? [bk.rows[0].tp, bk.rows[0].tn].filter(Boolean).join(' ') : null
      });
    } catch (err) { console.error('[member/progression]', err.message); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // Livres & PDF : PDF personnels (student_pdfs) + bibliothèque assignée (book_assignments par slot, ou niveau)
  router.get('/api/member/books', requireStudentAuth, async (req, res) => {
    try {
      const pdfs = await pool.query(
        `SELECT id, slot_number, title, file_url FROM student_pdfs WHERE student_id = $1 AND file_url IS NOT NULL ORDER BY slot_number`,
        [req.studentId]
      ).catch(()=>({rows:[]}));
      // Bibliothèque : UNIQUEMENT les livres explicitement assignés
      // (à l'élève, à tous, ou à son niveau par le gérant/prof)
      const library = await pool.query(
        `SELECT DISTINCT lb.id, lb.name, lb.file_url, lb.slot_number, lb.niveau_min
         FROM library_books lb
         WHERE lb.file_url IS NOT NULL AND COALESCE(lb.statut,'approuve')='approuve'
           AND lb.slot_number IN (
             SELECT book_slot_number FROM book_assignments
             WHERE (assignee_type='student' AND assignee_id=$1)
                OR (assignee_type='all')
                OR (assignee_type='level' AND assignee_id=COALESCE((SELECT niveau FROM student_progression WHERE student_id=$1),1))
           )
         ORDER BY lb.slot_number NULLS LAST, lb.name`,
        [req.studentId]
      ).catch(e => { console.error('[member/books lib]', e.message); return { rows: [] }; });
      const out = [];
      pdfs.rows.forEach(p => out.push({ title: p.title || ('PDF '+(p.slot_number||'')), url: p.file_url, level: null }));
      library.rows.forEach(b => out.push({ title: b.name, url: b.file_url, level: b.niveau_min || null }));
      res.json(out);
    } catch (err) { console.error('[member/books]', err.message); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  router.get('/api/member/messages', requireStudentAuth, async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT n.* FROM notifications n
         WHERE n.target_type = 'all'
            OR (n.target_type = 'student' AND n.target_id = $1)
            OR (n.target_type = 'group' AND n.target_id IN (SELECT group_id FROM group_members WHERE student_id = $1))
         ORDER BY n.created_at DESC LIMIT 50`,
        [req.studentId]
      ).catch(()=>({rows:[]}));
      res.json(r.rows);
    } catch (err) { console.error('[member/messages]', err.message); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  return router;
};
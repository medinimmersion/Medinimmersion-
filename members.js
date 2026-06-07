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

  // POST /api/member/login — email OR whatsapp + password
  router.post('/api/member/login', authLimiter, async (req, res) => {
    try {
      const { whatsapp, email, password } = req.body;
      if (!whatsapp && !email) return res.status(400).json({ error: 'WhatsApp ou email requis' });
      if (!password) return res.status(400).json({ error: 'Mot de passe requis' });

      let query, params;
      if (whatsapp) {
        const cleanWa = whatsapp.replace(/\/.*$/, '').replace(/[^\u0030-\u0039]/g, '').replace(/^0+/, '');
        query = `SELECT id, nom, prenom, kounia, whatsapp, email, status, validation_status, password_hash
                 FROM students WHERE REPLACE(REPLACE(whatsapp, '+', ''), ' ', '') = $1`;
        params = [cleanWa];
      } else {
        query = `SELECT id, nom, prenom, kounia, whatsapp, email, status, validation_status, password_hash
                 FROM students WHERE LOWER(email) = $1`;
        params = [email.trim().toLowerCase()];
      }

      const result = await pool.query(query, params);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Aucun compte trouvé avec ces informations' });

      const student = result.rows[0];

      if (!student.password_hash) {
        return res.status(401).json({ error: 'Votre compte n a pas de mot de passe. Utilisez "Mot de passe oublié" pour en créer un.', needs_reset: true });
      }
      if (!verifyPassword(password, student.password_hash)) {
        return res.status(401).json({ error: 'Mot de passe incorrect' });
      }

      const vs = student.validation_status;
      if (vs && vs !== 'validated') {
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

  return router;
};
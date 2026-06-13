/**
 * routes/students.js — Student registration and account management
 * Owns: /api/students register + per-student account endpoints
 * Does NOT own: bookings (see bookings.js)
 */
'use strict';

module.exports = function (pool, opts) {
  const { hashPassword, generateToken, studentTokens, sendEmail, sendWhatsApp, requireAdmin, requireStudentAuth, pool: db } = opts;
  const router = require('express').Router();

  const OWNER_EMAIL = opts.OWNER_EMAIL || 'contact.medinimmersion@gmail.com';
  const PAYPAL_LINK = 'https://paypal.me/medinimmersion';
  const PRICING = opts.PRICING;
  const ENROLLMENT_FEE = opts.ENROLLMENT_FEE;

  const courseLabels = { coran: 'Immersion Coran', arabe: 'Immersion Arabe', double_immersion: 'Double Immersion (Arabe + Coran)' };
  const formatLabels = { individual: 'Individuel', binome: 'En binôme', groupe: 'Groupe' };

  function calcPrice(courseType, hours, format) {
    const hMap = PRICING[courseType];
    if (!hMap || !hMap[hours]) return null;
    const idx = format === 'binome' ? 1 : format === 'groupe' ? 2 : 0;
    return hMap[hours][idx];
  }

  // POST /api/students — Register new student
  router.post('/api/students', async (req, res) => {
    try {
      const { nom, prenom, kounia, whatsapp, email, gender, course_type, hours, format, password } = req.body;
      if (!nom || !prenom || !whatsapp || !email) {
        return res.status(400).json({ error: 'Nom, prénom, WhatsApp et email sont requis' });
      }

      // Unique WhatsApp
      const waCheck = await pool.query('SELECT id FROM students WHERE REPLACE(REPLACE(whatsapp, $1, $2), $3, $4) = REPLACE(REPLACE($5, $1, $2), $3, $4)',
        ['+', '', ' ', '', whatsapp]);
      if (waCheck.rows.length > 0) {
        return res.status(409).json({ error: 'Ce numéro WhatsApp est déjà utilisé.' });
      }

      // Unique email
      const emailCheck = await pool.query('SELECT id FROM students WHERE LOWER(email) = LOWER($1)', [email.trim()]);
      if (emailCheck.rows.length > 0) {
        return res.status(409).json({ error: 'Cet email est déjà utilisé.' });
      }

      if (!course_type || !hours || !format) {
        return res.status(400).json({ error: 'Type de cours, heures et format requis' });
      }

      const price = calcPrice(course_type, parseInt(hours), format);
      if (price === null) return res.status(400).json({ error: 'Combinaison cours/heures non valide' });

      // Utilise le mot de passe choisi par l'élève, sinon en génère un temporaire
      const tempPassword = (password && password.length >= 4) ? password : crypto.randomBytes(8).toString('base64').replace(/[^a-zA-Z0-9]/g, 'x').substring(0, 10);
      const passwordHash = hashPassword(tempPassword);

      const result = await pool.query(
        `INSERT INTO students (nom, prenom, kounia, whatsapp, email, gender, password_hash, validation_status, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 'active') RETURNING *`,
        [nom.trim(), prenom.trim(), kounia || null, whatsapp.trim(), email.trim().toLowerCase(), gender || null, passwordHash]
      );

      const student = result.rows[0];

      // Create booking
      const booking = await pool.query(
        `INSERT INTO bookings (student_id, course_type, hours, format, price_euros, status, payment_status)
         VALUES ($1, $2, $3, $4, $5, 'pending', 'unpaid') RETURNING *`,
        [student.id, course_type, parseInt(hours), format, price]
      );

      // Send owner notification email
      const ownerHtml = `
        <h2>Nouvelle inscription MedinImmersion</h2>
        <table style="border-collapse:collapse;font-family:sans-serif;">
          <tr><td style="padding:6px 12px;font-weight:bold;">Nom</td><td style="padding:6px 12px;">${prenom} ${nom}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;">Kounia</td><td style="padding:6px 12px;">${kounia || '—'}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;">WhatsApp</td><td style="padding:6px 12px;">${whatsapp}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;">Email</td><td style="padding:6px 12px;">${email}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;">Cours</td><td style="padding:6px 12px;">${course_type}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;">Format</td><td style="padding:6px 12px;">${formatLabels[format] || format}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;">Heures</td><td style="padding:6px 12px;">${hours}h</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;">Montant</td><td style="padding:6px 12px;">${price}€</td></tr>
        </table>
      `;
      await sendEmail(OWNER_EMAIL, 'Nouvelle inscription — MedinImmersion', ownerHtml);

      // Send student confirmation email
      const studentHtml = `
        <p dir="rtl" style="font-family:Amiri,serif;font-size:1.3em;text-align:center;">السلام عليكم ورحمة الله وبركاته</p>
        <p>Cher(e) <strong>${prenom} ${nom}</strong>,</p>
        <p>Votre inscription a bien été enregistrée.</p>
        <table style="border-collapse:collapse;font-family:sans-serif;margin:16px 0;">
          <tr><td style="padding:6px 12px;font-weight:bold;">Cours</td><td style="padding:6px 12px;">${courseLabels[course_type] || course_type}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;">Format</td><td style="padding:6px 12px;">${formatLabels[format] || format}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;">Heures</td><td style="padding:6px 12px;">${hours}h</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;">Montant</td><td style="padding:6px 12px;">${price}€ + 10€ frais inscription</td></tr>
        </table>
        <p>Choisissez votre mode de paiement :</p>
        <p style="text-align:center;">
          <a href="${PAYPAL_LINK}" style="display:inline-block;background:#003087;color:white;padding:12px 24px;border-radius:4px;text-decoration:none;font-weight:bold;">Payer via PayPal</a>
        </p>
        <p>PayPal : <strong>${OWNER_EMAIL}</strong></p>
        <p>Votre compte a été créé avec mot de passe temporaire : <code>${tempPassword}</code><br>
        Connectez-vous sur <strong>${process.env.APP_URL || 'https://medinimmersion.com'}/espace-eleve.html</strong> avec votre WhatsApp ou email + ce mot de passe.</p>
        <p dir="rtl" style="font-family:Amiri,serif;font-size:1.3em;text-align:center;">بارك الله فيكم</p>
      `;
      await sendEmail(email, 'Confirmation d inscription — MedinImmersion', studentHtml);

      console.log('[student] Registered:', prenom, nom, whatsapp, course_type, hours + 'h');
      res.json({ success: true, student, booking: booking.rows[0], temp_password: tempPassword });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Numéro WhatsApp ou email déjà utilisé.' });
      console.error('[student/register]', err); res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // GET /api/students/:id — get student data (student self or admin)
  // GET /api/students (liste) — élèves attribués au professeur connecté, avec heures
  router.get('/api/students', async (req, res) => {
    try {
      const tok = req.headers['x-teacher-token'] || (req.headers.authorization||'').replace('Bearer ','');
      const teacherId = tok && opts.teacherTokens ? (opts.teacherTokens.get(tok)||{}).id : null;
      const isAdmin = req.headers['x-admin-token'] || req.headers['x-gerant-token'];
      if (!teacherId && !isAdmin) return res.status(401).json({ error: 'Non autorisé' });

      const where = teacherId ? 'WHERE tsa.teacher_id = $1' : '';
      const params = teacherId ? [teacherId] : [];
      const r = await pool.query(`
        SELECT s.id, s.nom, s.prenom, s.kounia, s.whatsapp, s.email, s.gender, s.status, s.validation_status,
               COALESCE(sp.niveau,1) AS niveau,
               b.course_type, b.format, COALESCE(b.hours,0) AS hours_total,
               COALESCE((SELECT SUM(hours_done) FROM course_sessions cs WHERE cs.student_id = s.id AND cs.status IN ('done','effectue','completed')),0) AS hours_done
        FROM teacher_student_assignments tsa
        JOIN students s ON s.id = tsa.student_id
        LEFT JOIN student_progression sp ON sp.student_id = s.id
        LEFT JOIN LATERAL (SELECT course_type, format, hours FROM bookings WHERE student_id = s.id ORDER BY created_at DESC LIMIT 1) b ON true
        ${where}
        ORDER BY s.nom, s.prenom
      `, params);
      const rows = r.rows.map(s => ({
        ...s,
        remaining_hours: Math.max(0, Number(s.hours_total||0) - Number(s.hours_done||0)),
        level: s.niveau
      }));
      res.json(rows);
    } catch (err) { console.error('[students/list]', err.message); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  router.get('/api/students/:id', async (req, res) => {
    try {
      const studentId = parseInt(req.params.id);
      const token = req.headers['x-student-token'];
      const isSelf = token && opts.studentTokens && opts.studentTokens.get(token)?.id === studentId;
      const isAdmin = req.headers['x-admin-token'] || req.headers['x-gerant-token'];

      if (!isSelf && !isAdmin) return res.status(403).json({ error: 'Accès non autorisé' });

      const student = await pool.query(
        `SELECT id, nom, prenom, kounia, whatsapp, email, gender, status, validation_status, created_at
         FROM students WHERE id = $1`, [studentId]
      );
      if (!student.rows.length) return res.status(404).json({ error: 'Élève non trouvé' });

      const bookings = await pool.query(
        `SELECT id, course_type, hours, format, price_euros, status, payment_status, created_at
         FROM bookings WHERE student_id = $1 ORDER BY created_at DESC`, [studentId]
      );

      res.json({ student: student.rows[0], bookings: bookings.rows });
    } catch (err) { console.error('[student/get]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // POST /api/students/logout — invalidate token
  router.post('/api/students/logout', requireStudentAuth, (req, res) => {
    const token = req.headers['x-student-token'];
    if (token) opts.studentTokens.delete(token);
    res.json({ success: true });
  });

  // POST /api/admin/students/:id/change-password
  router.post('/api/admin/students/:id/change-password', requireAdmin, async (req, res) => {
    try {
      const { new_password } = req.body;
      if (!new_password || new_password.length < 6) return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });

      const hash = hashPassword(new_password);
      await pool.query('UPDATE students SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, parseInt(req.params.id)]);
      res.json({ success: true });
    } catch (err) { console.error('[admin/change-pw]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  return router;
};
/**
 * routes/admin.js — Admin CRUD operations (students, teachers, bookings, groups, notifications, schedules, sessions)
 * Owns: /api/admin/* endpoints
 * Does NOT own: gerant auth setup (see gerant.js), library (see routes/library.js)
 */
'use strict';

module.exports = function (pool, opts) {
  const { requireAdmin, requireTeacherAuth, hashPassword, verifyPassword, generateToken,
    sendEmail, sendWhatsApp, uploadToR2WithRetry, FormDataLib, pool: db, PRICING, ENROLLMENT_FEE } = opts;
  const router = require('express').Router();

  // GET /api/admin/students
  router.get('/api/admin/students', requireAdmin, async (req, res) => {
    try {
      const students = await pool.query(`
        SELECT s.id, s.nom, s.prenom, s.kounia, s.whatsapp, s.email, s.gender, s.status, s.validation_status, s.paiement_statut, s.created_at,
          (SELECT COUNT(*) FROM bookings b WHERE b.student_id = s.id) as booking_count,
          COALESCE(STRING_AGG(DISTINCT (t.prenom || ' ' || t.nom), ', '), '—') AS teacher_names
        FROM students s
        LEFT JOIN teacher_student_assignments tsa ON tsa.student_id = s.id
        LEFT JOIN teachers t ON t.id = tsa.teacher_id
        GROUP BY s.id ORDER BY s.created_at DESC
      `);
      const bookings = await pool.query(`SELECT b.*, s.nom as student_nom, s.prenom as student_prenom FROM bookings b JOIN students s ON s.id = b.student_id ORDER BY b.created_at DESC`);
      res.json({ students: students.rows, bookings: bookings.rows });
    } catch (err) { console.error('[admin/students]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // GET /api/admin/bookings — all bookings with student info
  router.get('/api/admin/bookings', requireAdmin, async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT b.*, s.nom AS student_nom, s.prenom AS student_prenom, s.email AS student_email
         FROM bookings b JOIN students s ON s.id = b.student_id
         ORDER BY b.created_at DESC LIMIT 500`
      );
      res.json(r.rows);
    } catch (err) { console.error('[admin/bookings]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // GET /api/admin/students/:id — single student detail
  router.get('/api/admin/students/:id', requireAdmin, async (req, res) => {
    try {
      const r = await pool.query('SELECT * FROM students WHERE id = $1', [req.params.id]);
      if (!r.rows.length) return res.status(404).json({ error: 'Élève non trouvé' });
      res.json({ student: r.rows[0] });
    } catch (err) { console.error('[admin/student]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // GET /api/admin/teachers/:id — single teacher detail
  router.get('/api/admin/teachers/:id', requireAdmin, async (req, res) => {
    try {
      const r = await pool.query(
        'SELECT id, nom, prenom, email, username, specialty, bio, photo_url, zoom_link, can_edit_planning, can_send_books, can_edit_zoom, can_edit_student_info, is_active FROM teachers WHERE id = $1',
        [req.params.id]
      );
      if (!r.rows.length) return res.status(404).json({ error: 'Professeur non trouvé' });
      res.json({ teacher: r.rows[0] });
    } catch (err) { console.error('[admin/teacher]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // PUT /api/admin/teachers/:id/permissions — update teacher permission flags
  router.put('/api/admin/teachers/:id/permissions', requireAdmin, async (req, res) => {
    const { can_edit_planning, can_send_books, can_edit_zoom, can_edit_student_info } = req.body;
    try {
      const r = await pool.query(
        `UPDATE teachers SET can_edit_planning = $1, can_send_books = $2, can_edit_zoom = $3, can_edit_student_info = $4, updated_at = NOW()
         WHERE id = $5 RETURNING id, nom, prenom, can_edit_planning, can_send_books, can_edit_zoom, can_edit_student_info`,
        [!!can_edit_planning, !!can_send_books, !!can_edit_zoom, !!can_edit_student_info, req.params.id]
      );
      if (!r.rows.length) return res.status(404).json({ error: 'Professeur non trouvé' });
      res.json(r.rows[0]);
    } catch (err) { console.error('[admin/teacher-perms]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // PATCH /api/admin/bookings/:id/payment
  router.patch('/api/admin/bookings/:id/payment', requireAdmin, async (req, res) => {
    try {
      const { payment_status } = req.body;
      if (!['unpaid', 'paid', 'partial', 'refunded'].includes(payment_status)) {
        return res.status(400).json({ error: 'Statut invalide' });
      }
      const result = await pool.query('UPDATE bookings SET payment_status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [payment_status, req.params.id]);
      if (!result.rows.length) return res.status(404).json({ error: 'Réservation non trouvée' });

      if (result.rows[0].student_id) {
        const newStatus = payment_status === 'paid' ? 'validated' : payment_status === 'unpaid' ? 'unpaid' : result.rows[0].student?.validation_status;
        await pool.query('UPDATE students SET validation_status = $1, updated_at = NOW() WHERE id = $2', [newStatus, result.rows[0].student_id]);
      }
      res.json(result.rows[0]);
    } catch (err) { console.error('[admin/payment]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // PATCH /api/admin/bookings/:id/status
  router.patch('/api/admin/bookings/:id/status', requireAdmin, async (req, res) => {
    try {
      const { status } = req.body;
      if (!['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'].includes(status)) {
        return res.status(400).json({ error: 'Statut invalide' });
      }
      const result = await pool.query('UPDATE bookings SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [status, req.params.id]);
      if (!result.rows.length) return res.status(404).json({ error: 'Réservation non trouvée' });
      res.json(result.rows[0]);
    } catch (err) { console.error('[admin/status]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // DELETE /api/admin/bookings/:id
  router.delete('/api/admin/bookings/:id', requireAdmin, async (req, res) => {
    try {
      const result = await pool.query('DELETE FROM bookings WHERE id = $1 RETURNING id', [req.params.id]);
      if (!result.rows.length) return res.status(404).json({ error: 'Réservation non trouvée' });
      res.json({ success: true });
    } catch (err) { console.error('[admin/delete-booking]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // GET /api/admin/stats
  router.get('/api/admin/stats', requireAdmin, async (req, res) => {
    try {
      const [students, bookings, pending, paid, unpaid, revenue] = await Promise.all([
        pool.query('SELECT COUNT(*)::int as count FROM students'),
        pool.query('SELECT COUNT(*)::int as count FROM bookings'),
        pool.query("SELECT COUNT(*)::int as count FROM bookings WHERE status = 'pending'"),
        pool.query("SELECT COUNT(*)::int as count FROM bookings WHERE payment_status = 'paid'"),
        pool.query("SELECT COUNT(*)::int as count FROM bookings WHERE payment_status = 'unpaid' OR payment_status IS NULL"),
        pool.query("SELECT COALESCE(SUM(price_euros), 0) as total FROM bookings WHERE payment_status = 'paid'")
      ]);
      res.json({
        total_students: students.rows[0].count,
        total_bookings: bookings.rows[0].count,
        pending_bookings: pending.rows[0].count,
        paid_bookings: paid.rows[0].count,
        unpaid_bookings: unpaid.rows[0].count,
        paid_revenue: parseFloat(revenue.rows[0].total)
      });
    } catch (err) { console.error('[admin/stats]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // GET /api/admin/teachers
  router.get('/api/admin/teachers', requireAdmin, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT t.id, t.username, t.email, t.nom, t.prenom, t.zoom_link, t.created_at, t.can_edit_planning, t.can_send_books, t.can_edit_zoom, t.can_edit_student_info,
          (SELECT COUNT(*) FROM teacher_student_assignments tsa WHERE tsa.teacher_id = t.id) as student_count,
          COALESCE(SUM(b.hours), 0)::int as total_hours,
          COALESCE(SUM(CASE WHEN b.payment_status = 'paid' THEN b.price_euros ELSE 0 END), 0)::float as paid_amount
        FROM teachers t
        LEFT JOIN bookings b ON b.teacher_id = t.id AND b.status != 'cancelled'
        GROUP BY t.id ORDER BY t.created_at DESC
      `);
      res.json(result.rows);
    } catch (err) { console.error('[admin/teachers]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // POST /api/admin/teachers
  router.post('/api/admin/teachers', requireAdmin, async (req, res) => {
    try {
      const { username, email, nom, prenom, zoom_link, password, teacher_code } = req.body;
      if (teacher_code !== 'medin2024') return res.status(403).json({ error: 'Code professeur invalide' });
      if (!username || !email) return res.status(400).json({ error: 'Username et email requis' });

      const pwd = password || crypto.randomBytes(10).toString('base64').replace(/[^a-zA-Z0-9]/g, 'x').substring(0, 10);
      const hash = hashPassword(pwd);

      const result = await pool.query(
        'INSERT INTO teachers (username, email, nom, prenom, zoom_link, password_hash) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, username, email, nom, prenom',
        [username.trim(), email.trim().toLowerCase(), nom || null, prenom || null, zoom_link || null, hash]
      );
      console.log('[admin] Teacher created:', username);
      res.json({ teacher: result.rows[0], password: pwd });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Username ou email déjà utilisé.' });
      console.error('[admin/create-teacher]', err); res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // PATCH /api/admin/teachers/:id/hourly-rate
  router.patch('/api/admin/teachers/:id/hourly-rate', requireAdmin, async (req, res) => {
    try {
      const { rate } = req.body;
      if (rate !== undefined) {
        await pool.query('UPDATE teachers SET hourly_rate = $1, updated_at = NOW() WHERE id = $2', [rate, req.params.id]);
      }
      res.json({ success: true });
    } catch (err) { console.error('[admin/hourly-rate]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // DELETE /api/admin/teachers/:id
  router.delete('/api/admin/teachers/:id', requireAdmin, async (req, res) => {
    try {
      const result = await pool.query('DELETE FROM teachers WHERE id = $1 RETURNING id', [req.params.id]);
      if (!result.rows.length) return res.status(404).json({ error: 'Professeur non trouvé' });
      res.json({ success: true });
    } catch (err) { console.error('[admin/delete-teacher]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // GET /api/admin/remuneration
  router.get('/api/admin/remuneration', requireAdmin, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT t.id, t.nom, t.prenom, t.username, t.hourly_rate,
          COALESCE(SUM(b.hours), 0)::int as total_hours,
          COALESCE(SUM(CASE WHEN b.payment_status = 'paid' THEN b.price_euros ELSE 0 END), 0)::float as paid_amount,
          COALESCE(SUM(b.hours), 0)::int * COALESCE(t.hourly_rate, 0)::int as remuneration_due
        FROM teachers t
        LEFT JOIN bookings b ON b.teacher_id = t.id AND b.status != 'cancelled'
        GROUP BY t.id ORDER BY remuneration_due DESC
      `);
      res.json(result.rows);
    } catch (err) { console.error('[admin/remuneration]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // POST /api/admin/impersonate/teacher/:id — get teacher token
  router.post('/api/admin/impersonate/teacher/:id', requireAdmin, async (req, res) => {
    try {
      const teacher = await pool.query('SELECT id, username FROM teachers WHERE id = $1', [req.params.id]);
      if (!teacher.rows.length) return res.status(404).json({ error: 'Professeur non trouvé' });
      const token = generateToken(opts.teacherTokens, teacher.rows[0].id, 7);
      res.json({ token });
    } catch (err) { console.error('[admin/impersonate-teacher]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // GET /api/admin/attributions
  router.get('/api/admin/attributions', requireAdmin, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT tsa.*, s.nom as student_nom, s.prenom as student_prenom, t.nom as teacher_nom, t.prenom as teacher_prenom
        FROM teacher_student_assignments tsa
        JOIN students s ON s.id = tsa.student_id
        JOIN teachers t ON t.id = tsa.teacher_id
        ORDER BY tsa.created_at DESC
      `);
      res.json(result.rows);
    } catch (err) { console.error('[admin/attributions]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // POST /api/admin/impersonate/student/:id
  router.post('/api/admin/impersonate/student/:id', requireAdmin, async (req, res) => {
    try {
      const student = await pool.query('SELECT id FROM students WHERE id = $1', [req.params.id]);
      if (!student.rows.length) return res.status(404).json({ error: 'Élève non trouvé' });
      const token = generateToken(opts.studentTokens, student.rows[0].id, 7);
      res.json({ token });
    } catch (err) { console.error('[admin/impersonate-student]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // GET /api/admin/groups — list all groups with member counts
  router.get('/api/admin/groups', requireAdmin, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT sg.*,
          (SELECT COUNT(*)::int FROM group_members gm WHERE gm.group_id = sg.id) as member_count
        FROM student_groups sg
        ORDER BY sg.created_at DESC
      `);
      res.json(result.rows);
    } catch (err) { console.error('[admin/groups]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // GET /api/admin/groups/:id/students — members of a group
  router.get('/api/admin/groups/:id/students', requireAdmin, async (req, res) => {
    try {
      const members = await pool.query(`
        SELECT s.id, gm.id AS member_id, s.nom, s.prenom, s.kounia, s.whatsapp, s.email, gm.added_at
        FROM group_members gm
        JOIN students s ON s.id = gm.student_id
        WHERE gm.group_id = $1
        ORDER BY gm.added_at DESC
      `, [req.params.id]);
      res.json(members.rows);
    } catch (err) { console.error('[admin/group-students]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // GET /api/admin/payments — payment summary from bookings
  router.get('/api/admin/payments', requireAdmin, async (req, res) => {
    try {
      const [payments, totals] = await Promise.all([
        pool.query(`
          SELECT b.id, s.nom, s.prenom, b.course_type, b.hours, b.format,
                 b.price_euros, b.payment_status, b.created_at
          FROM bookings b
          JOIN students s ON s.id = b.student_id
          ORDER BY b.created_at DESC
          LIMIT 200
        `),
        pool.query(`
          SELECT payment_status, COUNT(*)::int as cnt,
                 COALESCE(SUM(price_euros), 0)::float as total
          FROM bookings
          GROUP BY payment_status
        `)
      ]);
      res.json({ payments: payments.rows, totals: totals.rows });
    } catch (err) { console.error('[admin/payments]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // PATCH /api/admin/payments/:id — update booking payment status
  router.patch('/api/admin/payments/:id', requireAdmin, async (req, res) => {
    const { status } = req.body;
    if (!['paid', 'unpaid', 'partial', 'refunded'].includes(status)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }
    try {
      const result = await pool.query(
        'UPDATE bookings SET payment_status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [status, req.params.id]
      );
      if (!result.rows.length) return res.status(404).json({ error: 'Réservation non trouvée' });
      res.json(result.rows[0]);
    } catch (err) { console.error('[admin/patch-payment]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // GET /api/admin/validation — students pending validation
  router.get('/api/admin/validation', requireAdmin, async (req, res) => {
    try {
      const students = await pool.query(`
        SELECT s.id, s.nom, s.prenom, s.email, s.whatsapp, s.gender,
               s.validation_status, s.paiement_statut, s.created_at,
               (SELECT b.course_type FROM bookings b WHERE b.student_id = s.id ORDER BY b.created_at DESC LIMIT 1) as course_type,
               (SELECT b.hours FROM bookings b WHERE b.student_id = s.id ORDER BY b.created_at DESC LIMIT 1) as hours
        FROM students s
        WHERE s.validation_status IN ('pending', 'en_attente', NULL) OR s.validation_status IS NULL
        ORDER BY s.created_at DESC
      `);
      res.json(students.rows);
    } catch (err) { console.error('[admin/validation]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // POST /api/admin/groups
  router.post('/api/admin/groups', requireAdmin, async (req, res) => {
    try {
      const { name, description, color } = req.body;
      if (!name) return res.status(400).json({ error: 'Nom du groupe requis' });
      const result = await pool.query(
        'INSERT INTO student_groups (name, description, color) VALUES ($1, $2, $3) RETURNING *',
        [name.trim(), description || null, color || '#1B5E3A']
      );
      res.json(result.rows[0]);
    } catch (err) { console.error('[admin/groups]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // DELETE /api/admin/groups/:id
  router.delete('/api/admin/groups/:id', requireAdmin, async (req, res) => {
    try {
      const result = await pool.query('DELETE FROM student_groups WHERE id = $1 RETURNING id', [req.params.id]);
      if (!result.rows.length) return res.status(404).json({ error: 'Groupe non trouvé' });
      res.json({ success: true });
    } catch (err) { console.error('[admin/delete-group]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // DELETE /api/admin/groups/:id/members/:memberId
  router.delete('/api/admin/groups/:id/members/:memberId', requireAdmin, async (req, res) => {
    try {
      const result = await pool.query(
        'DELETE FROM group_members WHERE id = $1 AND group_id = $2 RETURNING id',
        [req.params.memberId, req.params.id]
      );
      if (!result.rows.length) return res.status(404).json({ error: 'Membre non trouvé' });
      res.json({ success: true });
    } catch (err) { console.error('[admin/delete-group-member]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // POST /api/admin/groups/:id/members
  router.post('/api/admin/groups/:id/members', requireAdmin, async (req, res) => {
    try {
      const { student_id } = req.body;
      if (!student_id) return res.status(400).json({ error: 'student_id requis' });
      const result = await pool.query(
        'INSERT INTO group_members (group_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING *',
        [req.params.id, student_id]
      );
      res.json({ success: true, member: result.rows[0] });
    } catch (err) { console.error('[admin/group-members]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // POST /api/admin/notifications
  router.post('/api/admin/notifications', requireAdmin, async (req, res) => {
    try {
      const { title, message, target_type, target_id } = req.body;
      if (!title || !message) return res.status(400).json({ error: 'Titre et message requis' });
      const result = await pool.query(
        'INSERT INTO notifications (title, message, target_type, target_id) VALUES ($1, $2, $3, $4) RETURNING *',
        [title.trim(), message.trim(), target_type || 'all', target_id || null]
      );
      res.json(result.rows[0]);
    } catch (err) { console.error('[admin/notifications]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // POST /api/admin/extras — add extra hours or PDF packs to student
  router.post('/api/admin/extras', requireAdmin, async (req, res) => {
    try {
      const { student_id, type, quantity, notes } = req.body;
      if (!student_id || !type || !quantity) return res.status(400).json({ error: 'Champs requis' });
      const result = await pool.query(
        'INSERT INTO student_extras (student_id, type, quantity, notes, added_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [student_id, type, quantity, notes || null, 'gerant']
      );
      res.json(result.rows[0]);
    } catch (err) { console.error('[admin/extras]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // GET /api/admin/view-as-student — optionally with ?studentId=X to target a specific student
  router.get('/api/admin/view-as-student', requireAdmin, async (req, res) => {
    try {
      let student;
      if (req.query.studentId) {
        const s = await pool.query('SELECT id, nom, prenom, whatsapp, email, validation_status FROM students WHERE id = $1', [req.query.studentId]);
        student = s.rows[0];
      } else {
        const s = await pool.query('SELECT id, nom, prenom, whatsapp, email, validation_status FROM students ORDER BY RANDOM() LIMIT 1');
        student = s.rows[0];
      }
      if (!student) return res.status(404).json({ error: 'Élève non trouvé' });
      const token = generateToken(opts.studentTokens, student.id, 7);
      const redirectUrl = '/espace-eleve.html?xs=' + token;
      res.json({ student, token, redirectUrl });
    } catch (err) { console.error('[admin/view-as]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // GET /admin/view-space/teacher/:id — validates admin/gerant token, generates teacher token, redirects to teacher dashboard
  router.get('/admin/view-space/teacher/:id', async (req, res) => {
    try {
      const gt = req.query.gt;
      const at = req.headers['x-admin-token'];
      const isAdmin = at === process.env.ADMIN_PASSWORD || (gt && opts.gerantTokens && opts.gerantTokens.has(gt));
      if (!isAdmin) return res.status(401).send('Accès refusé');
      const teacher = await pool.query('SELECT id, username FROM teachers WHERE id = $1', [req.params.id]);
      if (!teacher.rows.length) return res.status(404).send('Professeur non trouvé');
      const token = generateToken(opts.teacherTokens, teacher.rows[0].id, 7);
      res.redirect('/espace-professeur.html?xt=' + token);
    } catch (err) { console.error('[admin/view-space/teacher]', err); res.status(500).send('Erreur serveur'); }
  });

  // GET /admin/view-space/student/:id — validates admin/gerant token, generates student token, redirects to student dashboard
  router.get('/admin/view-space/student/:id', async (req, res) => {
    try {
      const gt = req.query.gt;
      const at = req.headers['x-admin-token'];
      const isAdmin = at === process.env.ADMIN_PASSWORD || (gt && opts.gerantTokens && opts.gerantTokens.has(gt));
      if (!isAdmin) return res.status(401).send('Accès refusé');
      const student = await pool.query('SELECT id FROM students WHERE id = $1', [req.params.id]);
      if (!student.rows.length) return res.status(404).send('Élève non trouvé');
      const token = generateToken(opts.studentTokens, student.rows[0].id, 7);
      res.redirect('/espace-eleve.html?xs=' + token);
    } catch (err) { console.error('[admin/view-space/student]', err); res.status(500).send('Erreur serveur'); }
  });

  // PUT /api/admin/validation/:id — update student validation status (validated/rejected → valide/rejected)
  router.put('/api/admin/validation/:id', requireAdmin, async (req, res) => {
    const { status } = req.body;
    if (!['validated', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Statut invalide: validated ou rejected' });
    }
    const dbStatus = status === 'validated' ? 'valide' : status;
    try {
      const r = await pool.query(
        'UPDATE students SET validation_status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, nom, prenom, validation_status, paiement_statut',
        [dbStatus, req.params.id]
      );
      if (!r.rows.length) return res.status(404).json({ error: 'Élève non trouvé' });
      res.json({ success: true, student: r.rows[0] });
    } catch (err) { console.error('[admin/validation]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // PUT /api/admin/students/:id/paiement — update student payment status
  router.put('/api/admin/students/:id/paiement', requireAdmin, async (req, res) => {
    const { statut } = req.body;
    if (!['paye', 'non_paye', 'partiel'].includes(statut)) {
      return res.status(400).json({ error: 'Statut invalide: paye, non_paye ou partiel' });
    }
    try {
      const r = await pool.query(
        'UPDATE students SET paiement_statut = $1, updated_at = NOW() WHERE id = $2 RETURNING id, nom, prenom, paiement_statut',
        [statut, req.params.id]
      );
      if (!r.rows.length) return res.status(404).json({ error: 'Élève non trouvé' });
      res.json({ success: true, student: r.rows[0] });
    } catch (err) { console.error('[admin/student/paiement]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // PUT /api/admin/students/:id/password — gérant resets a student's password
  router.put('/api/admin/students/:id/password', requireAdmin, async (req, res) => {
    try {
      const { password } = req.body;
      if (!password || password.length < 4) return res.status(400).json({ error: 'Mot de passe trop court' });
      const hash = hashPassword(password);
      const r = await pool.query('UPDATE students SET password_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING id', [hash, req.params.id]);
      if (!r.rows.length) return res.status(404).json({ error: 'Élève non trouvé' });
      res.json({ success: true });
    } catch (err) { console.error('[admin/student-password]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  return router;
};
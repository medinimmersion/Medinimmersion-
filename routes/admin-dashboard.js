/**
 * routes/admin-dashboard.js — Enhanced admin dashboard API.
 * Owns: /api/admin/dashboard/* (stats, payments, attribution, groups, validation).
 * Does NOT own: student/teacher CRUD (routes/admin.js), bookings, notifications.
 */
'use strict';

const { Router } = require('express');
const presencesDb = require('../db/presences');

module.exports = function adminDashboardRoutes(pool, opts) {
  const router = Router();
  const { requireAdmin, requireStudentAuth } = opts;

  // ── Dashboard stats (6 cards) ────────────────────────────────
  router.get('/api/admin/dashboard/stats', requireAdmin, async (req, res) => {
    try {
      const [students, bookingsTotal, pending, paid, unpaid, revenue] = await Promise.all([
        pool.query('SELECT COUNT(*) AS c FROM students WHERE status != $1', ['deleted']),
        pool.query('SELECT COUNT(*) AS c FROM bookings'),
        pool.query(`SELECT COUNT(*) AS c FROM bookings WHERE status = 'pending'`),
        pool.query(`SELECT COUNT(*) AS c FROM bookings WHERE payment_status = 'paid'`),
        pool.query(`SELECT COUNT(*) AS c FROM bookings WHERE payment_status IN ('unpaid', 'partial') OR payment_status IS NULL`),
        pool.query(`SELECT COALESCE(SUM(price_euros), 0) AS total FROM bookings WHERE payment_status = 'paid'`)
      ]);
      res.json({
        totalStudents: parseInt(students.rows[0].c),
        bookingsThisMonth: parseInt(bookingsTotal.rows[0].c),
        pendingCount: parseInt(pending.rows[0].c),
        paidCount: parseInt(paid.rows[0].c),
        unpaidCount: parseInt(unpaid.rows[0].c),
        revenueThisMonth: parseFloat(revenue.rows[0].total)
      });
    } catch (err) {
      console.error('[dashboard/stats]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── Planning: course schedules + scheduled sessions ─────────
  router.get('/api/admin/planning', requireAdmin, async (req, res) => {
    try {
      const [schedules, sessions] = await Promise.all([
        pool.query(
          `SELECT cs.*, t.nom AS teacher_nom, t.prenom AS teacher_prenom,
                  (SELECT COUNT(*) FROM schedule_students ss WHERE ss.schedule_id = cs.id) AS student_count
           FROM course_schedules cs
           LEFT JOIN teachers t ON t.id = cs.teacher_id
           ORDER BY cs.start_date DESC`
        ),
        pool.query(
          `SELECT ss.*, t.nom AS teacher_nom, t.prenom AS teacher_prenom
           FROM scheduled_sessions ss
           LEFT JOIN teachers t ON t.id = ss.teacher_id
           ORDER BY ss.session_date DESC LIMIT 100`
        )
      ]);
      res.json({ schedules: schedules.rows, sessions: sessions.rows });
    } catch (err) {
      console.error('[planning]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── Payments overview ────────────────────────────────────────
  router.get('/api/admin/payments', requireAdmin, async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT b.id, b.student_id, s.nom, s.prenom, s.email, b.course_type,
                b.hours, b.format, b.price_euros, b.payment_status, b.created_at
         FROM bookings b
         JOIN students s ON s.id = b.student_id
         ORDER BY b.created_at DESC
         LIMIT 200`
      );
      const totals = await pool.query(
        `SELECT payment_status, COUNT(*) AS cnt, COALESCE(SUM(price_euros),0) AS total
         FROM bookings GROUP BY payment_status`
      );
      res.json({ payments: r.rows, totals: totals.rows });
    } catch (err) {
      console.error('[payments]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── Mark payment status ──────────────────────────────────────
  router.put('/api/admin/payments/:bookingId', requireAdmin, async (req, res) => {
    const { status } = req.body;
    if (!['paid', 'unpaid', 'partial', 'refunded'].includes(status)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }
    try {
      const r = await pool.query(
        'UPDATE bookings SET payment_status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [status, req.params.bookingId]
      );
      if (!r.rows.length) return res.status(404).json({ error: 'Réservation non trouvée' });
      res.json(r.rows[0]);
    } catch (err) {
      console.error('[payments/update]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── Attribution: cross-view prof↔élève ───────────────────────
  router.get('/api/admin/attributions', requireAdmin, async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT tsa.id, tsa.teacher_id, tsa.student_id,
                t.nom AS teacher_nom, t.prenom AS teacher_prenom,
                s.nom AS student_nom, s.prenom AS student_prenom, s.email AS student_email
         FROM teacher_student_assignments tsa
         JOIN teachers t ON t.id = tsa.teacher_id
         JOIN students s ON s.id = tsa.student_id
         ORDER BY t.nom, s.nom`
      );
      res.json(r.rows);
    } catch (err) {
      console.error('[attributions]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── Assign teacher to student ────────────────────────────────
  router.post('/api/admin/attributions', requireAdmin, async (req, res) => {
    const { teacherId, studentId } = req.body;
    if (!teacherId || !studentId) return res.status(400).json({ error: 'teacherId et studentId requis' });
    try {
      await pool.query(
        `INSERT INTO teacher_student_assignments (teacher_id, student_id, assigned_by)
         VALUES ($1, $2, 'gerant') ON CONFLICT DO NOTHING`,
        [teacherId, studentId]
      );
      res.json({ success: true });
    } catch (err) {
      console.error('[attributions/assign]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── Remove assignment ────────────────────────────────────────
  router.delete('/api/admin/attributions/:id', requireAdmin, async (req, res) => {
    try {
      await pool.query('DELETE FROM teacher_student_assignments WHERE id = $1', [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      console.error('[attributions/delete]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── Groups management ────────────────────────────────────────
  router.get('/api/admin/groups', requireAdmin, async (req, res) => {
    try {
      const groups = await pool.query(
        `SELECT sg.*, COUNT(gm.student_id) AS member_count
         FROM student_groups sg
         LEFT JOIN group_members gm ON gm.group_id = sg.id
         GROUP BY sg.id ORDER BY sg.name`
      );
      res.json(groups.rows);
    } catch (err) {
      console.error('[groups]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  router.post('/api/admin/groups', requireAdmin, async (req, res) => {
    const { name, description, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Nom du groupe requis' });
    try {
      const r = await pool.query(
        'INSERT INTO student_groups (name, description, color) VALUES ($1, $2, $3) RETURNING *',
        [name, description, color || '#1B5E3A']
      );
      res.json(r.rows[0]);
    } catch (err) {
      console.error('[groups/create]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  router.put('/api/admin/groups/:id', requireAdmin, async (req, res) => {
    const { name, description, color } = req.body;
    try {
      const r = await pool.query(
        'UPDATE student_groups SET name = COALESCE($1, name), description = COALESCE($2, description), color = COALESCE($3, color) WHERE id = $4 RETURNING *',
        [name, description, color, req.params.id]
      );
      if (!r.rows.length) return res.status(404).json({ error: 'Groupe non trouvé' });
      res.json(r.rows[0]);
    } catch (err) {
      console.error('[groups/update]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  router.delete('/api/admin/groups/:id', requireAdmin, async (req, res) => {
    try {
      await pool.query('DELETE FROM student_groups WHERE id = $1', [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      console.error('[groups/delete]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── Group members ────────────────────────────────────────────
  router.get('/api/admin/groups/:id/students', requireAdmin, async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT s.id, s.nom, s.prenom, s.email, s.whatsapp, gm.added_at
         FROM group_members gm
         JOIN students s ON s.id = gm.student_id
         WHERE gm.group_id = $1 ORDER BY s.nom`,
        [req.params.id]
      );
      res.json(r.rows);
    } catch (err) {
      console.error('[groups/members]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  router.post('/api/admin/groups/:id/students', requireAdmin, async (req, res) => {
    const { studentId } = req.body;
    if (!studentId) return res.status(400).json({ error: 'studentId requis' });
    try {
      await pool.query(
        'INSERT INTO group_members (group_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [req.params.id, studentId]
      );
      res.json({ success: true });
    } catch (err) {
      console.error('[groups/add-student]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  router.delete('/api/admin/groups/:gid/students/:sid', requireAdmin, async (req, res) => {
    try {
      await pool.query(
        'DELETE FROM group_members WHERE group_id = $1 AND student_id = $2',
        [req.params.gid, req.params.sid]
      );
      res.json({ success: true });
    } catch (err) {
      console.error('[groups/remove-student]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── Validation: pending inscriptions ─────────────────────────
  router.get('/api/admin/validation', requireAdmin, async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT s.*, b.course_type, b.hours, b.format, b.price_euros, b.payment_status
         FROM students s
         LEFT JOIN bookings b ON b.student_id = s.id
         WHERE s.validation_status = 'pending'
         ORDER BY s.created_at DESC`
      );
      res.json(r.rows);
    } catch (err) {
      console.error('[validation]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  router.put('/api/admin/validation/:id', requireAdmin, async (req, res) => {
    const { status } = req.body;
    if (!['validated', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Statut invalide (validated ou rejected)' });
    }
    try {
      const r = await pool.query(
        'UPDATE students SET validation_status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [status, req.params.id]
      );
      if (!r.rows.length) return res.status(404).json({ error: 'Élève non trouvé' });
      res.json(r.rows[0]);
    } catch (err) {
      console.error('[validation/update]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── Professor API: my students ───────────────────────────────
  router.get('/api/professor/me', opts.requireTeacherAuth, async (req, res) => {
    try {
      const r = await pool.query(
        'SELECT id, nom, prenom, email, username, specialty, bio, photo_url, zoom_link, can_edit_planning, can_send_books, can_edit_zoom, can_edit_student_info, is_active FROM teachers WHERE id = $1',
        [req.teacherId]
      );
      if (!r.rows.length) return res.status(404).json({ error: 'Professeur non trouvé' });
      res.json(r.rows[0]);
    } catch (err) {
      console.error('[professor/me]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  router.get('/api/professor/students', opts.requireTeacherAuth, async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT s.id, s.nom, s.prenom, s.email, s.whatsapp, s.gender, s.status
         FROM teacher_student_assignments tsa
         JOIN students s ON s.id = tsa.student_id
         WHERE tsa.teacher_id = $1 ORDER BY s.nom`,
        [req.teacherId]
      );
      res.json(r.rows);
    } catch (err) {
      console.error('[professor/students]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  router.get('/api/professor/groups', opts.requireTeacherAuth, async (req, res) => {
    try {
      // Groups linked to schedules where teacher is assigned
      const r = await pool.query(
        `SELECT sg.*, cs.course_type, cs.teacher_id, COUNT(gm.student_id) AS member_count
         FROM student_groups sg
         LEFT JOIN course_schedules cs ON cs.id = sg.schedule_id
         LEFT JOIN group_members gm ON gm.group_id = sg.id
         WHERE cs.teacher_id = $1 OR cs.teacher_id IS NULL
         GROUP BY sg.id, cs.course_type, cs.teacher_id ORDER BY sg.name`,
        [req.teacherId]
      );
      res.json(r.rows);
    } catch (err) {
      console.error('[professor/groups]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  router.get('/api/professor/groups/:id/members', opts.requireTeacherAuth, async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT gm.student_id, s.nom, s.prenom, s.kounia
         FROM group_members gm JOIN students s ON s.id = gm.student_id
         WHERE gm.group_id = $1`,
        [req.params.id]
      );
      res.json(r.rows);
    } catch (err) { console.error('[professor/group-members]', err.message); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  router.get('/api/professor/planning', opts.requireTeacherAuth, async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT ss.*, cs.title AS schedule_title,
                CASE
                  WHEN ss.session_date > CURRENT_DATE THEN 'a_venir'
                  WHEN ss.session_date = CURRENT_DATE THEN 'aujourdhui'
                  ELSE COALESCE(NULLIF(ss.seance_statut,''),'a_traiter')
                END AS statut_calcule
         FROM scheduled_sessions ss
         LEFT JOIN course_schedules cs ON cs.id = ss.schedule_id
         WHERE ss.teacher_id = $1
         ORDER BY ss.session_date ASC LIMIT 100`,
        [req.teacherId]
      );
      res.json(r.rows);
    } catch (err) {
      console.error('[professor/planning]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  router.put('/api/professor/profile', opts.requireTeacherAuth, async (req, res) => {
    const { nom, prenom, specialty, bio, photo_url, zoom_link } = req.body;
    try {
      const t = await pool.query('SELECT can_edit_zoom FROM teachers WHERE id = $1', [req.teacherId]);
      if (!t.rows.length) return res.status(404).json({ error: 'Professeur non trouvé' });
      const updates = [];
      const vals = [];
      let idx = 1;
      if (nom) { updates.push(`nom = $${idx++}`); vals.push(nom); }
      if (prenom) { updates.push(`prenom = $${idx++}`); vals.push(prenom); }
      if (specialty !== undefined) { updates.push(`specialty = $${idx++}`); vals.push(specialty); }
      if (bio !== undefined) { updates.push(`bio = $${idx++}`); vals.push(bio); }
      if (photo_url !== undefined) { updates.push(`photo_url = $${idx++}`); vals.push(photo_url); }
      if (zoom_link !== undefined && t.rows[0].can_edit_zoom) {
        updates.push(`zoom_link = $${idx++}`); vals.push(zoom_link);
      }
      if (!updates.length) return res.json({ message: 'Rien à mettre à jour' });
      updates.push(`updated_at = NOW()`);
      vals.push(req.teacherId);
      const r = await pool.query(
        `UPDATE teachers SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, nom, prenom, specialty, bio, photo_url, zoom_link`,
        vals
      );
      res.json(r.rows[0]);
    } catch (err) {
      console.error('[professor/profile]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── Student API: my info ─────────────────────────────────────
  router.get('/api/student/me', opts.requireStudentAuth, async (req, res) => {
    try {
      const r = await pool.query(
        'SELECT id, nom, prenom, email, whatsapp, gender, status, validation_status FROM students WHERE id = $1',
        [req.studentId]
      );
      if (!r.rows.length) return res.status(404).json({ error: 'Élève non trouvé' });
      res.json(r.rows[0]);
    } catch (err) {
      console.error('[student/me]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  router.get('/api/student/course', opts.requireStudentAuth, async (req, res) => {
    try {
      const sessions = await pool.query(
        `SELECT ss.id, ss.session_date, ss.time_start, ss.time_end, ss.status,
                cs.title, cs.course_type, t.nom AS teacher_nom, t.prenom AS teacher_prenom, t.zoom_link
         FROM session_students sstd
         JOIN scheduled_sessions ss ON ss.id = sstd.session_id
         LEFT JOIN course_schedules cs ON cs.id = ss.schedule_id
         LEFT JOIN teachers t ON t.id = ss.teacher_id
         WHERE sstd.student_id = $1
         ORDER BY ss.session_date DESC LIMIT 50`,
        [req.studentId]
      );
      res.json(sessions.rows);
    } catch (err) {
      console.error('[student/course]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  router.get('/api/student/progress', opts.requireStudentAuth, async (req, res) => {
    try {
      const r = await pool.query(
        'SELECT * FROM student_progression WHERE student_id = $1',
        [req.studentId]
      );
      res.json(r.rows[0] || { niveau: 1, current_page: 1 });
    } catch (err) {
      console.error('[student/progress]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  router.get('/api/student/notifications', opts.requireStudentAuth, async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT n.* FROM notifications n
         WHERE n.target_type = 'all'
            OR (n.target_type = 'student' AND n.target_id = $1)
            OR (n.target_type = 'group' AND n.target_id IN (
              SELECT group_id FROM group_members WHERE student_id = $1
            ))
         ORDER BY n.created_at DESC LIMIT 50`,
        [req.studentId]
      );
      res.json(r.rows);
    } catch (err) {
      console.error('[student/notifications]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  router.get('/api/student/books', opts.requireStudentAuth, async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT sp.* FROM student_pdfs sp WHERE sp.student_id = $1 ORDER BY sp.slot_number`,
        [req.studentId]
      );
      res.json(r.rows);
    } catch (err) {
      console.error('[student/books]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // Student: documents (library books)
  router.get('/api/student/documents', opts.requireStudentAuth, async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT lb.id, lb.name, lb.file_url, lb.created_at,
                lc.name as category_name
         FROM library_books lb
         LEFT JOIN library_categories lc ON lc.id = lb.category_id
         WHERE lb.file_url IS NOT NULL
         ORDER BY lc.name NULLS LAST, lb.name`
      );
      res.json(r.rows);
    } catch (err) {
      console.error('[student/documents]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  router.post('/api/student/requests', opts.requireStudentAuth, async (req, res) => {
    const { type, message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message requis' });
    try {
      const r = await pool.query(
        'INSERT INTO student_requests (student_id, type, message) VALUES ($1, $2, $3) RETURNING *',
        [req.studentId, type || 'general', message]
      );
      res.json(r.rows[0]);
    } catch (err) {
      console.error('[student/requests]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── Student: payment status ─────────────────────────────────
  router.get('/api/student/payment', opts.requireStudentAuth, async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT id, course_type, hours, format, price_euros, payment_status, status, created_at, updated_at
         FROM bookings WHERE student_id = $1 ORDER BY created_at DESC LIMIT 20`,
        [req.studentId]
      );
      const unpaid = r.rows.filter(b => b.payment_status === 'unpaid' || b.payment_status === 'partial');
      const totalPaid = r.rows.filter(b => b.payment_status === 'paid').reduce((s, b) => s + parseFloat(b.price_euros || 0), 0);
      res.json({ bookings: r.rows, unpaidCount: unpaid.length, totalPaid });
    } catch (err) {
      console.error('[student/payment]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── Student: my requests history ────────────────────────────
  router.get('/api/student/requests', opts.requireStudentAuth, async (req, res) => {
    try {
      const r = await pool.query(
        'SELECT * FROM student_requests WHERE student_id = $1 ORDER BY created_at DESC LIMIT 50',
        [req.studentId]
      );
      res.json(r.rows);
    } catch (err) {
      console.error('[student/requests-list]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── Student: active Zoom call ─────────────────────────────
  // Returns the active Zoom call for this student (if any)
  router.get('/api/student/active-zoom-call', opts.requireStudentAuth, async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT zc.id, zc.zoom_link, zc.started_at,
                t.nom AS teacher_nom, t.prenom AS teacher_prenom
         FROM zoom_calls zc
         JOIN teachers t ON t.id = zc.teacher_id
         WHERE zc.active = TRUE
           AND zc.student_ids ? $1
         ORDER BY zc.started_at DESC
         LIMIT 1`,
        [String(req.studentId)]
      );
      res.json(r.rows[0] || null);
    } catch (err) {
      // If column doesn't exist yet (migration not run), return null gracefully
      if (err.code === '42883') return res.json(null);
      console.error('[student/active-zoom-call]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  return router;
};

/**
 * routes/misc.js — Catch-all for remaining API endpoints
 * Owns: /api/notes, /api/student/request, /api/student/ping,
 *        /api/teacher/attendance, /api/teacher/assign-books-to-students, /api/admin/library/assign
 */
'use strict';

module.exports = function (pool, opts) {
  const { requireTeacherAuth, requireStudentAuth, requireAdmin, requireGerant, sendEmail, authLimiter,
    ADMIN_PASSWORD, isMaintenanceMode } = opts;
  const router = require('express').Router();
  const OWNER_EMAIL = opts.OWNER_EMAIL || 'contact.medinimmersion@gmail.com';

  // ── Legacy admin login ─────────────────────────────────────
  router.post('/api/admin/login', authLimiter, (req, res) => {
    if (req.body.password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Mot de passe administrateur incorrect' });
    res.json({ success: true });
  });

  // ── Maintenance mode API ──────────────────────────────────
  router.get('/api/maintenance', requireAdmin, async (req, res) => res.json({ enabled: await isMaintenanceMode() }));
  router.put('/api/maintenance', requireAdmin, async (req, res) => {
    const { enabled } = req.body;
    try {
      const existing = await pool.query(`SELECT id FROM cms_content WHERE page_key = 'global' AND field_key = 'maintenance_mode'`);
      if (existing.rows.length > 0) {
        await pool.query(`UPDATE cms_content SET value = $1, updated_at = NOW() WHERE page_key = 'global' AND field_key = 'maintenance_mode'`, [enabled ? 'true' : 'false']);
      } else {
        await pool.query(`INSERT INTO cms_content (page_key, field_key, field_type, value) VALUES ('global', 'maintenance_mode', 'boolean', $1)`, [enabled ? 'true' : 'false']);
      }
      res.json({ enabled: !!enabled });
    } catch (err) { console.error('[maintenance]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // POST /api/notes — teacher creates a note about a student
  router.post('/api/notes', requireTeacherAuth, async (req, res) => {
    try {
      const { student_id, booking_id, content } = req.body;
      if (!student_id || !content) return res.status(400).json({ error: 'student_id et content requis' });

      const result = await pool.query(
        'INSERT INTO teacher_notes (teacher_id, student_id, booking_id, content) VALUES ($1, $2, $3, $4) RETURNING *',
        [req.teacherId, student_id, booking_id || null, content.trim()]
      );
      res.json(result.rows[0]);
    } catch (err) { console.error('[notes]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // GET /api/notes/:student_id — teacher's notes for a student
  router.get('/api/notes/:student_id', requireTeacherAuth, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT tn.*, t.nom as teacher_nom, t.prenom as teacher_prenom
         FROM teacher_notes tn
         JOIN teachers t ON t.id = tn.teacher_id
         WHERE tn.student_id = $1 ORDER BY tn.created_at DESC`,
        [req.params.student_id]
      );
      res.json(result.rows);
    } catch (err) { console.error('[notes/get]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // POST /api/student/request — student submits a request (extra hours, book)
  router.post('/api/student/request', requireStudentAuth, async (req, res) => {
    try {
      const { request_type, message } = req.body;
      if (!request_type || !message) return res.status(400).json({ error: 'Type et message requis' });

      const result = await pool.query(
        'INSERT INTO student_requests (student_id, type, message) VALUES ($1, $2, $3) RETURNING *',
        [req.studentId, request_type, message.trim()]
      );

      // Notify owner
      const student = await pool.query('SELECT nom, prenom, whatsapp FROM students WHERE id = $1', [req.studentId]);
      const html = `
        <h2>Demande d'élève — MedinImmersion</h2>
        <p><strong>${student.rows[0]?.prenom} ${student.rows[0]?.nom}</strong> (${student.rows[0]?.whatsapp})</p>
        <p><strong>Type:</strong> ${request_type}</p>
        <p><strong>Message:</strong> ${message}</p>
      `;
      await sendEmail(OWNER_EMAIL, `Demande: ${request_type} — ${student.rows[0]?.prenom} ${student.rows[0]?.nom}`, html);

      res.json(result.rows[0]);
    } catch (err) { console.error('[student/request]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // POST /api/student/ping — student heartbeat to track online status
  router.post('/api/student/ping', requireStudentAuth, async (req, res) => {
    try {
      await pool.query(
        `INSERT INTO student_last_seen (student_id, last_seen) VALUES ($1, NOW())
         ON CONFLICT (student_id) DO UPDATE SET last_seen = NOW()`,
        [req.studentId]
      );
      res.json({ ok: true, ts: new Date().toISOString() });
    } catch (err) { console.error('[student/ping]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // POST /api/teacher/attendance/:sessionId/:studentId
  router.post('/api/teacher/attendance/:sessionId/:studentId', requireTeacherAuth, async (req, res) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      const studentId = parseInt(req.params.studentId);
      const { status } = req.body;
      if (!['present', 'absent', 'late'].includes(status)) return res.status(400).json({ error: 'Statut invalide' });

      await pool.query(`
        INSERT INTO group_attendance (session_id, student_id, status, marked_by, marked_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (session_id, student_id) DO UPDATE SET status = $3, marked_by = $4, marked_at = NOW()
      `, [sessionId, studentId, status, `teacher:${req.teacherId}`]);

      res.json({ success: true });
    } catch (err) { console.error('[teacher/attendance]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // POST /api/teacher/assign-books-to-students
  router.post('/api/teacher/assign-books-to-students', requireTeacherAuth, async (req, res) => {
    try {
      const { student_ids, book_id } = req.body;
      if (!student_ids || !book_id) return res.status(400).json({ error: 'student_ids et book_id requis' });

      let count = 0;
      for (const sid of student_ids) {
        const r = await pool.query(
          'INSERT INTO book_assignments (book_id, teacher_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [book_id, sid]
        );
        if (r.rowCount > 0) count++;
      }
      res.json({ success: true, assigned: count });
    } catch (err) { console.error('[teacher/assign-books]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // POST /api/admin/library/assign — assign book to student or group
  router.post('/api/admin/library/assign', requireAdmin, async (req, res) => {
    try {
      const { book_id, student_id, group_id } = req.body;
      if (!book_id) return res.status(400).json({ error: 'book_id requis' });

      // book_id correspond au slot_number (= id du livre). Colonnes réelles : book_slot_number, assignee_type, assignee_id
      let count = 0;
      const assignOne = async (sid) => {
        const r = await pool.query(
          `INSERT INTO book_assignments (book_slot_number, assignee_type, assignee_id, assigned_by)
           VALUES ($1, 'student', $2, 'gerant') ON CONFLICT DO NOTHING`,
          [book_id, sid]
        );
        return r.rowCount;
      };
      if (student_id) {
        count = await assignOne(student_id);
      } else if (group_id) {
        const members = await pool.query('SELECT student_id FROM group_members WHERE group_id = $1', [group_id]);
        for (const m of members.rows) { count += await assignOne(m.student_id); }
      } else if (req.body.niveau_min !== undefined && req.body.niveau_min !== null) {
        // Assigner à tous les élèves d'un niveau donné
        const studs = await pool.query('SELECT student_id FROM student_progression WHERE niveau = $1', [req.body.niveau_min]);
        for (const s of studs.rows) { count += await assignOne(s.student_id); }
      }
      res.json({ success: true, assigned: count });
    } catch (err) { console.error('[admin/library/assign]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  return router;
};
/**
 * routes/zoom.js — Zoom session management
 * Owns: /api/zoom/*
 */
'use strict';

module.exports = function (pool, opts) {
  const { requireTeacherAuth, requireStudentAuth, requireAdmin, requireGerant } = opts;
  const router = require('express').Router();

  // GET /api/student/teacher-zoom — student gets teacher's zoom link
  router.get('/api/student/teacher-zoom', requireStudentAuth, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT t.zoom_link, t.nom, t.prenom
        FROM teacher_student_assignments tsa
        JOIN teachers t ON t.id = tsa.teacher_id
        WHERE tsa.student_id = $1
        LIMIT 1
      `, [req.studentId]);
      res.json({ zoom_link: result.rows[0]?.zoom_link || null, teacher_name: result.rows[0] ? `${result.rows[0].prenom} ${result.rows[0].nom}` : null });
    } catch (err) { console.error('[zoom/teacher]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // GET /api/admin/teacher/:id/zoom-link
  router.get('/api/admin/teacher/:id/zoom-link', requireAdmin, async (req, res) => {
    try {
      const result = await pool.query('SELECT zoom_link FROM teachers WHERE id = $1', [req.params.id]);
      res.json({ zoom_link: result.rows[0]?.zoom_link || null });
    } catch (err) { console.error('[admin/zoom-link]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // ── Professor: start Zoom call to a specific student ────────
  router.post('/api/professor/zoom-call/start', requireTeacherAuth, async (req, res) => {
    const { studentId, zoomUrl } = req.body;
    if (!studentId) return res.status(400).json({ error: 'studentId requis' });
    try {
      // End any existing active calls for this teacher first
      await pool.query(
        `UPDATE zoom_active_calls SET status = 'ended', ended_at = NOW()
         WHERE teacher_id = $1 AND status = 'active'`,
        [req.teacherId]
      );
      // Start new call
      const r = await pool.query(
        `INSERT INTO zoom_active_calls (teacher_id, student_id, zoom_url)
         VALUES ($1, $2, $3) RETURNING *`,
        [req.teacherId, studentId, zoomUrl || null]
      );
      res.json({ success: true, call: r.rows[0] });
    } catch (err) { console.error('[zoom/start]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // ── Professor: start Zoom call to a GROUP of students ───────
  router.post('/api/professor/zoom-call/start-group', requireTeacherAuth, async (req, res) => {
    const { studentIds, zoomUrl } = req.body;
    if (!Array.isArray(studentIds) || !studentIds.length) return res.status(400).json({ error: 'studentIds requis' });
    try {
      await pool.query(
        `UPDATE zoom_active_calls SET status = 'ended', ended_at = NOW()
         WHERE teacher_id = $1 AND status = 'active'`,
        [req.teacherId]
      );
      const calls = [];
      for (const sid of studentIds.slice(0, 50)) {
        const r = await pool.query(
          `INSERT INTO zoom_active_calls (teacher_id, student_id, zoom_url)
           VALUES ($1, $2, $3) RETURNING *`,
          [req.teacherId, sid, zoomUrl || null]
        );
        calls.push(r.rows[0]);
      }
      res.json({ success: true, count: calls.length });
    } catch (err) { console.error('[zoom/start-group]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // ── Professor: end current Zoom call ────────────────────────
  router.post('/api/professor/zoom-call/end', requireTeacherAuth, async (req, res) => {
    try {
      const r = await pool.query(
        `UPDATE zoom_active_calls SET status = 'ended', ended_at = NOW()
         WHERE teacher_id = $1 AND status = 'active' RETURNING *`,
        [req.teacherId]
      );
      res.json({ success: true, ended: r.rows.length });
    } catch (err) { console.error('[zoom/end]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // ── Student: check for active call addressed to them ────────
  router.get('/api/student/active-call', requireStudentAuth, async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT zac.*, t.nom AS teacher_nom, t.prenom AS teacher_prenom, t.zoom_link
         FROM zoom_active_calls zac
         JOIN teachers t ON t.id = zac.teacher_id
         WHERE zac.student_id = $1 AND zac.status = 'active'
         ORDER BY zac.created_at DESC LIMIT 1`,
        [req.studentId]
      );
      res.json({ active: r.rows[0] || null });
    } catch (err) { console.error('[zoom/active]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  return router;
};

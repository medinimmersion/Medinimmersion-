/**
 * routes/schedules.js — Course schedule templates CRUD
 * Owns: /api/schedules POST, /api/admin/schedules POST
 * Does NOT own: teacher schedule listing (see teacher.js)
 */
'use strict';

module.exports = function (pool, opts) {
  const { requireAdmin, requireTeacherAuth, requireGerant, pool: db } = opts;
  const router = require('express').Router();

  // POST /api/teacher/schedules
  router.post('/api/teacher/schedules', requireTeacherAuth, async (req, res) => {
    try {
      const { title, course_type, start_date, end_date, days_of_week, time_start, time_end } = req.body;
      if (!start_date || !time_start || !time_end) return res.status(400).json({ error: 'Champs requis' });

      const result = await pool.query(
        `INSERT INTO course_schedules (title, teacher_id, course_type, start_date, end_date, days_of_week, time_start, time_end)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [title || null, req.teacherId, course_type || 'arabe', start_date, end_date || null,
         days_of_week || [], time_start, time_end]
      );
      res.json(result.rows[0]);
    } catch (err) { console.error('[teacher/schedules]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // POST /api/admin/schedules
  router.post('/api/admin/schedules', requireAdmin, async (req, res) => {
    try {
      const { title, teacher_id, course_type, start_date, end_date, days_of_week, time_start, time_end } = req.body;
      if (!start_date || !time_start || !time_end) return res.status(400).json({ error: 'Champs requis' });

      const result = await pool.query(
        `INSERT INTO course_schedules (title, teacher_id, course_type, start_date, end_date, days_of_week, time_start, time_end)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [title || null, teacher_id || null, course_type || 'arabe', start_date, end_date || null,
         days_of_week || [], time_start, time_end]
      );
      res.json(result.rows[0]);
    } catch (err) { console.error('[admin/schedules]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // GET /api/schedules — list all (admin)
  router.get('/api/schedules', requireAdmin, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT cs.*, t.nom as teacher_nom, t.prenom as teacher_prenom,
          (SELECT COUNT(*) FROM schedule_students WHERE schedule_id = cs.id)::int as student_count
        FROM course_schedules cs
        LEFT JOIN teachers t ON t.id = cs.teacher_id
        ORDER BY cs.start_date DESC
      `);
      res.json(result.rows);
    } catch (err) { console.error('[schedules]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  return router;
};
/**
 * routes/sessions.js — Scheduled sessions CRUD
 * Owns: /api/sessions POST, /api/sessions/:id
 * Does NOT own: teacher session listing (see teacher.js)
 */
'use strict';

module.exports = function (pool, opts) {
  const { requireTeacherAuth, requireAdmin, requireGerant, pool: db } = opts;
  const router = require('express').Router();

  // POST /api/sessions
  router.post('/api/sessions', requireTeacherAuth, async (req, res) => {
    try {
      const { schedule_id, session_date, time_start, time_end, course_type, notes, student_ids } = req.body;
      if (!session_date || !time_start || !time_end) {
        return res.status(400).json({ error: 'session_date, time_start, time_end requis' });
      }

      const result = await pool.query(
        `INSERT INTO scheduled_sessions (schedule_id, teacher_id, session_date, time_start, time_end, course_type, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [schedule_id || null, req.teacherId, session_date, time_start, time_end, course_type || 'arabe', notes || null]
      );

      const session = result.rows[0];

      // Enroll students if provided
      if (Array.isArray(student_ids) && student_ids.length) {
        for (const sid of student_ids) {
          await pool.query(
            'INSERT INTO session_students (session_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [session.id, sid]
          );
        }
      }

      res.json(session);
    } catch (err) { console.error('[sessions]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // POST /api/admin/sessions — admin creates session
  router.post('/api/admin/sessions', requireAdmin, async (req, res) => {
    try {
      const { teacher_id, schedule_id, session_date, time_start, time_end, course_type, notes, student_ids } = req.body;
      if (!session_date || !time_start || !time_end) return res.status(400).json({ error: 'Champs requis' });

      const result = await pool.query(
        `INSERT INTO scheduled_sessions (schedule_id, teacher_id, session_date, time_start, time_end, course_type, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [schedule_id || null, teacher_id || null, session_date, time_start, time_end, course_type || 'arabe', notes || null]
      );

      const session = result.rows[0];
      if (Array.isArray(student_ids) && student_ids.length) {
        for (const sid of student_ids) {
          await pool.query('INSERT INTO session_students (session_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [session.id, sid]);
        }
      }
      res.json(session);
    } catch (err) { console.error('[admin/sessions]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // POST /api/teacher/sessions/reschedule
  router.post('/api/teacher/sessions/reschedule', requireTeacherAuth, async (req, res) => {
    try {
      const { session_id, new_date, new_time_start, new_time_end } = req.body;
      if (!session_id) return res.status(400).json({ error: 'session_id requis' });

      const updates = [];
      const params = [];
      let idx = 1;
      if (new_date) { updates.push(`session_date = $${idx++}`); params.push(new_date); }
      if (new_time_start) { updates.push(`time_start = $${idx++}`); params.push(new_time_start); }
      if (new_time_end) { updates.push(`time_end = $${idx++}`); params.push(new_time_end); }

      if (!updates.length) return res.status(400).json({ error: 'Au moins un champ à modifier requis' });
      params.push(session_id);

      const result = await pool.query(
        `UPDATE scheduled_sessions SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
        params
      );

      if (!result.rows.length) return res.status(404).json({ error: 'Session non trouvée' });
      res.json(result.rows[0]);
    } catch (err) { console.error('[sessions/reschedule]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // POST /api/teacher/sessions/create
  router.post('/api/teacher/sessions/create', requireTeacherAuth, async (req, res) => {
    try {
      const { schedule_id, session_date, time_start, time_end, course_type } = req.body;
      if (!session_date || !time_start || !time_end) return res.status(400).json({ error: 'Champs requis' });

      const result = await pool.query(
        `INSERT INTO scheduled_sessions (schedule_id, teacher_id, session_date, time_start, time_end, course_type)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [schedule_id || null, req.teacherId, session_date, time_start, time_end, course_type || 'arabe']
      );
      res.json(result.rows[0]);
    } catch (err) { console.error('[sessions/create]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // GET /api/teacher/sessions/:id/seance-statut — teacher reads their own session status
  router.get('/api/teacher/sessions/:id/seance-statut', requireTeacherAuth, async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id, 10);
      if (!Number.isFinite(sessionId)) return res.status(400).json({ error: 'ID invalide' });
      const result = await pool.query(
        'SELECT * FROM scheduled_sessions WHERE id = $1 AND teacher_id = $2',
        [sessionId, req.teacherId]
      );
      if (!result.rowCount) return res.status(404).json({ error: 'Séance non trouvée' });
      res.json(result.rows[0]);
    } catch (err) { console.error('[sessions/seance-statut]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // POST /api/teacher/sessions/:id/seance-statut — teacher sets per-session attendance status
  router.post('/api/teacher/sessions/:id/seance-statut', requireTeacherAuth, async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id, 10);
      if (!Number.isFinite(sessionId)) return res.status(400).json({ error: 'ID invalide' });
      const { seance_statut } = req.body;
      const validStatuts = ['absent', 'retarde', 'reporte', 'effectue'];
      if (!seance_statut || !validStatuts.includes(seance_statut)) {
        return res.status(400).json({ error: 'seance_statut requis : absent | retarde | reporte | effectue' });
      }
      const result = await pool.query(
        `UPDATE scheduled_sessions
         SET seance_statut = $1
         WHERE id = $2 AND teacher_id = $3
         RETURNING *`,
        [seance_statut, sessionId, req.teacherId]
      );
      if (!result.rowCount) return res.status(404).json({ error: 'Séance non trouvée' });
      res.json(result.rows[0]);
    } catch (err) { console.error('[sessions/seance-statut]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // GET /api/admin/sessions/:id/seance-statut — admin reads any session status
  router.get('/api/admin/sessions/:id/seance-statut', requireAdmin, async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id, 10);
      if (!Number.isFinite(sessionId)) return res.status(400).json({ error: 'ID invalide' });
      const result = await pool.query('SELECT * FROM scheduled_sessions WHERE id = $1', [sessionId]);
      if (!result.rowCount) return res.status(404).json({ error: 'Séance non trouvée' });
      res.json(result.rows[0]);
    } catch (err) { console.error('[admin/sessions/seance-statut]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // PUT /api/admin/sessions/:id/seance-statut — admin modifies any session status
  router.put('/api/admin/sessions/:id/seance-statut', requireAdmin, async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id, 10);
      if (!Number.isFinite(sessionId)) return res.status(400).json({ error: 'ID invalide' });
      const { seance_statut } = req.body;
      const validStatuts = ['absent', 'retarde', 'reporte', 'effectue'];
      if (!seance_statut || !validStatuts.includes(seance_statut)) {
        return res.status(400).json({ error: 'seance_statut requis : absent | retarde | reporte | effectue' });
      }
      const result = await pool.query(
        `UPDATE scheduled_sessions SET seance_statut = $1 WHERE id = $2 RETURNING *`,
        [seance_statut, sessionId]
      );
      if (!result.rowCount) return res.status(404).json({ error: 'Séance non trouvée' });
      res.json(result.rows[0]);
    } catch (err) { console.error('[admin/sessions/seance-statut]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  return router;
};
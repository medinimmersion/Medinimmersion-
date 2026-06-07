/**
 * routes/notifications.js — In-app notification management
 * Owns: /api/notifications/*, /api/student/notifications/*
 */
'use strict';

module.exports = function (pool, opts) {
  const { requireStudentAuth, requireAdmin, requireTeacherAuth, requireGerant } = opts;
  const router = require('express').Router();

  // GET /api/student/notifications — student's notifications
  router.get('/api/student/notifications', requireStudentAuth, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT n.*,
          (SELECT true FROM notification_reads nr WHERE nr.notification_id = n.id AND nr.student_id = $1) as read
        FROM notifications n
        WHERE n.target_type = 'all' OR (n.target_type = 'student' AND n.target_id = $1)
        ORDER BY n.created_at DESC LIMIT 50
      `, [req.studentId]);
      res.json(result.rows);
    } catch (err) { console.error('[student/notifications]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // GET /api/notifications — admin/teacher notifications
  router.get('/api/notifications', requireAdmin, async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50');
      res.json(result.rows);
    } catch (err) { console.error('[notifications]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // POST /api/student/notifications/:id/read
  router.post('/api/student/notifications/:id/read', requireStudentAuth, async (req, res) => {
    try {
      await pool.query(
        'INSERT INTO notification_reads (notification_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [req.params.id, req.studentId]
      );
      res.json({ success: true });
    } catch (err) { console.error('[notifications/read]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // POST /api/student/notifications/read-all
  router.post('/api/student/notifications/read-all', requireStudentAuth, async (req, res) => {
    try {
      await pool.query(`
        INSERT INTO notification_reads (notification_id, student_id)
        SELECT n.id, $1 FROM notifications n
        WHERE n.target_type = 'all' OR (n.target_type = 'student' AND n.target_id = $1)
        ON CONFLICT DO NOTHING
      `, [req.studentId]);
      res.json({ success: true });
    } catch (err) { console.error('[notifications/read-all]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  return router;
};
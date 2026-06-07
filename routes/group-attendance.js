/**
 * routes/group-attendance.js
 * Owns: per-student attendance records for group/multi-student sessions.
 * Does NOT own: session status (single-student) — that stays on scheduled_sessions.status.
 *
 * Mounted by server.js:
 *   app.use(require('./routes/group-attendance')(pool, requireTeacherAuth, requireAdmin));
 *
 * API:
 *   GET   /api/group-attendance/:sessionId                         — list per-student statuses (teacher/admin)
 *   PATCH /api/group-attendance/:sessionId/student/:studentId      — set one student's status (teacher/admin)
 */

const VALID_STATUSES = ['scheduled', 'completed', 'absent', 'late', 'rescheduled', 'cancelled'];

/**
 * @param {import('pg').Pool} pool
 * @param {Function} requireTeacherAuth — sets req.teacherId
 * @param {Function} requireAdmin — sets req.gerantUsername
 * @returns {import('express').Router}
 */
function makeRouter(pool, requireTeacherAuth, requireAdmin) {
  const express = require('express');
  const router = express.Router();

  // Middleware: teacher OR admin
  function requireTeacherOrAdmin(req, res, next) {
    const teacherToken = req.headers['x-teacher-token'];
    const adminToken = req.headers['x-admin-token'] || req.headers['x-gerant-token'];
    if (adminToken) {
      // Try admin auth first
      req._tryAdmin = true;
      return requireAdmin(req, res, () => {
        req.isAdmin = true;
        next();
      });
    }
    if (teacherToken) {
      return requireTeacherAuth(req, res, () => {
        req.isAdmin = false;
        next();
      });
    }
    return res.status(401).json({ error: 'Authentification requise' });
  }

  /**
   * GET /api/group-attendance/:sessionId
   * Returns per-student attendance for a session.
   */
  router.get('/api/group-attendance/:sessionId', requireTeacherOrAdmin, async (req, res) => {
    const sessionId = parseInt(req.params.sessionId, 10);
    if (!sessionId) return res.status(400).json({ error: 'sessionId requis' });

    try {
      // Verify access: teacher must own session
      if (!req.isAdmin) {
        const check = await pool.query(
          'SELECT id FROM scheduled_sessions WHERE id = $1 AND teacher_id = $2',
          [sessionId, req.teacherId]
        );
        if (check.rows.length === 0) return res.status(403).json({ error: 'Accès refusé' });
      }

      const result = await pool.query(`
        SELECT
          ss.student_id,
          s.prenom,
          s.nom,
          COALESCE(ga.status, 'scheduled') AS attendance_status,
          ga.marked_by,
          ga.marked_at
        FROM session_students ss
        JOIN students s ON s.id = ss.student_id
        LEFT JOIN group_attendance ga
          ON ga.session_id = ss.session_id AND ga.student_id = ss.student_id
        WHERE ss.session_id = $1
        ORDER BY s.prenom ASC, s.nom ASC
      `, [sessionId]);

      res.json({ session_id: sessionId, students: result.rows });
    } catch (err) {
      console.error('[group-attendance GET]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  /**
   * PATCH /api/group-attendance/:sessionId/student/:studentId
   * Set attendance status for one student in a session.
   * Body: { status: string }
   */
  router.patch('/api/group-attendance/:sessionId/student/:studentId', requireTeacherOrAdmin, async (req, res) => {
    const sessionId = parseInt(req.params.sessionId, 10);
    const studentId = parseInt(req.params.studentId, 10);
    const { status } = req.body;

    if (!sessionId || !studentId) return res.status(400).json({ error: 'Paramètres manquants' });
    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Statut invalide', valid: VALID_STATUSES });
    }

    try {
      // Verify access + 10-min rule for teacher
      if (!req.isAdmin) {
        const check = await pool.query(
          'SELECT id, session_date, time_start FROM scheduled_sessions WHERE id = $1 AND teacher_id = $2',
          [sessionId, req.teacherId]
        );
        if (check.rows.length === 0) return res.status(403).json({ error: 'Accès refusé' });

        const session = check.rows[0];
        const now = new Date();
        const todayStr = now.toISOString().substring(0, 10);
        const sessionDateStr = session.session_date instanceof Date
          ? session.session_date.toISOString().substring(0, 10)
          : String(session.session_date).substring(0, 10);

        if (sessionDateStr > todayStr) {
          return res.status(400).json({ error: 'Impossible de modifier le statut d\'une séance future' });
        }
        if (sessionDateStr === todayStr && session.time_start) {
          const [h, m] = String(session.time_start).split(':').map(Number);
          const sessionStartMs = h * 3600000 + m * 60000;
          const nowMs = now.getHours() * 3600000 + now.getMinutes() * 60000;
          if (nowMs < sessionStartMs + 10 * 60000) {
            return res.status(400).json({ error: 'Attendez 10 minutes après le début du cours' });
          }
        }
      }

      // Verify student is in this session
      const stuCheck = await pool.query(
        'SELECT id FROM session_students WHERE session_id = $1 AND student_id = $2',
        [sessionId, studentId]
      );
      if (stuCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Élève non trouvé dans cette séance' });
      }

      const markedBy = req.isAdmin ? ('gerant:' + (req.gerantUsername || 'admin')) : ('teacher:' + req.teacherId);

      await pool.query(`
        INSERT INTO group_attendance (session_id, student_id, status, marked_by, marked_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (session_id, student_id)
        DO UPDATE SET status = $3, marked_by = $4, marked_at = NOW()
      `, [sessionId, studentId, status, markedBy]);

      res.json({ success: true, session_id: sessionId, student_id: studentId, status });
    } catch (err) {
      console.error('[group-attendance PATCH]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  return router;
}

module.exports = makeRouter;

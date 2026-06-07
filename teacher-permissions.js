/**
 * Teacher permissions routes
 *
 * Admin routes (gérant):
 *   GET  /api/admin/teacher-permissions/:teacherId  — read permissions for a teacher
 *   PUT  /api/admin/teacher-permissions/:teacherId  — toggle a permission
 *     body: { permission: "can_edit_planning", value: true/false }
 *
 * Teacher route (self-service, read-only):
 *   GET  /api/teacher/permissions  — returns own permission flags (uses X-Teacher-Token)
 *
 * Mounted by server.js:
 *   app.use(require('./routes/teacher-permissions')(pool, requireAdmin, requireTeacherAuth));
 */

const VALID_PERMISSIONS = ['can_edit_planning', 'can_send_books', 'can_edit_zoom', 'can_edit_student_info'];

/**
 * @param {import('pg').Pool} pool
 * @param {Function} requireAdmin
 * @param {Function} requireTeacherAuth
 * @returns {import('express').Router}
 */
function makeRouter(pool, requireAdmin, requireTeacherAuth) {
  const express = require('express');
  const router = express.Router();

  // ── ADMIN: read all permissions for a teacher ──────────────────────
  router.get('/api/admin/teacher-permissions/:teacherId', requireAdmin, async (req, res) => {
    try {
      const teacherId = parseInt(req.params.teacherId, 10);
      if (!Number.isFinite(teacherId) || teacherId <= 0) {
        return res.status(400).json({ error: 'teacherId invalide' });
      }

      const result = await pool.query(
        'SELECT id, can_edit_planning, can_send_books, can_edit_zoom, can_edit_student_info FROM teachers WHERE id = $1',
        [teacherId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Professeur non trouvé' });
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error('[teacher-permissions] GET admin error:', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── ADMIN: toggle a single permission ─────────────────────────────
  router.put('/api/admin/teacher-permissions/:teacherId', requireAdmin, async (req, res) => {
    try {
      const teacherId = parseInt(req.params.teacherId, 10);
      if (!Number.isFinite(teacherId) || teacherId <= 0) {
        return res.status(400).json({ error: 'teacherId invalide' });
      }

      const { permission, value } = req.body;

      if (!VALID_PERMISSIONS.includes(permission)) {
        return res.status(400).json({
          error: 'Permission invalide. Valeurs acceptées : ' + VALID_PERMISSIONS.join(', ')
        });
      }

      if (typeof value !== 'boolean') {
        return res.status(400).json({ error: 'value doit être un booléen (true/false)' });
      }

      // Column name is whitelisted above — safe to interpolate
      const result = await pool.query(
        `UPDATE teachers SET ${permission} = $1 WHERE id = $2 RETURNING id, can_edit_planning, can_send_books, can_edit_zoom, can_edit_student_info`,
        [value, teacherId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Professeur non trouvé' });
      }

      res.json({ success: true, permissions: result.rows[0] });
    } catch (err) {
      console.error('[teacher-permissions] PUT error:', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── TEACHER: read own permissions ──────────────────────────────────
  // GET /api/teacher/permissions — returns the 4 boolean flags for the logged-in teacher
  router.get('/api/teacher/permissions', requireTeacherAuth, async (req, res) => {
    try {
      if (!req.teacherId) {
        // Legacy auth (no teacher ID) — return all false (read-only by default)
        return res.json({
          can_edit_planning: false,
          can_send_books: false,
          can_edit_zoom: false,
          can_edit_student_info: false
        });
      }

      const result = await pool.query(
        'SELECT can_edit_planning, can_send_books, can_edit_zoom, can_edit_student_info FROM teachers WHERE id = $1',
        [req.teacherId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Professeur non trouvé' });
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error('[teacher-permissions] GET teacher error:', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  return router;
}

module.exports = makeRouter;

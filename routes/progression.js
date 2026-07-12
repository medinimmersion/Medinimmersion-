/**
 * routes/progression.js — Student level and progression tracking
 * Owns: /api/progression/*
 */
'use strict';

module.exports = function (pool, opts) {
  const { requireStudentAuth, requireAdmin, requireTeacherAuth, requireGerant } = opts;
  const router = require('express').Router();

  // GET /api/progression — student's own progression
  router.get('/api/progression', requireStudentAuth, async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT * FROM student_progression WHERE student_id = $1',
        [req.studentId]
      );
      res.json(result.rows[0] || null);
    } catch (err) { console.error('[progression]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // GET /api/admin/progression/:student_id
  router.get('/api/admin/progression/:student_id', requireAdmin, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT sp.*, s.nom, s.prenom FROM student_progression sp
        JOIN students s ON s.id = sp.student_id
        WHERE sp.student_id = $1
      `, [req.params.student_id]);
      res.json(result.rows[0] || null);
    } catch (err) { console.error('[admin/progression]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // PUT /api/admin/progression/:student_id — admin updates student level
  router.put('/api/admin/progression/:student_id', requireAdmin, async (req, res) => {
    try {
      const { niveau, current_page, notes } = req.body;
      const result = await pool.query(
        `INSERT INTO student_progression (student_id, niveau, current_page, notes, updated_by, updated_at)
         VALUES ($1, $2, $3, $4, 'admin', NOW())
         ON CONFLICT (student_id) DO UPDATE SET
           niveau = COALESCE($2, student_progression.niveau),
           current_page = COALESCE($3, student_progression.current_page),
           notes = COALESCE($4, student_progression.notes),
           updated_by = 'admin', updated_at = NOW()
         RETURNING *`,
        [req.params.student_id, niveau, current_page, notes]
      );
      res.json(result.rows[0]);
    } catch (err) { console.error('[admin/update-progression]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // GET /api/admin/progression/:student_id/full — admin gets student + progression in one fetch
  router.get('/api/admin/progression/:student_id/full', requireAdmin, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT s.*, sp.niveau, sp.current_page, sp.notes as progression_notes,
               sp.updated_by as progression_updated_by, sp.updated_at as progression_updated_at
        FROM students s
        LEFT JOIN student_progression sp ON s.id = sp.student_id
        WHERE s.id = $1
      `, [req.params.student_id]);
      if (!result.rowCount) return res.status(404).json({ error: 'Élève non trouvé' });
      res.json(result.rows[0]);
    } catch (err) { console.error('[admin/progression/full]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // PUT /api/admin/progression/group/:group_id — bulk-update progression for all students in a group
  router.put('/api/admin/progression/group/:group_id', requireTeacherAuth, async (req, res) => {
    try {
      const { niveau, current_page } = req.body;
      const groupId = parseInt(req.params.group_id, 10);
      if (!groupId) return res.status(400).json({ error: 'Group ID invalide' });

      // Get all students in this group (only if teacher owns the group)
      const groupCheck = await pool.query(
        'SELECT id FROM groups WHERE id = $1 AND teacher_id = $2',
        [groupId, req.teacherId]
      );
      if (!groupCheck.rowCount) return res.status(403).json({ error: 'Groupe non autorisé' });

      // Get all students in group
      const students = await pool.query(
        'SELECT student_id FROM group_members WHERE group_id = $1',
        [groupId]
      );

      if (!students.rowCount) {
        return res.json({ updated_count: 0, message: 'Aucun élève dans ce groupe' });
      }

      const studentIds = students.rows.map(r => r.student_id);

      // Bulk upsert progression for all students
      const results = await Promise.all(
        studentIds.map(sid =>
          pool.query(
            `INSERT INTO student_progression (student_id, niveau, current_page, updated_by, updated_at)
             VALUES ($1, $2, $3, 'teacher', NOW())
             ON CONFLICT (student_id) DO UPDATE SET
               niveau = COALESCE($2, student_progression.niveau),
               current_page = COALESCE($3, student_progression.current_page),
               updated_by = 'teacher', updated_at = NOW()
             RETURNING student_id`,
            [sid, niveau || null, current_page || null]
          )
        )
      );

      res.json({
        success: true,
        updated_count: studentIds.length,
        message: `Progression mise à jour pour ${studentIds.length} élève(s)`
      });
    } catch (err) {
      console.error('[admin/progression/group]', err);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  return router;
};
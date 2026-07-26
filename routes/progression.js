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
  // student_progression n'a pas de contrainte UNIQUE sur student_id :
  // on fait donc UPDATE puis INSERT si aucune ligne n'existe.
  router.put('/api/admin/progression/:student_id', requireAdmin, async (req, res) => {
    try {
      const { niveau, current_page, notes } = req.body;
      const sid = req.params.student_id;
      const upd = await pool.query(
        `UPDATE student_progression SET
           niveau = COALESCE($2, niveau),
           current_page = COALESCE($3, current_page),
           notes = COALESCE($4, notes),
           updated_by = 'admin', updated_at = NOW()
         WHERE student_id = $1 RETURNING *`,
        [sid, niveau, current_page, notes]);
      if (upd.rowCount) return res.json(upd.rows[0]);
      const ins = await pool.query(
        `INSERT INTO student_progression (student_id, niveau, current_page, notes, updated_by, updated_at)
         VALUES ($1, COALESCE($2,1), COALESCE($3,1), $4, 'admin', NOW()) RETURNING *`,
        [sid, niveau, current_page, notes]);
      res.json(ins.rows[0]);
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

  return router;
};
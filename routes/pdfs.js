/**
 * routes/pdfs.js — PDF/book upload management
 * Owns: /api/pdfs/*, /api/student/pdfs/*, /api/teacher/upload-pdf
 * Does NOT own: library management (see routes/library.js)
 */
'use strict';

module.exports = function (pool, opts) {
  const { requireStudentAuth, requireAdmin, requireTeacherAuth, uploadToR2WithRetry, FormDataLib, pool: db } = opts;
  const router = require('express').Router();

  // GET /api/student/pdfs — student's PDF slots (1-15)
  router.get('/api/student/pdfs', requireStudentAuth, async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT slot_number, title, file_url FROM student_pdfs WHERE student_id = $1 ORDER BY slot_number',
        [req.studentId]
      );
      // Fill gaps with empty slots
      const filled = Array.from({ length: 15 }, (_, i) => {
        const existing = result.rows.find(r => r.slot_number === i + 1);
        return existing || { slot_number: i + 1, title: null, file_url: null };
      });
      res.json(filled);
    } catch (err) { console.error('[student/pdfs]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // PATCH /api/student/pdfs/:slot — update a PDF slot
  router.patch('/api/student/pdfs/:slot', requireStudentAuth, async (req, res) => {
    try {
      const slot = parseInt(req.params.slot);
      if (slot < 1 || slot > 15) return res.status(400).json({ error: 'Slot invalide (1-15)' });
      const { title, file_url } = req.body;
      const result = await pool.query(
        `INSERT INTO student_pdfs (student_id, slot_number, title, file_url, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (student_id, slot_number) DO UPDATE SET
           title = COALESCE($3, student_pdfs.title),
           file_url = COALESCE($4, student_pdfs.file_url),
           updated_at = NOW()
         RETURNING *`,
        [req.studentId, slot, title || null, file_url || null]
      );
      res.json(result.rows[0]);
    } catch (err) { console.error('[student/pdfs/patch]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // POST /api/admin/upload-pdf
  router.post('/api/admin/upload-pdf', requireAdmin, async (req, res) => {
    try {
      const { slot_number, title, file_url, file_name } = req.body;
      if (!slot_number || !title) return res.status(400).json({ error: 'slot_number et title requis' });

      const result = await pool.query(
        `INSERT INTO library_books (slot_number, name, file_url, file_name, uploaded_by_type, uploaded_by_id)
         VALUES ($1, $2, $3, $4, 'gerant', NULL)
         ON CONFLICT (slot_number) DO UPDATE SET
           name = $2, file_url = COALESCE($3, library_books.file_url),
           file_name = COALESCE($4, library_books.file_name), updated_at = NOW()
         RETURNING *`,
        [slot_number, title, file_url || null, file_name || null]
      );
      res.json(result.rows[0]);
    } catch (err) { console.error('[admin/upload-pdf]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // POST /api/teacher/upload-pdf
  router.post('/api/teacher/upload-pdf', requireTeacherAuth, async (req, res) => {
    try {
      const { category_id, name, file_url, file_name } = req.body;
      if (!name) return res.status(400).json({ error: 'name requis' });

      const result = await pool.query(
        `INSERT INTO library_books (name, file_url, file_name, category_id, uploaded_by_type, uploaded_by_id)
         VALUES ($1, $2, $3, $4, 'teacher', $5) RETURNING *`,
        [name, file_url || null, file_name || null, category_id || null, req.teacherId]
      );
      res.json(result.rows[0]);
    } catch (err) { console.error('[teacher/upload-pdf]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  return router;
};
/**
 * Library routes — categories (emplacements) + book uploads
 * FIX 20/07/2026 : stockage des PDF directement en base de données (Neon Postgres)
 * au lieu de Cloudflare R2. Plus besoin de configurer R2_BASE_URL / R2_API_KEY.
 * Les fichiers sont servis via GET /api/files/book/:id
 */

const express = require('express');

function makeRouter(pool, requireAdmin, requireTeacherAuth, requireStudentAuth, uploadToR2WithRetry, FormDataLib) {
  const router = express.Router();

  // ── Auto-migration : ajoute la colonne file_data si elle n'existe pas ──
  (async () => {
    try {
      await pool.query('ALTER TABLE library_books ADD COLUMN IF NOT EXISTS file_data TEXT');
      console.log('[library] ✓ colonne file_data prête (stockage PDF en base)');
    } catch (e) {
      console.error('[library] migration file_data:', e.message);
    }
  })();

  async function checkTeacherBiblioPermission(teacherId) {
    if (!teacherId) return false;
    const r = await pool.query('SELECT can_send_books FROM teachers WHERE id = $1', [teacherId]);
    return r.rowCount > 0 && r.rows[0].can_send_books === true;
  }

  // ════════════════════════════════════════════════════════════
  // SERVE FILE — sert un PDF stocké en base de données
  // ════════════════════════════════════════════════════════════
  router.get('/api/files/book/:id', async (req, res) => {
    const bookId = parseInt(req.params.id, 10);
    if (!Number.isFinite(bookId)) return res.status(400).send('ID invalide');
    try {
      const r = await pool.query('SELECT name, file_name, file_data FROM library_books WHERE id = $1', [bookId]);
      if (r.rowCount === 0 || !r.rows[0].file_data) return res.status(404).send('Fichier non trouvé');
      const buffer = Buffer.from(r.rows[0].file_data, 'base64');
      const fname = r.rows[0].file_name || (r.rows[0].name + '.pdf');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${fname.replace(/[^\x20-\x7E]/g, '_')}"`);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(buffer);
    } catch (err) {
      console.error('[library] GET file error:', err.message);
      res.status(500).send('Erreur serveur');
    }
  });

  // ── GET /api/library/categories ──────────────────────────────────────
  router.get('/api/library/categories', async (req, res) => {
    const adminToken = req.headers['x-admin-token'] || req.headers['x-gerant-token'];
    const teacherToken = req.headers['x-teacher-token'];
    const studentToken = req.headers['x-student-token'];
    if (!adminToken && !teacherToken && !studentToken) {
      return res.status(401).json({ error: 'Authentification requise' });
    }
    try {
      const result = await pool.query(
        'SELECT id, name, created_by_type, created_by_id, created_at FROM library_categories ORDER BY id'
      );
      res.json(result.rows);
    } catch (err) {
      console.error('[library] GET categories error:', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── POST /api/library/categories ─────────────────────────────────────
  router.post('/api/library/categories', async (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Nom de catégorie requis' });
    const adminToken = req.headers['x-admin-token'] || req.headers['x-gerant-token'];
    const teacherToken = req.headers['x-teacher-token'];
    let createdByType = null, createdById = null;
    if (adminToken) {
      createdByType = 'gerant'; createdById = null;
    } else if (teacherToken) {
      return res.status(403).json({ error: 'Utilisez la route sécurisée /api/library/categories (avec authentification teacher)' });
    } else {
      return res.status(401).json({ error: 'Authentification requise' });
    }
    try {
      const result = await pool.query(
        'INSERT INTO library_categories (name, created_by_type, created_by_id) VALUES ($1, $2, $3) RETURNING *',
        [name.trim(), createdByType, createdById]
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error('[library] POST category error:', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── POST /api/admin/library/categories ────────────────────────────────
  router.post('/api/admin/library/categories', requireAdmin, async (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Nom de catégorie requis' });
    try {
      const result = await pool.query(
        'INSERT INTO library_categories (name, created_by_type, created_by_id) VALUES ($1, $2, $3) RETURNING *',
        [name.trim(), 'gerant', null]
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error('[library] POST admin category error:', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── GET /api/admin/library/categories ────────────────────────────────
  router.get('/api/admin/library/categories', requireAdmin, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT lc.*, t.nom as teacher_nom, t.prenom as teacher_prenom
         FROM library_categories lc
         LEFT JOIN teachers t ON lc.created_by_type = 'teacher' AND lc.created_by_id = t.id
         ORDER BY lc.id`
      );
      res.json(result.rows);
    } catch (err) {
      console.error('[library] GET admin categories error:', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── DELETE /api/admin/library/categories/:id ──────────────────────────
  router.delete('/api/admin/library/categories/:id', requireAdmin, async (req, res) => {
    const catId = parseInt(req.params.id, 10);
    if (!Number.isFinite(catId)) return res.status(400).json({ error: 'ID invalide' });
    try {
      const nonClasse = await pool.query("SELECT id FROM library_categories WHERE name = 'Non classé' LIMIT 1");
      const fallbackId = nonClasse.rowCount > 0 ? nonClasse.rows[0].id : null;
      if (fallbackId && fallbackId !== catId) {
        await pool.query('UPDATE library_books SET category_id = $1 WHERE category_id = $2', [fallbackId, catId]);
      }
      const result = await pool.query('DELETE FROM library_categories WHERE id = $1', [catId]);
      if (result.rowCount === 0) return res.status(404).json({ error: 'Catégorie non trouvée' });
      res.json({ success: true });
    } catch (err) {
      console.error('[library] DELETE admin category error:', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── POST /api/teacher/library/categories ─────────────────────────────
  router.post('/api/teacher/library/categories', requireTeacherAuth, async (req, res) => {
    if (!req.teacherId) return res.status(403).json({ error: 'Reconnectez-vous avec un compte enseignant' });
    const hasPermission = await checkTeacherBiblioPermission(req.teacherId);
    if (!hasPermission) return res.status(403).json({ error: 'Permission Bibliothèque requise. Contactez le gérant.' });
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Nom de catégorie requis' });
    try {
      const result = await pool.query(
        'INSERT INTO library_categories (name, created_by_type, created_by_id) VALUES ($1, $2, $3) RETURNING *',
        [name.trim(), 'teacher', req.teacherId]
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error('[library] POST teacher category error:', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── GET /api/teacher/library/categories ──────────────────────────────
  router.get('/api/teacher/library/categories', requireTeacherAuth, async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT id, name, created_by_type, created_by_id, created_at FROM library_categories ORDER BY id'
      );
      res.json(result.rows);
    } catch (err) {
      console.error('[library] GET teacher categories error:', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── DELETE /api/teacher/library/categories/:id ────────────────────────
  router.delete('/api/teacher/library/categories/:id', requireTeacherAuth, async (req, res) => {
    if (!req.teacherId) return res.status(403).json({ error: 'Reconnectez-vous avec un compte enseignant' });
    const hasPermission = await checkTeacherBiblioPermission(req.teacherId);
    if (!hasPermission) return res.status(403).json({ error: 'Permission Bibliothèque requise' });
    const catId = parseInt(req.params.id, 10);
    if (!Number.isFinite(catId)) return res.status(400).json({ error: 'ID invalide' });
    try {
      const cat = await pool.query('SELECT * FROM library_categories WHERE id = $1', [catId]);
      if (cat.rowCount === 0) return res.status(404).json({ error: 'Catégorie non trouvée' });
      if (cat.rows[0].created_by_type !== 'teacher' || cat.rows[0].created_by_id !== req.teacherId) {
        return res.status(403).json({ error: 'Vous ne pouvez supprimer que vos propres catégories' });
      }
      const nonClasse = await pool.query("SELECT id FROM library_categories WHERE name = 'Non classé' LIMIT 1");
      const fallbackId = nonClasse.rowCount > 0 ? nonClasse.rows[0].id : null;
      if (fallbackId) {
        await pool.query('UPDATE library_books SET category_id = $1 WHERE category_id = $2', [fallbackId, catId]);
      }
      await pool.query('DELETE FROM library_categories WHERE id = $1', [catId]);
      res.json({ success: true });
    } catch (err) {
      console.error('[library] DELETE teacher category error:', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── GET /api/admin/library/books-with-categories ──────────────────────
  router.get('/api/admin/library/books-with-categories', requireAdmin, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT lb.id, lb.slot_number, lb.name, lb.file_url, lb.file_name,
                lb.uploaded_by_type, lb.uploaded_by_id, lb.niveau_min, lb.statut,
                lb.created_at, lb.updated_at,
                lc.id as category_id, lc.name as category_name,
                t.nom as teacher_nom, t.prenom as teacher_prenom
         FROM library_books lb
         LEFT JOIN library_categories lc ON lb.category_id = lc.id
         LEFT JOIN teachers t ON lb.uploaded_by_type = 'teacher' AND lb.uploaded_by_id = t.id
         ORDER BY lc.name NULLS LAST, lb.name`
      );
      res.json(result.rows);
    } catch (err) {
      console.error('[library] GET admin books-with-categories error:', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── POST /api/admin/library/books ────────────────────────────────────
  // ✅ Stockage EN BASE DE DONNÉES (plus de R2 requis)
  router.post('/api/admin/library/books', requireAdmin, async (req, res) => {
    const { name, data, category_id, niveau_min } = req.body;
    if (!data || !name) return res.status(400).json({ error: 'Nom et fichier requis' });
    try {
      const buffer = Buffer.from(data, 'base64');
      if (!buffer.length) return res.status(400).json({ error: 'Fichier vide ou illisible' });
      const safeName = name.replace(/[^\x20-\x7E]/g, '_').replace(/\s+/g, '_');
      const fileName = safeName.endsWith('.pdf') ? safeName : safeName + '.pdf';

      const catId = category_id ? parseInt(category_id, 10) : null;
      const niveau = (niveau_min !== undefined && niveau_min !== null && niveau_min !== '') ? parseInt(niveau_min, 10) : 1;

      // Insertion avec le PDF stocké en base (file_data), file_url pointera vers notre route
      const dbResult = await pool.query(
        `INSERT INTO library_books (name, file_data, file_name, category_id, uploaded_by_type, uploaded_by_id, slot_number, niveau_min, statut)
         VALUES ($1, $2, $3, $4, 'gerant', NULL, NULL, $5, 'approuve') RETURNING id`,
        [name.trim(), data, fileName, catId || null, niveau]
      );
      const newId = dbResult.rows[0].id;
      const fileUrl = '/api/files/book/' + newId;
      await pool.query('UPDATE library_books SET slot_number = id, file_url = $2 WHERE id = $1', [newId, fileUrl]);

      const final = await pool.query('SELECT id, name, file_url, file_name, niveau_min, category_id, slot_number FROM library_books WHERE id = $1', [newId]);
      res.json(final.rows[0]);
    } catch (err) {
      console.error('[library] POST admin book error:', err.message);
      res.status(500).json({ error: 'Erreur serveur : ' + err.message });
    }
  });

  // ── PATCH /api/admin/library/books/:id — renommer / changer niveau ────
  router.patch('/api/admin/library/books/:id', requireAdmin, async (req, res) => {
    const bookId = parseInt(req.params.id, 10);
    if (!Number.isFinite(bookId)) return res.status(400).json({ error: 'ID invalide' });
    const { name, niveau_min } = req.body;
    try {
      const fields = [];
      const vals = [];
      let i = 1;
      if (name !== undefined && name !== null && name.trim() !== '') { fields.push(`name = $${i++}`); vals.push(name.trim()); }
      if (niveau_min !== undefined && niveau_min !== null && niveau_min !== '') { fields.push(`niveau_min = $${i++}`); vals.push(parseInt(niveau_min, 10)); }
      if (!fields.length) return res.status(400).json({ error: 'Rien à modifier' });
      fields.push('updated_at = NOW()');
      vals.push(bookId);
      const result = await pool.query(
        `UPDATE library_books SET ${fields.join(', ')} WHERE id = $${i} RETURNING id, name, niveau_min`,
        vals
      );
      if (result.rowCount === 0) return res.status(404).json({ error: 'Livre non trouvé' });
      res.json(result.rows[0]);
    } catch (err) {
      console.error('[library] PATCH admin book error:', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── DELETE /api/admin/library/books/:id ──────────────────────────────
  router.delete('/api/admin/library/books/:id', requireAdmin, async (req, res) => {
    const bookId = parseInt(req.params.id, 10);
    if (!Number.isFinite(bookId)) return res.status(400).json({ error: 'ID invalide' });
    try {
      await pool.query('DELETE FROM book_assignments WHERE book_slot_number = $1', [bookId]);
      const result = await pool.query('DELETE FROM library_books WHERE id = $1', [bookId]);
      if (result.rowCount === 0) return res.status(404).json({ error: 'Livre non trouvé' });
      res.json({ success: true });
    } catch (err) {
      console.error('[library] DELETE admin book error:', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── PATCH /api/admin/library/books/:id/category ───────────────────────
  router.patch('/api/admin/library/books/:id/category', requireAdmin, async (req, res) => {
    const bookId = parseInt(req.params.id, 10);
    if (!Number.isFinite(bookId)) return res.status(400).json({ error: 'ID invalide' });
    const { category_id } = req.body;
    try {
      const result = await pool.query(
        'UPDATE library_books SET category_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [category_id || null, bookId]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: 'Livre non trouvé' });
      res.json(result.rows[0]);
    } catch (err) {
      console.error('[library] PATCH admin book category error:', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── PATCH /api/admin/library/books/:id/approve ────────────────────────
  router.patch('/api/admin/library/books/:id/approve', requireAdmin, async (req, res) => {
    const bookId = parseInt(req.params.id, 10);
    if (!Number.isFinite(bookId)) return res.status(400).json({ error: 'ID invalide' });
    try {
      const result = await pool.query(
        `UPDATE library_books SET statut = 'approuve', updated_at = NOW()
         WHERE id = $1 AND uploaded_by_type = 'teacher' AND statut = 'en_attente'
         RETURNING *`,
        [bookId]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: 'Livre non trouvé ou déjà approuvé' });
      res.json(result.rows[0]);
    } catch (err) {
      console.error('[library] PATCH approve book error:', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── POST /api/teacher/library/books ──────────────────────────────────
  // ✅ Stockage EN BASE DE DONNÉES (plus de R2 requis)
  router.post('/api/teacher/library/books', requireTeacherAuth, async (req, res) => {
    if (!req.teacherId) return res.status(403).json({ error: 'Reconnectez-vous avec un compte enseignant' });
    const hasPermission = await checkTeacherBiblioPermission(req.teacherId);
    if (!hasPermission) return res.status(403).json({ error: 'Permission Bibliothèque requise. Contactez le gérant.' });
    const { name, data, category_id, niveau_min } = req.body;
    if (!data || !name) return res.status(400).json({ error: 'Nom et fichier requis' });
    try {
      const buffer = Buffer.from(data, 'base64');
      if (!buffer.length) return res.status(400).json({ error: 'Fichier vide ou illisible' });
      const safeName = name.replace(/[^\x20-\x7E]/g, '_').replace(/\s+/g, '_');
      const fileName = safeName.endsWith('.pdf') ? safeName : safeName + '.pdf';
      const catId = category_id ? parseInt(category_id, 10) : null;
      const niveau = (niveau_min !== undefined && niveau_min !== null && niveau_min !== '') ? parseInt(niveau_min, 10) : 1;
      const dbResult = await pool.query(
        `INSERT INTO library_books (name, file_data, file_name, category_id, uploaded_by_type, uploaded_by_id, slot_number, niveau_min, statut)
         VALUES ($1, $2, $3, $4, 'teacher', $5, NULL, $6, 'en_attente') RETURNING id`,
        [name.trim(), data, fileName, catId || null, req.teacherId, niveau]
      );
      const newId = dbResult.rows[0].id;
      const fileUrl = '/api/files/book/' + newId;
      await pool.query('UPDATE library_books SET slot_number = id, file_url = $2 WHERE id = $1', [newId, fileUrl]);
      const final = await pool.query('SELECT id, name, file_url, file_name, niveau_min FROM library_books WHERE id = $1', [newId]);
      res.json(final.rows[0]);
    } catch (err) {
      console.error('[library] POST teacher book error:', err.message);
      res.status(500).json({ error: 'Erreur serveur : ' + err.message });
    }
  });

  // ── GET /api/teacher/library/books-with-categories (legacy) ───────────
  router.get('/api/teacher/library/books-with-categories', requireTeacherAuth, async (req, res) => {
    try {
      const teacherId = req.teacherId;
      let rows;
      if (!teacherId) {
        const r = await pool.query(
          `SELECT lb.*, lc.name as category_name FROM library_books lb
           LEFT JOIN library_categories lc ON lb.category_id = lc.id
           WHERE lb.file_url IS NOT NULL ORDER BY lc.name NULLS LAST, lb.name`
        );
        rows = r.rows;
      } else {
        const r = await pool.query(
          `SELECT DISTINCT lb.id, lb.slot_number, lb.name, lb.file_url, lb.file_name,
                  lb.uploaded_by_type, lb.uploaded_by_id, lb.updated_at,
                  lc.id as category_id, lc.name as category_name,
                  bp.id as has_permission
           FROM library_books lb
           LEFT JOIN library_categories lc ON lb.category_id = lc.id
           LEFT JOIN book_permissions bp ON bp.book_id = lb.id AND bp.user_id = $1 AND bp.user_type = 'teacher'
           WHERE lb.file_url IS NOT NULL
             AND (
               (lb.uploaded_by_type = 'teacher' AND lb.uploaded_by_id = $1)
               OR bp.id IS NOT NULL
             )
           ORDER BY lc.name NULLS LAST, lb.name`,
          [teacherId]
        );
        rows = r.rows;
      }
      res.json(rows);
    } catch (err) {
      console.error('[library] GET teacher books error:', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── DELETE /api/teacher/library/books/:id ────────────────────────────
  router.delete('/api/teacher/library/books/:id', requireTeacherAuth, async (req, res) => {
    if (!req.teacherId) return res.status(403).json({ error: 'Reconnectez-vous' });
    const hasPermission = await checkTeacherBiblioPermission(req.teacherId);
    if (!hasPermission) return res.status(403).json({ error: 'Permission Bibliothèque requise' });
    const bookId = parseInt(req.params.id, 10);
    if (!Number.isFinite(bookId)) return res.status(400).json({ error: 'ID invalide' });
    try {
      const book = await pool.query('SELECT * FROM library_books WHERE id = $1', [bookId]);
      if (book.rowCount === 0) return res.status(404).json({ error: 'Livre non trouvé' });
      if (book.rows[0].uploaded_by_type !== 'teacher' || book.rows[0].uploaded_by_id !== req.teacherId) {
        return res.status(403).json({ error: 'Vous ne pouvez supprimer que vos propres livres' });
      }
      await pool.query('DELETE FROM book_assignments WHERE book_slot_number = $1', [bookId]);
      await pool.query('DELETE FROM library_books WHERE id = $1', [bookId]);
      res.json({ success: true });
    } catch (err) {
      console.error('[library] DELETE teacher book error:', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── PATCH /api/teacher/library/books/:id/category ─────────────────────
  router.patch('/api/teacher/library/books/:id/category', requireTeacherAuth, async (req, res) => {
    if (!req.teacherId) return res.status(403).json({ error: 'Reconnectez-vous' });
    const hasPermission = await checkTeacherBiblioPermission(req.teacherId);
    if (!hasPermission) return res.status(403).json({ error: 'Permission Bibliothèque requise' });
    const bookId = parseInt(req.params.id, 10);
    if (!Number.isFinite(bookId)) return res.status(400).json({ error: 'ID invalide' });
    try {
      const book = await pool.query('SELECT * FROM library_books WHERE id = $1', [bookId]);
      if (book.rowCount === 0) return res.status(404).json({ error: 'Livre non trouvé' });
      if (book.rows[0].uploaded_by_type !== 'teacher' || book.rows[0].uploaded_by_id !== req.teacherId) {
        return res.status(403).json({ error: 'Vous ne pouvez modifier que vos propres livres' });
      }
      const { category_id } = req.body;
      const result = await pool.query(
        'UPDATE library_books SET category_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [category_id || null, bookId]
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error('[library] PATCH teacher book category error:', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ════════════════════════════════════════════════════════════
  // BOOK PERMISSIONS (teacher access control)
  // ════════════════════════════════════════════════════════════

  router.get('/api/admin/book-permissions', requireAdmin, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT bp.id, bp.book_id, bp.user_id, bp.granted_at,
                lb.name as book_name, lb.file_url,
                t.nom as teacher_nom, t.prenom as teacher_prenom
         FROM book_permissions bp
         JOIN library_books lb ON bp.book_id = lb.id
         JOIN teachers t ON bp.user_id = t.id
         WHERE bp.user_type = 'teacher'
         ORDER BY bp.granted_at DESC`
      );
      res.json(result.rows);
    } catch (err) {
      console.error('[library] GET book-permissions error:', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  router.post('/api/admin/book-permissions', requireAdmin, async (req, res) => {
    const { book_id, teacher_id } = req.body;
    if (!book_id || !teacher_id) return res.status(400).json({ error: 'book_id et teacher_id requis' });
    try {
      const result = await pool.query(
        `INSERT INTO book_permissions (book_id, user_id, user_type, granted_by)
         VALUES ($1, $2, 'teacher', NULL)
         ON CONFLICT (book_id, user_id, user_type) DO UPDATE SET granted_at = NOW()
         RETURNING *`,
        [book_id, teacher_id]
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error('[library] POST book-permission error:', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  router.delete('/api/admin/book-permissions/:id', requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID invalide' });
    try {
      await pool.query('DELETE FROM book_permissions WHERE id = $1 AND user_type = $2', [id, 'teacher']);
      res.json({ success: true });
    } catch (err) {
      console.error('[library] DELETE book-permission error:', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  router.get('/api/admin/book-permissions/teachers', requireAdmin, async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT id, nom, prenom FROM teachers WHERE is_active = true ORDER BY prenom, nom'
      );
      res.json(result.rows);
    } catch (err) {
      console.error('[library] GET teachers for permissions error:', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  router.get('/api/admin/book-permissions/for-book/:bookId', requireAdmin, async (req, res) => {
    const bookId = parseInt(req.params.bookId, 10);
    if (!Number.isFinite(bookId)) return res.status(400).json({ error: 'ID invalide' });
    try {
      const result = await pool.query(
        `SELECT bp.id, bp.user_id as teacher_id, t.nom, t.prenom
         FROM book_permissions bp
         JOIN teachers t ON bp.user_id = t.id
         WHERE bp.book_id = $1 AND bp.user_type = 'teacher'
         ORDER BY t.prenom, t.nom`,
        [bookId]
      );
      res.json(result.rows);
    } catch (err) {
      console.error('[library] GET permissions for book error:', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  router.post('/api/admin/book-permissions/batch', requireAdmin, async (req, res) => {
    const { book_id, teacher_ids } = req.body;
    if (!book_id || !Array.isArray(teacher_ids)) return res.status(400).json({ error: 'book_id et teacher_ids[] requis' });
    try {
      await pool.query('DELETE FROM book_permissions WHERE book_id = $1 AND user_type = $2', [book_id, 'teacher']);
      for (const teacherId of teacher_ids) {
        await pool.query(
          `INSERT INTO book_permissions (book_id, user_id, user_type, granted_by)
           VALUES ($1, $2, 'teacher', NULL)
           ON CONFLICT (book_id, user_id, user_type) DO NOTHING`,
          [book_id, teacherId]
        );
      }
      res.json({ success: true });
    } catch (err) {
      console.error('[library] POST batch permissions error:', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ════════════════════════════════════════════════════════════
  // STUDENT BOOK ACCESS
  // ════════════════════════════════════════════════════════════

  router.get('/api/admin/student-book-access', requireAdmin, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT bsa.id, bsa.book_id, bsa.student_id, bsa.assigned_at,
                lb.name as book_name,
                s.prenom, s.nom as student_nom
         FROM book_student_access bsa
         JOIN library_books lb ON bsa.book_id = lb.id
         JOIN students s ON bsa.student_id = s.id
         ORDER BY bsa.assigned_at DESC`
      );
      res.json(result.rows);
    } catch (err) {
      console.error('[library] GET student-book-access error:', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  router.post('/api/admin/student-book-access', requireAdmin, async (req, res) => {
    const { book_id, student_id } = req.body;
    if (!book_id || !student_id) return res.status(400).json({ error: 'book_id et student_id requis' });
    try {
      const result = await pool.query(
        `INSERT INTO book_student_access (book_id, student_id, assigned_by)
         VALUES ($1, $2, NULL)
         ON CONFLICT (book_id, student_id) DO UPDATE SET assigned_at = NOW()
         RETURNING *`,
        [book_id, student_id]
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error('[library] POST student-book-access error:', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  router.delete('/api/admin/student-book-access/:id', requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID invalide' });
    try {
      await pool.query('DELETE FROM book_student_access WHERE id = $1', [id]);
      res.json({ success: true });
    } catch (err) {
      console.error('[library] DELETE student-book-access error:', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ════════════════════════════════════════════════════════════
  // STUDENT LIBRARY — filtered by assigned books only
  // ════════════════════════════════════════════════════════════

  router.get('/api/student/library/books', requireStudentAuth, async (req, res) => {
    if (!req.studentId) return res.status(403).json({ error: 'Reconnectez-vous' });
    try {
      const result = await pool.query(
        `SELECT lb.id, lb.slot_number, lb.name, lb.file_url, lb.file_name, lb.uploaded_by_type, lb.uploaded_by_id,
                lb.niveau_min, lb.updated_at,
                lc.id as category_id, lc.name as category_name
         FROM book_student_access bsa
         JOIN library_books lb ON bsa.book_id = lb.id
         LEFT JOIN library_categories lc ON lb.category_id = lc.id
         WHERE bsa.student_id = $1
           AND lb.file_url IS NOT NULL
           AND lb.statut = 'approuve'
           AND (lb.niveau_min IS NULL OR lb.niveau_min <= COALESCE(
                (SELECT niveau FROM student_progression WHERE student_id = $1), 1))
         ORDER BY lc.name NULLS LAST, lb.name`,
        [req.studentId]
      );
      res.json(result.rows);
    } catch (err) {
      console.error('[library] GET student books error:', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ════════════════════════════════════════════════════════════
  // TEACHER BOOK ASSIGNMENTS
  // ════════════════════════════════════════════════════════════

  router.post('/api/teacher/book-assignments', requireTeacherAuth, async (req, res) => {
    if (!req.teacherId) return res.status(403).json({ error: 'Reconnectez-vous' });
    const hasPermission = await checkTeacherBiblioPermission(req.teacherId);
    if (!hasPermission) return res.status(403).json({ error: 'Permission Bibliothèque requise. Contactez le gérant.' });
    const { book_id, student_id } = req.body;
    if (!book_id || !student_id) return res.status(400).json({ error: 'book_id et student_id requis' });
    try {
      const result = await pool.query(
        `INSERT INTO book_student_access (book_id, student_id, assigned_by)
         VALUES ($1, $2, $3)
         ON CONFLICT (book_id, student_id) DO UPDATE SET assigned_at = NOW()
         RETURNING *`,
        [book_id, student_id, req.teacherId]
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error('[library] POST book-assignment error:', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  return router;
}

module.exports = makeRouter;

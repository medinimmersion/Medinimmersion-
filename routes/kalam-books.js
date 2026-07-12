/**
 * routes/kalam-books.js — Extraction du contenu des livres pour Kalam.
 * Le gérant lance l'extraction d'un livre ; Gemini lit le PDF page par page
 * et le contenu est stocké pour être injecté dans les conversations Kalam.
 */
'use strict';

module.exports = function (pool, opts) {
  const router = require('express').Router();
  const books = require('../kalam-books');

  // Tables créées au démarrage (idempotent)
  books.ensureTables(pool).then(
    () => console.log('[kalam-books] tables prêtes'),
    (e) => console.error('[kalam-books] tables:', e.message));

  // Un seul livre en cours d'extraction à la fois (protège le serveur)
  let running = false;

  // POST /api/admin/books/:id/extract — lance l'extraction en tâche de fond
  router.post('/api/admin/books/:id/extract', opts.requireAdmin, async (req, res) => {
    if (running) return res.status(409).json({ error: 'Une extraction est déjà en cours. Attends qu\'elle se termine.' });
    const bookId = parseInt(req.params.id, 10);
    if (!bookId) return res.status(400).json({ error: 'Livre invalide.' });
    running = true;
    books.extractBook(pool, bookId)
      .catch(() => {})
      .finally(() => { running = false; });
    res.json({ ok: true, message: 'Extraction lancée. Elle prend quelques minutes — suis l\'avancement dans la liste des livres.' });
  });

  // GET /api/admin/kalam/extractions — statut d'extraction de tous les livres
  router.get('/api/admin/kalam/extractions', opts.requireAdmin, async (req, res) => {
    try {
      const r = await pool.query(`
        SELECT be.book_id, be.status, be.pages_done, be.total_pages, be.error, be.updated_at,
               (SELECT COUNT(*)::int FROM book_pages bp WHERE bp.book_id = be.book_id AND COALESCE(bp.content,'') <> '') AS pages_stockees
        FROM book_extractions be`);
      res.json(r.rows);
    } catch (err) {
      // Tables pas encore créées : liste vide plutôt qu'une erreur
      res.json([]);
    }
  });

  return router;
};

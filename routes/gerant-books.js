/**
 * routes/gerant-books.js
 * Gère la création/modification de livres depuis l'espace gérant
 */

'use strict';

module.exports = function (pool, opts) {
  const router = require('express').Router();
  const requireGerant = opts.requireGerant;

  /**
   * GET /api/gerant/books
   * Récupère la liste de tous les livres
   */
  router.get('/api/gerant/books', requireGerant, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT id, name, niveau_min, statut, file_name, created_at
        FROM library_books
        ORDER BY created_at DESC
      `);
      res.json({ success: true, books: result.rows });
    } catch (error) {
      console.error('[gerant-books/get]', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/gerant/books
   * Crée un nouveau livre
   */
  router.post('/api/gerant/books', requireGerant, async (req, res) => {
    try {
      const { name, niveau_min = 'Débutant', description } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Nom du livre requis' });
      }

      const result = await pool.query(`
        INSERT INTO library_books (name, niveau_min, statut, uploaded_by_type, uploaded_by_id, created_at)
        VALUES ($1, $2, 'approuve', 'gerant', 'gerant-master', NOW())
        RETURNING id, name, niveau_min, statut, created_at
      `, [name, niveau_min]);

      res.json({ success: true, book: result.rows[0] });
    } catch (error) {
      console.error('[gerant-books/post]', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * PUT /api/gerant/books/:id
   * Modifie un livre existant
   */
  router.put('/api/gerant/books/:id', requireGerant, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, niveau_min } = req.body;

      const updates = [];
      const values = [];
      let counter = 1;

      if (name !== undefined) {
        updates.push(`name = $${counter++}`);
        values.push(name);
      }
      if (niveau_min !== undefined) {
        updates.push(`niveau_min = $${counter++}`);
        values.push(niveau_min);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'Aucune modification' });
      }

      values.push(id);

      const result = await pool.query(`
        UPDATE library_books 
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE id = $${counter}
        RETURNING id, name, niveau_min, statut
      `, values);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Livre non trouvé' });
      }

      res.json({ success: true, book: result.rows[0] });
    } catch (error) {
      console.error('[gerant-books/put]', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * DELETE /api/gerant/books/:id
   * Supprime un livre
   */
  router.delete('/api/gerant/books/:id', requireGerant, async (req, res) => {
    try {
      const { id } = req.params;

      const result = await pool.query(`
        DELETE FROM library_books WHERE id = $1 RETURNING id
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Livre non trouvé' });
      }

      res.json({ success: true, message: 'Livre supprimé' });
    } catch (error) {
      console.error('[gerant-books/delete]', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};

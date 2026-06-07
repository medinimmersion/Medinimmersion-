/**
 * routes/cms.js — CMS content management (blog images, site content, settings)
 * Owns: /api/cms/*
 */
'use strict';

module.exports = function (pool, opts) {
  const { requireAdmin, requireGerant } = opts;
  const router = require('express').Router();

  // GET /api/cms — get all CMS content (public)
  router.get('/api/cms', async (req, res) => {
    try {
      const { page_key } = req.query;
      let query = 'SELECT page_key, field_key, field_type, COALESCE(published_value, value) as value FROM cms_content';
      const params = [];
      if (page_key) { query += ' WHERE page_key = $1'; params.push(page_key); }
      query += ' ORDER BY page_key, field_key';
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (err) { console.error('[cms]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // GET /api/cms/:page_key
  router.get('/api/cms/:page_key', async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT field_key, field_type, COALESCE(published_value, value) as value FROM cms_content WHERE page_key = $1',
        [req.params.page_key]
      );
      res.json(result.rows);
    } catch (err) { console.error('[cms/page]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // PUT /api/cms/:page_key/:field_key — admin updates a CMS field
  router.put('/api/cms/:page_key/:field_key', requireAdmin, async (req, res) => {
    try {
      const { value, published_value, field_type } = req.body;
      const result = await pool.query(
        `INSERT INTO cms_content (page_key, field_key, field_type, value, published_value, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (page_key, field_key) DO UPDATE SET
           value = COALESCE($4, cms_content.value),
           field_type = COALESCE($3, cms_content.field_type),
           published_value = COALESCE($5, cms_content.published_value),
           updated_at = NOW()
         RETURNING *`,
        [req.params.page_key, req.params.field_key, field_type || 'text', value || null, published_value || null]
      );
      res.json(result.rows[0]);
    } catch (err) { console.error('[cms/update]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // DELETE /api/cms/:page_key/:field_key
  router.delete('/api/cms/:page_key/:field_key', requireAdmin, async (req, res) => {
    try {
      await pool.query('DELETE FROM cms_content WHERE page_key = $1 AND field_key = $2',
        [req.params.page_key, req.params.field_key]);
      res.json({ success: true });
    } catch (err) { console.error('[cms/delete]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  return router;
};
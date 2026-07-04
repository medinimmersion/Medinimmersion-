// ============================================================
// API DE GESTION DU CONTENU DU SITE (textes + images)
// Fichier : routes/content-api.js
// Chargé automatiquement par server.js via la liste routeFiles.
// Protection : authentification gérant existante (aucune
// variable d'environnement supplémentaire nécessaire).
// ============================================================

const express = require('express');

module.exports = function (pool, opts) {
  const router = express.Router();

  // Protection : on réutilise l'authentification gérant existante du site.
  // (fallback sur CONTENT_ADMIN_KEY si jamais requireAdmin n'est pas fourni)
  function fallbackKeyCheck(req, res, next) {
    const key = req.headers['x-admin-key'];
    if (!process.env.CONTENT_ADMIN_KEY || key !== process.env.CONTENT_ADMIN_KEY) {
      return res.status(401).json({ error: 'Non autorisé' });
    }
    next();
  }
  const requireContentAdmin = (opts && opts.requireAdmin) ? opts.requireAdmin : fallbackKeyCheck;

  // ---------- PUBLIC ----------

  // Tous les textes (sans le base64 des images, trop lourd)
  router.get('/api/content', async (req, res) => {
    try {
      const r = await pool.query(
        "SELECT key, type, CASE WHEN type='text' THEN value ELSE NULL END AS value, (type='image' AND value IS NOT NULL) AS has_image FROM site_content"
      );
      const out = {};
      r.rows.forEach(row => { out[row.key] = { type: row.type, value: row.value, has_image: row.has_image }; });
      res.json(out);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Une image (servie comme vraie image, avec cache court)
  router.get('/api/content/img/:key', async (req, res) => {
    try {
      const r = await pool.query('SELECT value, mime FROM site_content WHERE key=$1 AND type=$2', [req.params.key, 'image']);
      if (!r.rows.length || !r.rows[0].value) return res.status(404).end();
      const buf = Buffer.from(r.rows[0].value, 'base64');
      res.set('Content-Type', r.rows[0].mime || 'image/jpeg');
      res.set('Cache-Control', 'public, max-age=300');
      res.send(buf);
    } catch (e) { res.status(500).end(); }
  });

  // ---------- GÉRANT ----------

  // Liste complète pour l'espace gérant (avec labels)
  router.get('/api/content/admin/list', requireContentAdmin, async (req, res) => {
    try {
      const r = await pool.query(
        "SELECT key, type, label, CASE WHEN type='text' THEN value ELSE NULL END AS value, (type='image' AND value IS NOT NULL) AS has_image, updated_at FROM site_content ORDER BY key"
      );
      res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Sauvegarder un texte
  router.post('/api/content/admin/text', requireContentAdmin, async (req, res) => {
    const { key, value } = req.body || {};
    if (!key || typeof value !== 'string') return res.status(400).json({ error: 'key et value requis' });
    try {
      await pool.query(
        "INSERT INTO site_content (key, type, value, updated_at) VALUES ($1,'text',$2,NOW()) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()",
        [key, value]
      );
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Sauvegarder une image (base64, max ~5 Mo) — crée l'emplacement s'il n'existe pas
  router.post('/api/content/admin/image', requireContentAdmin, async (req, res) => {
    const { key, data, mime, label } = req.body || {};
    if (!key || !data) return res.status(400).json({ error: 'key et data requis' });
    if (data.length > 7000000) return res.status(413).json({ error: 'Image trop lourde (max ~5 Mo). Compressez-la.' });
    try {
      await pool.query(
        "INSERT INTO site_content (key, type, value, mime, label, updated_at) VALUES ($1,'image',$2,$3,$4,NOW()) ON CONFLICT (key) DO UPDATE SET type='image', value=$2, mime=$3, label=COALESCE($4, site_content.label), updated_at=NOW()",
        [key, data, mime || 'image/jpeg', label || null]
      );
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Supprimer une image (l'emplacement reste, l'image disparaît du site)
  router.delete('/api/content/admin/image/:key', requireContentAdmin, async (req, res) => {
    try {
      await pool.query("UPDATE site_content SET value=NULL, updated_at=NOW() WHERE key=$1 AND type='image'", [req.params.key]);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
};

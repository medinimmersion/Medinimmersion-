// ============================================================
// API DE GESTION DU CONTENU DU SITE (textes + images)
// Fichier : content-api.js (à placer dans le dossier routes/)
//
// Dans server.js, ajouter ces 2 lignes :
//   app.use(express.json({ limit: '10mb' }));   // AVANT les routes (remplace express.json() si déjà présent)
//   app.use('/api/content', require('./routes/content-api')(pool));  // pool = ton pool PostgreSQL existant
//
// Sur Render, ajouter la variable d'environnement :
//   CONTENT_ADMIN_KEY = un mot de passe long de ton choix
// ============================================================

const express = require('express');

module.exports = function (pool) {
  const router = express.Router();

  // Vérification gérant (clé secrète dans l'en-tête)
  function requireAdmin(req, res, next) {
    const key = req.headers['x-admin-key'];
    if (!process.env.CONTENT_ADMIN_KEY || key !== process.env.CONTENT_ADMIN_KEY) {
      return res.status(401).json({ error: 'Non autorisé' });
    }
    next();
  }

  // ---------- PUBLIC ----------

  // Tous les textes (sans le base64 des images, trop lourd)
  router.get('/', async (req, res) => {
    try {
      const r = await pool.query(
        "SELECT key, type, CASE WHEN type='text' THEN value ELSE NULL END AS value, (type='image' AND value IS NOT NULL) AS has_image FROM site_content"
      );
      const out = {};
      r.rows.forEach(row => { out[row.key] = { type: row.type, value: row.value, has_image: row.has_image }; });
      res.json(out);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Une image (servie comme vraie image, avec cache)
  router.get('/img/:key', async (req, res) => {
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
  router.get('/admin/list', requireAdmin, async (req, res) => {
    try {
      const r = await pool.query(
        "SELECT key, type, label, CASE WHEN type='text' THEN value ELSE NULL END AS value, (type='image' AND value IS NOT NULL) AS has_image, updated_at FROM site_content ORDER BY key"
      );
      res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Sauvegarder un texte
  router.post('/admin/text', requireAdmin, async (req, res) => {
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

  // Sauvegarder une image (base64, max ~5 Mo)
  router.post('/admin/image', requireAdmin, async (req, res) => {
    const { key, data, mime } = req.body || {};
    if (!key || !data) return res.status(400).json({ error: 'key et data requis' });
    if (data.length > 7_000_000) return res.status(413).json({ error: 'Image trop lourde (max ~5 Mo). Compressez-la.' });
    try {
      await pool.query(
        "INSERT INTO site_content (key, type, value, mime, updated_at) VALUES ($1,'image',$2,$3,NOW()) ON CONFLICT (key) DO UPDATE SET type='image', value=$2, mime=$3, updated_at=NOW()",
        [key, data, mime || 'image/jpeg']
      );
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
};

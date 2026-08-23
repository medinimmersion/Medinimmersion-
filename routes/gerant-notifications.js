/**
 * routes/gerant-notifications.js
 * Gère les paramètres de notifications du gérant (email, WhatsApp)
 */

'use strict';

module.exports = function (pool, opts) {
  const router = require('express').Router();
  const requireGerant = opts.requireGerant;

  /**
   * GET /api/gerant/notifications-settings
   * Récupère les paramètres de notification du gérant
   */
  router.get('/api/gerant/notifications-settings', requireGerant, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT field_key, value FROM cms_content 
        WHERE page_key = 'gerant-settings'
        AND field_key IN ('notif_email', 'notif_whatsapp')
      `);

      const settings = { email: '', whatsapp: '' };

      result.rows.forEach(row => {
        if (row.field_key === 'notif_email') settings.email = row.value;
        if (row.field_key === 'notif_whatsapp') settings.whatsapp = row.value;
      });

      res.json(settings);
    } catch (error) {
      console.error('[gerant-notif/get]', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/gerant/notifications-settings
   * Sauvegarde les paramètres de notification (email et/ou whatsapp)
   */
  router.post('/api/gerant/notifications-settings', requireGerant, async (req, res) => {
    try {
      const { email, whatsapp } = req.body;

      async function upsert(fieldKey, fieldValue) {
        const existing = await pool.query(
          `SELECT id FROM cms_content WHERE page_key = 'gerant-settings' AND field_key = $1`,
          [fieldKey]
        );
        if (existing.rows.length > 0) {
          await pool.query(
            `UPDATE cms_content SET value = $1, updated_at = NOW() WHERE page_key = 'gerant-settings' AND field_key = $2`,
            [fieldValue, fieldKey]
          );
        } else {
          await pool.query(
            `INSERT INTO cms_content (page_key, field_key, field_type, value) VALUES ('gerant-settings', $1, 'text', $2)`,
            [fieldKey, fieldValue]
          );
        }
      }

      if (email !== undefined) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return res.status(400).json({ error: 'Email invalide' });
        }
        await upsert('notif_email', email);
      }

      if (whatsapp !== undefined) {
        if (!/^\+?[0-9]{7,}$/.test(whatsapp.replace(/\s/g, ''))) {
          return res.status(400).json({ error: 'Numéro WhatsApp invalide' });
        }
        await upsert('notif_whatsapp', whatsapp);
      }

      res.json({ success: true, message: 'Paramètres sauvegardés' });
    } catch (error) {
      console.error('[gerant-notif/post]', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};

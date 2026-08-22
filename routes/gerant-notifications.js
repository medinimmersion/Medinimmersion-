/**
 * routes/gerant-notifications.js
 * Gère les paramètres de notifications du gérant (email, WhatsApp)
 */

'use strict';

module.exports = function (pool, opts) {
  const router = require('express').Router();
  const { requireGerant } = opts.middleware;

  /**
   * GET /api/gerant/notifications-settings
   * Récupère les paramètres de notification du gérant
   */
  router.get('/api/gerant/notifications-settings', requireGerant, async (req, res) => {
    try {
      // Stocker dans cms_content avec page_key='gerant-settings'
      const result = await pool.query(`
        SELECT field_key, field_value FROM cms_content 
        WHERE page_key = 'gerant-settings'
        AND field_key IN ('notif_email', 'notif_whatsapp')
      `);

      const settings = {
        email: '',
        whatsapp: ''
      };

      result.rows.forEach(row => {
        if (row.field_key === 'notif_email') settings.email = row.field_value;
        if (row.field_key === 'notif_whatsapp') settings.whatsapp = row.field_value;
      });

      res.json(settings);
    } catch (error) {
      console.error('[gerant-notif/get]', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/gerant/notifications-settings
   * Sauvegarde les paramètres de notification
   */
  router.post('/api/gerant/notifications-settings', requireGerant, async (req, res) => {
    try {
      const { email, whatsapp } = req.body;

      if (email) {
        // Valider email
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return res.status(400).json({ error: 'Email invalide' });
        }

        // Insérer ou mettre à jour
        await pool.query(`
          INSERT INTO cms_content (page_key, field_key, field_value)
          VALUES ('gerant-settings', 'notif_email', $1)
          ON CONFLICT (page_key, field_key) DO UPDATE
          SET field_value = $1
        `, [email]);
      }

      if (whatsapp) {
        // Valider WhatsApp (simple format check)
        if (!/^\+?[0-9]{7,}$/.test(whatsapp.replace(/\s/g, ''))) {
          return res.status(400).json({ error: 'Numéro WhatsApp invalide' });
        }

        await pool.query(`
          INSERT INTO cms_content (page_key, field_key, field_value)
          VALUES ('gerant-settings', 'notif_whatsapp', $1)
          ON CONFLICT (page_key, field_key) DO UPDATE
          SET field_value = $1
        `, [whatsapp]);
      }

      res.json({ success: true, message: 'Paramètres sauvegardés' });
    } catch (error) {
      console.error('[gerant-notif/post]', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};

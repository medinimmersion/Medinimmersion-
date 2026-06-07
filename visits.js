/**
 * routes/visits.js — Page visit tracking + WhatsApp config API.
 * Owns: admin visit stats endpoint, WhatsApp config endpoints.
 * Does NOT own: database queries (delegates to db/visits.js), auth.
 */
const { Router } = require('express');
const { getVisitStats, getWhatsAppConfig, saveWhatsAppConfig, getBanner, saveBanner } = require('../db/visits');

module.exports = function createVisitsRouter(pool, requireAdmin) {
  const router = Router();

  // ── Admin: get visit statistics ──
  router.get('/api/admin/visits/stats', requireAdmin, async (req, res) => {
    try {
      const days = Math.min(parseInt(req.query.days) || 30, 365);
      const stats = await getVisitStats(pool, { days });
      res.json(stats);
    } catch (err) {
      console.error('[visits] stats error:', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── Public: get WhatsApp config for floating button ──
  router.get('/api/whatsapp-config', async (req, res) => {
    try {
      const config = await getWhatsAppConfig(pool);
      res.json({
        number: config.whatsapp_number || '',
        message: config.whatsapp_message || 'Salam, je souhaite en savoir plus sur les cours d\'arabe en immersion chez MedinImmersion'
      });
    } catch (err) {
      // Fallback — never break the public page
      res.json({ number: '213659668685', message: 'Salam, je souhaite en savoir plus sur les cours d\'arabe en immersion chez MedinImmersion' });
    }
  });

  // ── Admin: save WhatsApp config ──
  router.put('/api/admin/whatsapp-config', requireAdmin, async (req, res) => {
    try {
      await saveWhatsAppConfig(pool, req.body);
      res.json({ ok: true });
    } catch (err) {
      console.error('[whatsapp] config save error:', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── Admin: get WhatsApp config for settings form ──
  router.get('/api/admin/whatsapp-config', requireAdmin, async (req, res) => {
    try {
      const config = await getWhatsAppConfig(pool);
      res.json(config);
    } catch (err) {
      console.error('[whatsapp] config get error:', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── Public: get banner config ──
  router.get('/api/banner', async (req, res) => {
    try {
      const banner = await getBanner(pool);
      res.json(banner);
    } catch (err) {
      res.json({ enabled: false, text: '' });
    }
  });

  // ── Admin: get banner config ──
  router.get('/api/admin/banner', requireAdmin, async (req, res) => {
    try {
      const banner = await getBanner(pool);
      res.json(banner);
    } catch (err) {
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── Admin: save banner config ──
  router.put('/api/admin/banner', requireAdmin, async (req, res) => {
    try {
      const { enabled, text } = req.body;
      await saveBanner(pool, { enabled, text });
      res.json({ ok: true });
    } catch (err) {
      console.error('[banner] save error:', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  return router;
};

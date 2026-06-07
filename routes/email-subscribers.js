/**
 * routes/email-subscribers.js — Email subscription management
 * Owns: /api/email/subscribe, /api/email/subscribers/*
 */
'use strict';

module.exports = function (pool, opts) {
  const router = require('express').Router();

  // POST /api/email/subscribe — public email subscription
  router.post('/api/email/subscribe', async (req, res) => {
    try {
      const { email, nom, prenom } = req.body;
      if (!email || !email.trim()) return res.status(400).json({ error: 'Email requis' });

      const result = await pool.query(
        `INSERT INTO email_subscribers (email, nom, prenom, subscribed_at, active)
         VALUES ($1, $2, $3, NOW(), TRUE)
         ON CONFLICT (LOWER(email)) DO UPDATE SET active = TRUE, subscribed_at = NOW()
         RETURNING id, email, active`,
        [email.trim().toLowerCase(), nom || null, prenom || null]
      );
      res.json({ success: true, subscriber: result.rows[0] });
    } catch (err) { console.error('[email/subscribe]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // GET /api/admin/email/subscribers — admin list
  router.get('/api/admin/email/subscribers', opts.requireAdmin, async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT * FROM email_subscribers WHERE active = TRUE ORDER BY subscribed_at DESC LIMIT 200'
      );
      res.json(result.rows);
    } catch (err) { console.error('[email/subscribers]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  return router;
};
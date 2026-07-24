/**
 * routes/tracking.js — Suivi du temps des élèves (site + Kalam).
 * Owns: /api/tracking/ping (élève), /api/admin/tracking/* (gérant)
 * Does NOT own: les requêtes SQL (déléguées à db/tracking.js), l'authentification.
 */
'use strict';

const { touchSession, getTotals, getSessions, closeStale } = require('../db/tracking');

module.exports = function (pool, opts) {
  const router = require('express').Router();
  const { requireAdmin, studentTokens } = opts;

  // Retrouve l'élève à partir des différents en-têtes utilisés sur le site.
  function studentIdFrom(req) {
    const token = req.headers['x-student-token']
      || (req.headers.authorization || '').replace('Bearer ', '')
      || (req.body && req.body.token);
    if (!token || !studentTokens) return null;
    const entry = studentTokens.get(token);
    if (!entry || Date.now() > entry.expires) return null;
    return entry.id;
  }

  // ── Élève : ping régulier envoyé par l'espace élève ──
  router.post('/api/tracking/ping', async (req, res) => {
    try {
      const studentId = studentIdFrom(req);
      if (!studentId) return res.status(401).json({ error: 'Non autorisé' });
      const kind = req.body && req.body.kind === 'kalam' ? 'kalam' : 'site';
      await touchSession(pool, studentId, kind);
      res.json({ ok: true });
    } catch (err) {
      console.error('[tracking] ping:', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── Gérant : tableau récapitulatif, un élève par ligne ──
  router.get('/api/admin/tracking/students', requireAdmin, async (req, res) => {
    try {
      const days = Math.min(parseInt(req.query.days) || 365, 3650);
      await closeStale(pool, null, null); // referme les sessions abandonnées
      const rows = await getTotals(pool, { days });
      res.json(rows);
    } catch (err) {
      console.error('[tracking] totals:', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── Gérant : détail des sessions d'un élève ──
  router.get('/api/admin/tracking/students/:id', requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (!id) return res.status(400).json({ error: 'Identifiant invalide' });
      const limit = Math.min(parseInt(req.query.limit) || 200, 1000);
      const rows = await getSessions(pool, id, { limit });
      res.json(rows);
    } catch (err) {
      console.error('[tracking] sessions:', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  return router;
};

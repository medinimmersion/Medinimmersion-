/**
 * routes/presences.js — Attendance (presences) API endpoints.
 * Owns: CRUD for presences table. Admin + teacher access.
 * Does NOT own: group_attendance (separate module).
 */
'use strict';

const { Router } = require('express');
const presencesDb = require('../db/presences');

module.exports = function presencesRoutes(pool, opts) {
  const router = Router();
  const { requireAdmin, requireTeacherAuth } = opts;

  // ── Admin: full overview ─────────────────────────────────────
  router.get('/api/admin/presences', requireAdmin, async (req, res) => {
    try {
      const overview = await presencesDb.getPresenceOverview();
      const avgPct = await presencesDb.getAverageAttendance();
      // Flag low attendance (<70%)
      const alerts = overview.filter(s => s.total_sessions > 0 && parseFloat(s.attendance_pct) < 70);
      res.json({ overview, avgPct, alerts });
    } catch (err) {
      console.error('[presences/admin]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── Admin: student presences detail ──────────────────────────
  router.get('/api/admin/presences/student/:id', requireAdmin, async (req, res) => {
    try {
      const rows = await presencesDb.getPresencesByStudent(req.params.id);
      res.json(rows);
    } catch (err) {
      console.error('[presences/student]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── Teacher: mark presence for a specific session ─────────────
  router.post('/api/professor/presences/session', requireTeacherAuth, async (req, res) => {
    const { studentId, sessionId, sessionDate, status, notes } = req.body;
    if (!studentId || !sessionDate) {
      return res.status(400).json({ error: 'studentId et sessionDate requis' });
    }
    const validStatuses = ['retard', 'report', 'absent', 'effectue', 'present'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }
    try {
      const record = await presencesDb.markPresence({
        studentId, teacherId: req.teacherId, sessionId: sessionId || null,
        sessionDate, status: status || 'effectue', notes,
        markedBy: `teacher:${req.teacherId}`
      });
      res.json({ success: true, presence: record });
    } catch (err) {
      console.error('[presences/session]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── Teacher: sessions + existing presences for my students ───
  router.get('/api/professor/presences/sessions', requireTeacherAuth, async (req, res) => {
    try {
      const sessions = await presencesDb.getSessionsWithPresences(req.teacherId);
      res.json(sessions);
    } catch (err) {
      console.error('[presences/sessions]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── Teacher: mark presence (legacy) ─────────────────────────
  router.post('/api/professor/presences', requireTeacherAuth, async (req, res) => {
    const { studentId, sessionId, sessionDate, status, notes } = req.body;
    if (!studentId || !sessionDate) {
      return res.status(400).json({ error: 'studentId et sessionDate requis' });
    }
    try {
      const record = await presencesDb.markPresence({
        studentId, teacherId: req.teacherId, sessionId: sessionId || null,
        sessionDate, status: status || 'present', notes,
        markedBy: `teacher:${req.teacherId}`
      });
      res.json({ success: true, presence: record });
    } catch (err) {
      console.error('[presences/mark]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── Teacher: my students' presences ──────────────────────────
  router.get('/api/professor/presences', requireTeacherAuth, async (req, res) => {
    try {
      const rows = await presencesDb.getPresencesByTeacher(req.teacherId);
      res.json(rows);
    } catch (err) {
      console.error('[presences/teacher]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  return router;
};

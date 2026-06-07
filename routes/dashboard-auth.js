/**
 * routes/dashboard-auth.js — Authentication for the 3 separate dashboard login pages.
 * Owns: /api/auth/login-admin, /api/auth/login-professor, /api/auth/login-student,
 *       /api/auth/logout, /api/auth/cross-access (admin impersonation).
 * Does NOT own: registration, password reset, or token generation logic (shared via opts).
 */
'use strict';

const { Router } = require('express');

module.exports = function dashboardAuth(pool, opts) {
  const router = Router();
  const {
    verifyPassword, generateToken, studentTokens, teacherTokens, gerantTokens,
    authLimiter, ADMIN_PASSWORD
  } = opts;

  // ── Admin login (gérant) ─────────────────────────────────────
  router.post('/api/auth/login-admin', authLimiter, async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Identifiant et mot de passe requis' });

    try {
      // Try gérant account first
      const g = await pool.query('SELECT * FROM gerant_accounts WHERE username = $1', [username]);
      if (g.rows.length && verifyPassword(password, g.rows[0].password_hash)) {
        const token = generateToken(gerantTokens, g.rows[0].username, 30);
        return res.json({ success: true, token, username: g.rows[0].username, role: 'gerant' });
      }
      // Fallback: static admin password
      if (password === ADMIN_PASSWORD) {
        const token = generateToken(gerantTokens, username, 30);
        return res.json({ success: true, token, username, role: 'admin' });
      }
      res.status(401).json({ error: 'Identifiants incorrects' });
    } catch (err) {
      console.error('[auth/admin]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── Professor login ──────────────────────────────────────────
  router.post('/api/auth/login-professor', authLimiter, async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Identifiant et mot de passe requis' });

    try {
      const t = await pool.query('SELECT * FROM teachers WHERE username = $1', [username]);
      if (!t.rows.length) return res.status(401).json({ error: 'Professeur non trouvé' });
      const teacher = t.rows[0];
      if (!verifyPassword(password, teacher.password_hash)) {
        return res.status(401).json({ error: 'Mot de passe incorrect' });
      }
      const token = generateToken(teacherTokens, teacher.id, 7);
      return res.json({
        success: true, token,
        teacher: {
          id: teacher.id, nom: teacher.nom, prenom: teacher.prenom,
          email: teacher.email, specialty: teacher.specialty,
          zoom_link: teacher.zoom_link
        }
      });
    } catch (err) {
      console.error('[auth/professor]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── Student login ────────────────────────────────────────────
  router.post('/api/auth/login-student', authLimiter, async (req, res) => {
    const { identifier, password } = req.body;
    if (!identifier || !password) return res.status(400).json({ error: 'Identifiant et mot de passe requis' });

    try {
      const q = identifier.includes('@')
        ? 'SELECT * FROM students WHERE LOWER(email) = LOWER($1)'
        : 'SELECT * FROM students WHERE whatsapp = $1';
      const s = await pool.query(q, [identifier.trim()]);
      if (!s.rows.length) return res.status(401).json({ error: 'Compte non trouvé' });
      const student = s.rows[0];
      if (!student.password_hash || !verifyPassword(password, student.password_hash)) {
        return res.status(401).json({ error: 'Mot de passe incorrect' });
      }
      if (student.validation_status === 'pending') {
        return res.status(403).json({ error: 'Votre inscription est en attente de validation' });
      }
      const token = generateToken(studentTokens, student.id, 7);
      return res.json({
        success: true, token,
        student: {
          id: student.id, nom: student.nom, prenom: student.prenom,
          email: student.email, whatsapp: student.whatsapp
        }
      });
    } catch (err) {
      console.error('[auth/student]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── Logout (any role) ────────────────────────────────────────
  router.post('/api/auth/logout', (req, res) => {
    const gt = req.headers['x-gerant-token'];
    const tt = req.headers['x-teacher-token'];
    const st = req.headers['x-student-token'];
    if (gt) gerantTokens.delete(gt);
    if (tt) teacherTokens.delete(tt);
    if (st) studentTokens.delete(st);
    res.json({ success: true });
  });

  // ── Cross-access: admin can get tokens for other roles ───────
  // WHY: The gérant needs to view professor/student dashboards without re-logging in.
  router.post('/api/auth/cross-access', opts.requireAdmin, async (req, res) => {
    const { targetRole, targetId } = req.body;
    try {
      if (targetRole === 'professor') {
        const t = await pool.query('SELECT id, nom, prenom FROM teachers WHERE id = $1', [targetId]);
        if (!t.rows.length) return res.status(404).json({ error: 'Professeur non trouvé' });
        const token = generateToken(teacherTokens, t.rows[0].id, 1); // 1-day temp token
        return res.json({ token, role: 'professor', target: t.rows[0] });
      }
      if (targetRole === 'student') {
        const s = await pool.query('SELECT id, nom, prenom FROM students WHERE id = $1', [targetId]);
        if (!s.rows.length) return res.status(404).json({ error: 'Élève non trouvé' });
        const token = generateToken(studentTokens, s.rows[0].id, 1);
        return res.json({ token, role: 'student', target: s.rows[0] });
      }
      res.status(400).json({ error: 'Role invalide (professor ou student)' });
    } catch (err) {
      console.error('[cross-access]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  return router;
};

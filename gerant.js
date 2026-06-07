/**
 * routes/gerant.js — Gérant (director) account setup and login
 * Owns: /api/admin/gerant/* endpoints
 * Does NOT own: admin-panel operations (see admin.js)
 */
'use strict';

module.exports = function (pool, opts) {
  const { requireAdmin, requireGerant, hashPassword, verifyPassword, generateToken, gerantTokens, sendEmail, ADMIN_PASSWORD } = opts;
  const router = require('express').Router();

  // GET /api/admin/gerant/setup-status — check if gerant account exists
  router.get('/api/admin/gerant/setup-status', async (req, res) => {
    try {
      const result = await pool.query('SELECT COUNT(*)::int as count FROM gerant_accounts');
      res.json({ exists: result.rows[0].count > 0 });
    } catch (err) { console.error('[gerant/setup-status]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // POST /api/admin/gerant/setup — create first gerant account (no auth required)
  router.post('/api/admin/gerant/setup', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) return res.status(400).json({ error: 'Username et mot de passe requis' });
      if (password.length < 8) return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });

      const existing = await pool.query('SELECT COUNT(*)::int as count FROM gerant_accounts');
      if (existing.rows[0].count > 0) return res.status(403).json({ error: 'Un compte gérant existe déjà. Connectez-vous.' });

      const hash = hashPassword(password);
      const result = await pool.query(
        'INSERT INTO gerant_accounts (username, password_hash) VALUES ($1, $2) RETURNING id, username',
        [username.trim(), hash]
      );

      const token = generateToken(gerantTokens, result.rows[0].id, 30);
      console.log('[gerant] First account created:', username);
      res.json({ success: true, token, username: result.rows[0].username });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Ce username existe déjà.' });
      console.error('[gerant/setup]', err); res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // POST /api/admin/gerant/login — gerant login with username + password
  router.post('/api/admin/gerant/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) return res.status(400).json({ error: 'Username et mot de passe requis' });

      const result = await pool.query('SELECT id, username, password_hash FROM gerant_accounts WHERE username = $1', [username.trim()]);
      if (result.rows.length === 0) return res.status(401).json({ error: 'Identifiants incorrects' });

      const account = result.rows[0];
      if (!verifyPassword(password, account.password_hash)) return res.status(401).json({ error: 'Mot de passe incorrect' });

      const token = generateToken(gerantTokens, account.id, 30);
      console.log('[gerant] Login:', username);
      res.json({ success: true, token, username: account.username });
    } catch (err) { console.error('[gerant/login]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // POST /api/admin/gerant/change-password — change own password
  router.post('/api/admin/gerant/change-password', requireGerant, async (req, res) => {
    try {
      const { current_password, new_password } = req.body;
      if (!current_password || !new_password) return res.status(400).json({ error: 'Champs requis' });
      if (new_password.length < 8) return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });

      const account = await pool.query('SELECT password_hash FROM gerant_accounts WHERE username = $1', [req.gerantUsername]);
      if (!account.rows.length || !verifyPassword(current_password, account.rows[0].password_hash)) {
        return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
      }

      const hash = hashPassword(new_password);
      await pool.query('UPDATE gerant_accounts SET password_hash = $1, updated_at = NOW() WHERE username = $2', [hash, req.gerantUsername]);

      console.log('[gerant] Password changed for:', req.gerantUsername);
      res.json({ success: true, message: 'Mot de passe modifié.' });
    } catch (err) { console.error('[gerant/change-password]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // POST /api/admin/gerant/change-username
  router.post('/api/admin/gerant/change-username', requireGerant, async (req, res) => {
    try {
      const { current_password, new_username } = req.body;
      if (!current_password || !new_username) return res.status(400).json({ error: 'Champs requis' });
      if (new_username.length < 3) return res.status(400).json({ error: 'Le username doit contenir au moins 3 caractères' });

      const account = await pool.query('SELECT password_hash FROM gerant_accounts WHERE username = $1', [req.gerantUsername]);
      if (!account.rows.length || !verifyPassword(current_password, account.rows[0].password_hash)) {
        return res.status(401).json({ error: 'Mot de passe incorrect' });
      }

      await pool.query('UPDATE gerant_accounts SET username = $1, updated_at = NOW() WHERE username = $2', [new_username.trim(), req.gerantUsername]);
      console.log('[gerant] Username changed from', req.gerantUsername, 'to', new_username);
      res.json({ success: true, message: 'Username modifié.', username: new_username.trim() });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Ce username existe déjà.' });
      console.error('[gerant/change-username]', err); res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  return router;
};
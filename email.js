/**
 * routes/email.js — Admin email inbox proxy for contact.medinimmersion@gmail.com
 * Owns: inbox listing, thread reading, email sending via Polsia Company Email API.
 * Does NOT own: auth logic (uses requireAdmin from server.js), email storage (Polsia-managed).
 */
const { Router } = require('express');

const POLSIA_EMAIL_BASE = 'https://polsia.com/api/company-email';

// Shared fetch helper — calls Polsia Company Email API with Bearer auth
async function polsiaEmailFetch(path, options = {}) {
  const apiKey = process.env.POLSIA_API_KEY;
  if (!apiKey) throw new Error('POLSIA_API_KEY not configured');

  // Use native fetch (Node 18+) — no form-data needed for JSON calls
  const res = await fetch(`${POLSIA_EMAIL_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok) {
    const err = new Error(`Polsia Email API error ${res.status}`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

module.exports = function createEmailRouter(pool, requireAdmin) {
  const router = Router();

  // ── GET /api/admin/email/inbox — List inbox emails ──
  router.get('/api/admin/email/inbox', requireAdmin, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 50, 100);
      const offset = parseInt(req.query.offset) || 0;
      const data = await polsiaEmailFetch(`/inbox?limit=${limit}&offset=${offset}`);
      res.json(data);
    } catch (err) {
      console.error('[email] inbox error:', err.message, err.body || '');
      res.status(err.status || 500).json({ error: err.message, detail: err.body });
    }
  });

  // ── GET /api/admin/email/unread — Unread count for badge ──
  router.get('/api/admin/email/unread', requireAdmin, async (req, res) => {
    try {
      const data = await polsiaEmailFetch('/inbox?limit=100&offset=0');
      // Count emails where read is false or unread field exists
      const emails = data.emails || data.messages || data.items || [];
      const unread = emails.filter(e => e.read === false || e.is_read === false || e.unread === true).length;
      res.json({ unread });
    } catch (err) {
      console.error('[email] unread count error:', err.message);
      res.json({ unread: 0 }); // Never break the badge
    }
  });

  // ── GET /api/admin/email/thread/:id — Get full thread ──
  router.get('/api/admin/email/thread/:id', requireAdmin, async (req, res) => {
    try {
      const data = await polsiaEmailFetch(`/thread/${encodeURIComponent(req.params.id)}`);
      res.json(data);
    } catch (err) {
      console.error('[email] thread error:', err.message, err.body || '');
      res.status(err.status || 500).json({ error: err.message, detail: err.body });
    }
  });

  // ── POST /api/admin/email/send — Send or reply to an email ──
  router.post('/api/admin/email/send', requireAdmin, async (req, res) => {
    try {
      const { to, subject, body, thread_id, reply_to_message_id } = req.body;
      if (!to || !subject || !body) {
        return res.status(400).json({ error: 'Champs requis: to, subject, body' });
      }
      const payload = { to, subject, body };
      if (thread_id) payload.thread_id = thread_id;
      if (reply_to_message_id) payload.reply_to_message_id = reply_to_message_id;

      const data = await polsiaEmailFetch('/send', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      res.json(data);
    } catch (err) {
      console.error('[email] send error:', err.message, err.body || '');
      res.status(err.status || 500).json({ error: err.message, detail: err.body });
    }
  });

  // ── POST /api/admin/email/mark-read/:id — Mark email as read ──
  router.post('/api/admin/email/mark-read/:id', requireAdmin, async (req, res) => {
    try {
      const data = await polsiaEmailFetch(`/mark-read/${encodeURIComponent(req.params.id)}`, {
        method: 'POST',
        body: JSON.stringify({})
      });
      res.json(data);
    } catch (err) {
      console.error('[email] mark-read error:', err.message);
      res.json({ ok: true }); // Non-critical, don't fail
    }
  });

  return router;
};

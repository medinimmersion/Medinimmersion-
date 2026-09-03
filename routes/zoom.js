/**
 * routes/zoom.js — Zoom session management
 * Owns: /api/zoom/*
 */
'use strict';

const webpush = require('web-push');

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:contact.medinimmersion@gmail.com';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else {
  console.error('[zoom] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY absentes — notifications push désactivées');
}

module.exports = function (pool, opts) {
  const { requireTeacherAuth, requireStudentAuth, requireAdmin, requireGerant } = opts;
  const router = require('express').Router();

  // ── Auto-init: table des abonnements push ───────────────────
  (async () => {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS push_subscriptions (
          id SERIAL PRIMARY KEY,
          student_id INTEGER NOT NULL,
          endpoint TEXT NOT NULL UNIQUE,
          p256dh TEXT NOT NULL,
          auth TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
      `);
      await pool.query('CREATE INDEX IF NOT EXISTS idx_push_subs_student ON push_subscriptions(student_id)');
    } catch (err) { console.error('[zoom] init push_subscriptions:', err.message); }
  })();

  // ── Envoie une notification push à un ou plusieurs élèves ────
  // Échoue silencieusement (ne bloque jamais le flux d'appel) et
  // supprime les abonnements devenus invalides (410/404 côté navigateur).
  async function notifyStudents(studentIds, payload) {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;
    if (!Array.isArray(studentIds) || !studentIds.length) return;
    try {
      const subs = await pool.query(
        'SELECT id, student_id, endpoint, p256dh, auth FROM push_subscriptions WHERE student_id = ANY($1::int[])',
        [studentIds]
      );
      const body = JSON.stringify(payload);
      await Promise.all(subs.rows.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body
          );
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [s.id]).catch(() => {});
          } else {
            console.error('[zoom] push send error:', err.statusCode || err.message);
          }
        }
      }));
    } catch (err) { console.error('[zoom] notifyStudents:', err.message); }
  }

  // GET /api/vapid-public-key — clé publique nécessaire côté navigateur pour s'abonner
  router.get('/api/vapid-public-key', (req, res) => {
    res.json({ publicKey: VAPID_PUBLIC_KEY || null });
  });

  // POST /api/student/push-subscribe — enregistre/actualise l'abonnement push de l'élève
  router.post('/api/student/push-subscribe', requireStudentAuth, async (req, res) => {
    try {
      const sub = req.body && req.body.subscription;
      if (!sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
        return res.status(400).json({ error: 'Abonnement invalide' });
      }
      await pool.query(
        `INSERT INTO push_subscriptions (student_id, endpoint, p256dh, auth)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (endpoint) DO UPDATE SET student_id = EXCLUDED.student_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
        [req.studentId, sub.endpoint, sub.keys.p256dh, sub.keys.auth]
      );
      res.json({ success: true });
    } catch (err) { console.error('[zoom/push-subscribe]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // POST /api/student/push-unsubscribe — retire l'abonnement (ex : élève désactive les notifs)
  router.post('/api/student/push-unsubscribe', requireStudentAuth, async (req, res) => {
    try {
      const endpoint = req.body && req.body.endpoint;
      if (!endpoint) return res.status(400).json({ error: 'endpoint requis' });
      await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1 AND student_id = $2', [endpoint, req.studentId]);
      res.json({ success: true });
    } catch (err) { console.error('[zoom/push-unsubscribe]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // GET /api/student/teacher-zoom — student gets teacher's zoom link
  router.get('/api/student/teacher-zoom', requireStudentAuth, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT t.zoom_link, t.nom, t.prenom
        FROM teacher_student_assignments tsa
        JOIN teachers t ON t.id = tsa.teacher_id
        WHERE tsa.student_id = $1
        LIMIT 1
      `, [req.studentId]);
      res.json({ zoom_link: result.rows[0]?.zoom_link || null, teacher_name: result.rows[0] ? `${result.rows[0].prenom} ${result.rows[0].nom}` : null });
    } catch (err) { console.error('[zoom/teacher]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // GET /api/admin/teacher/:id/zoom-link
  router.get('/api/admin/teacher/:id/zoom-link', requireAdmin, async (req, res) => {
    try {
      const result = await pool.query('SELECT zoom_link FROM teachers WHERE id = $1', [req.params.id]);
      res.json({ zoom_link: result.rows[0]?.zoom_link || null });
    } catch (err) { console.error('[admin/zoom-link]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // ── Professor: start Zoom call to a specific student ────────
  router.post('/api/professor/zoom-call/start', requireTeacherAuth, async (req, res) => {
    const { studentId, zoomUrl } = req.body;
    if (!studentId) return res.status(400).json({ error: 'studentId requis' });
    try {
      // End any existing active calls for this teacher first
      await pool.query(
        `UPDATE zoom_active_calls SET status = 'ended', ended_at = NOW()
         WHERE teacher_id = $1 AND status = 'active'`,
        [req.teacherId]
      );
      // Start new call
      const r = await pool.query(
        `INSERT INTO zoom_active_calls (teacher_id, student_id, zoom_url)
         VALUES ($1, $2, $3) RETURNING *`,
        [req.teacherId, studentId, zoomUrl || null]
      );
      const t = await pool.query('SELECT nom, prenom FROM teachers WHERE id = $1', [req.teacherId]);
      const teacherName = t.rows[0] ? `${t.rows[0].prenom} ${t.rows[0].nom}`.trim() : 'Votre professeur';
      notifyStudents([studentId], { title: 'Appel Zoom', body: `${teacherName} vous appelle en visio.`, url: '/espace-eleve' });
      res.json({ success: true, call: r.rows[0] });
    } catch (err) { console.error('[zoom/start]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // ── Professor: start Zoom call to a GROUP of students ───────
  router.post('/api/professor/zoom-call/start-group', requireTeacherAuth, async (req, res) => {
    const { studentIds, zoomUrl } = req.body;
    if (!Array.isArray(studentIds) || !studentIds.length) return res.status(400).json({ error: 'studentIds requis' });
    try {
      await pool.query(
        `UPDATE zoom_active_calls SET status = 'ended', ended_at = NOW()
         WHERE teacher_id = $1 AND status = 'active'`,
        [req.teacherId]
      );
      const calls = [];
      for (const sid of studentIds.slice(0, 50)) {
        const r = await pool.query(
          `INSERT INTO zoom_active_calls (teacher_id, student_id, zoom_url)
           VALUES ($1, $2, $3) RETURNING *`,
          [req.teacherId, sid, zoomUrl || null]
        );
        calls.push(r.rows[0]);
      }
      const t = await pool.query('SELECT nom, prenom FROM teachers WHERE id = $1', [req.teacherId]);
      const teacherName = t.rows[0] ? `${t.rows[0].prenom} ${t.rows[0].nom}`.trim() : 'Votre professeur';
      notifyStudents(studentIds.slice(0, 50), { title: 'Appel Zoom', body: `${teacherName} vous appelle en visio.`, url: '/espace-eleve' });
      res.json({ success: true, count: calls.length });
    } catch (err) { console.error('[zoom/start-group]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // ── Professor: end current Zoom call ────────────────────────
  router.post('/api/professor/zoom-call/end', requireTeacherAuth, async (req, res) => {
    try {
      const r = await pool.query(
        `UPDATE zoom_active_calls SET status = 'ended', ended_at = NOW()
         WHERE teacher_id = $1 AND status = 'active' RETURNING *`,
        [req.teacherId]
      );
      res.json({ success: true, ended: r.rows.length });
    } catch (err) { console.error('[zoom/end]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // ── Student: check for active call addressed to them ────────
  // Un appel n'est considéré "actif" que s'il a moins de 10 minutes,
  // pour éviter qu'un appel jamais clôturé par le professeur ne réapparaisse indéfiniment.
  router.get('/api/student/active-call', requireStudentAuth, async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT zac.*, t.nom AS teacher_nom, t.prenom AS teacher_prenom, t.zoom_link
         FROM zoom_active_calls zac
         JOIN teachers t ON t.id = zac.teacher_id
         WHERE zac.student_id = $1 AND zac.status = 'active'
           AND zac.created_at > NOW() - INTERVAL '10 minutes'
         ORDER BY zac.created_at DESC LIMIT 1`,
        [req.studentId]
      );
      res.json({ active: r.rows[0] || null });
    } catch (err) { console.error('[zoom/active]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // ── Student: mark a call as answered so it stops ringing on other devices/reloads ──
  router.post('/api/student/active-call/:id/answer', requireStudentAuth, async (req, res) => {
    try {
      await pool.query(
        `UPDATE zoom_active_calls SET status = 'ended', ended_at = NOW()
         WHERE id = $1 AND student_id = $2 AND status = 'active'`,
        [req.params.id, req.studentId]
      );
      res.json({ success: true });
    } catch (err) { console.error('[zoom/answer]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  return router;
};

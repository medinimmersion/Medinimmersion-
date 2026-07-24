/**
 * db/tracking.js — Suivi du temps passé par les élèves (site + Kalam).
 * Owns: table student_time_sessions, requêtes d'agrégation.
 * Does NOT own: routes (voir routes/tracking.js), auth.
 */
'use strict';

// Au-delà de ce silence, on considère que l'élève est parti : nouvelle session.
const GAP_MINUTES = 5;

let ensured = null;

// Crée la table au premier appel (idempotent, une seule fois par process).
async function ensureTable(pool) {
  if (ensured) return ensured;
  ensured = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS student_time_sessions (
        id               SERIAL PRIMARY KEY,
        student_id       INTEGER NOT NULL,
        kind             TEXT NOT NULL DEFAULT 'site',
        started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ended_at         TIMESTAMPTZ,
        duration_seconds INTEGER NOT NULL DEFAULT 0
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_sts_student ON student_time_sessions (student_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_sts_kind ON student_time_sessions (kind)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_sts_started ON student_time_sessions (started_at DESC)`);
  })();
  return ensured;
}

// Ferme les sessions restées ouvertes (onglet fermé brutalement, coupure réseau).
async function closeStale(pool, studentId, kind) {
  await ensureTable(pool);
  await pool.query(`
    UPDATE student_time_sessions
       SET ended_at = last_seen_at,
           duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (last_seen_at - started_at))::int)
     WHERE ended_at IS NULL
       AND ($1::int IS NULL OR student_id = $1)
       AND ($2::text IS NULL OR kind = $2)
       AND last_seen_at < NOW() - INTERVAL '${GAP_MINUTES} minutes'
  `, [studentId || null, kind || null]);
}

// Ping du navigateur : prolonge la session en cours, ou en ouvre une nouvelle.
async function touchSession(pool, studentId, kind = 'site') {
  await ensureTable(pool);
  const open = await pool.query(`
    SELECT id FROM student_time_sessions
     WHERE student_id = $1 AND kind = $2 AND ended_at IS NULL
       AND last_seen_at > NOW() - INTERVAL '${GAP_MINUTES} minutes'
     ORDER BY last_seen_at DESC LIMIT 1
  `, [studentId, kind]);

  if (open.rows.length) {
    await pool.query(`
      UPDATE student_time_sessions
         SET last_seen_at = NOW(),
             duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (NOW() - started_at))::int)
       WHERE id = $1
    `, [open.rows[0].id]);
    return open.rows[0].id;
  }

  await closeStale(pool, studentId, kind);
  const ins = await pool.query(
    `INSERT INTO student_time_sessions (student_id, kind) VALUES ($1, $2) RETURNING id`,
    [studentId, kind]
  );
  return ins.rows[0].id;
}

// Ouvre une session explicite (Kalam : connexion WebSocket).
async function startSession(pool, studentId, kind = 'kalam') {
  await ensureTable(pool);
  const r = await pool.query(
    `INSERT INTO student_time_sessions (student_id, kind) VALUES ($1, $2) RETURNING id`,
    [studentId, kind]
  );
  return r.rows[0].id;
}

// Ferme une session explicite (Kalam : fermeture du WebSocket).
async function endSession(pool, sessionId) {
  if (!sessionId) return;
  await pool.query(`
    UPDATE student_time_sessions
       SET ended_at = NOW(),
           last_seen_at = NOW(),
           duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (NOW() - started_at))::int)
     WHERE id = $1 AND ended_at IS NULL
  `, [sessionId]);
}

// Tableau récapitulatif : un élève par ligne, temps site + temps Kalam.
async function getTotals(pool, { days = 365 } = {}) {
  await ensureTable(pool);
  const r = await pool.query(`
    SELECT s.id,
           s.prenom,
           s.nom,
           s.kounia,
           s.email,
           COALESCE(SUM(t.duration_seconds) FILTER (WHERE t.kind = 'site'), 0)::int  AS site_seconds,
           COALESCE(SUM(t.duration_seconds) FILTER (WHERE t.kind = 'kalam'), 0)::int AS kalam_seconds,
           COUNT(t.id) FILTER (WHERE t.kind = 'site')::int  AS site_sessions,
           COUNT(t.id) FILTER (WHERE t.kind = 'kalam')::int AS kalam_sessions,
           MAX(t.last_seen_at) AS last_seen_at
      FROM students s
      LEFT JOIN student_time_sessions t
        ON t.student_id = s.id
       AND t.started_at > NOW() - ($1 || ' days')::interval
     GROUP BY s.id, s.prenom, s.nom, s.kounia, s.email
     ORDER BY COALESCE(SUM(t.duration_seconds), 0) DESC, s.nom, s.prenom
  `, [String(days)]);
  return r.rows;
}

// Détail des sessions d'un élève, de la plus récente à la plus ancienne.
async function getSessions(pool, studentId, { limit = 200 } = {}) {
  await ensureTable(pool);
  const r = await pool.query(`
    SELECT id, kind, started_at, ended_at, last_seen_at, duration_seconds
      FROM student_time_sessions
     WHERE student_id = $1
     ORDER BY started_at DESC
     LIMIT $2
  `, [studentId, limit]);
  return r.rows;
}

module.exports = { ensureTable, closeStale, touchSession, startSession, endSession, getTotals, getSessions };

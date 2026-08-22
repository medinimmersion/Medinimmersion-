'use strict';

require('dotenv').config();

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const { Pool } = require('pg');
const fetch = require('node-fetch');
const FormDataLib = require('form-data');

const app = express();
app.set('trust proxy', 1); // Required for Render/reverse proxy
const PORT = process.env.PORT || 3000;

// ─── DATABASE ────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => console.error('[pool] Unexpected error:', err));

// ─── AUTO-INIT: cree la table sessions si absente ──────────────
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        token VARCHAR NOT NULL UNIQUE,
        type VARCHAR NOT NULL,
        user_id VARCHAR NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP NOT NULL
      );
    `);
    // Rattrapage : la premiere version creait user_id en INTEGER, or certains
    // identifiants sont du texte ('gerant-master', un nom d'utilisateur...).
    // L'INSERT echouait alors silencieusement et la connexion etait refusee.
    try {
      await pool.query('ALTER TABLE sessions ALTER COLUMN user_id TYPE VARCHAR USING user_id::VARCHAR');
    } catch (e) { /* deja en VARCHAR : rien a faire */ }
    await pool.query('CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)');
    console.log('[init] table sessions prete');
  } catch (err) {
    console.error('[init] erreur table sessions:', err.message);
  }
})();

// ─── MIDDLEWARE ──────────────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));


// ─── BLOCAGE DES FICHIERS SENSIBLES ──────────────────────────
// express.static sert __dirname : sans ce filtre, tout le dépôt (code source,
// dumps SQL, config) serait téléchargeable publiquement.
const BLOCKED_EXT = /\.(js|json|sql|dump|db|env|md|lock|yml|yaml)$/i;
const ALLOWED_FILES = new Set([
  '/tracking-client.js', '/content-loader.js', '/kalam-references.js',
]);
const BLOCKED_DIRS = /^\/(routes|db|mobile|node_modules|docs|\.git)\//i;
app.use((req, res, next) => {
  const p = decodeURIComponent(req.path);
  if (p.startsWith('/api/')) return next();
  if (ALLOWED_FILES.has(p)) return next();
  if (BLOCKED_DIRS.test(p) || BLOCKED_EXT.test(p) || p.includes('..')) {
    return res.status(404).json({ error: 'Not found' });
  }
  next();
});

// Static files — serve from root directory
const fs = require('fs');
var publicDir;
if (fs.existsSync(path.join(__dirname, 'public'))) {
  publicDir = path.join(__dirname, 'public');
} else {
  publicDir = __dirname;
}
// Les pages HTML ne doivent jamais rester en cache navigateur : sinon un correctif déployé
// côté serveur peut sembler ne "jamais s'appliquer" alors qu'il est bien en ligne.
const staticOpts = {
  maxAge: '1h',
  etag: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
  }
};
// ─── MAINTENANCE ─────────────────────────────────────────────
// Deux interrupteurs independants stockes dans cms_content :
//   maintenance_mode        -> tout le site public
//   maintenance_mode_kalam  -> uniquement Kalam
// Le cache de 10 s evite une requete SQL a chaque visite.
let _mCache = { site: false, kalam: false, msgSite: '', msgKalam: '', untilSite: '', untilKalam: '', at: 0 };
async function getMaintenanceFlags() {
  if (Date.now() - _mCache.at < 10000) return _mCache;
  try {
    const r = await pool.query(
      "SELECT field_key, value FROM cms_content WHERE page_key='global' AND field_key IN ('maintenance_mode','maintenance_mode_kalam','maintenance_message','maintenance_message_kalam','maintenance_until','maintenance_until_kalam')");
    const raw = k => { const row = r.rows.find(x => x.field_key === k); return row ? (row.value || '') : ''; };
    _mCache = {
      site: raw('maintenance_mode') === 'true',
      kalam: raw('maintenance_mode_kalam') === 'true',
      msgSite: raw('maintenance_message'),
      msgKalam: raw('maintenance_message_kalam'),
      untilSite: raw('maintenance_until'),
      untilKalam: raw('maintenance_until_kalam'),
      at: Date.now()
    };
  } catch (err) {
    console.error('[maintenance] lecture impossible:', err.message);
    _mCache = { site: false, kalam: false, msgSite: '', msgKalam: '', untilSite: '', untilKalam: '', at: Date.now() };
  }
  return _mCache;
}
function invalidateMaintenanceCache() { _mCache.at = 0; }

// Chemins TOUJOURS accessibles, meme site ferme : sans eux le gerant
// ne pourrait plus rouvrir son propre site.
const M_ALLOW = [
  '/admin-gerant', '/espace-professeur', '/reset-password',
  '/maintenance', '/api/', '/images/', '/favicon',
  '/tracking-client.js', '/content-loader.js', '/kalam-references.js'
];
const M_KALAM = /^\/(kalam|kalam-live|kalam-ai|kalam-test)(\.html)?$/i;

// Rend maintenance.html en y injectant le message ecrit par le gerant.
// Le texte est echappe : un message contenant des chevrons ne peut pas casser la page.
let _mHtml = null;
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
// Texte affiche quand le gerant n'a rien ecrit.
const MAINT_DEFAULT = [
  "Médin'Immersion est actuellement en maintenance. Nous travaillons à améliorer votre expérience d'apprentissage.",
  "Votre dévouement à l'apprentissage du Coran et de la Sunna nous inspire. Nous serons de retour très bientôt.",
  "Qu'Allah bénisse vos efforts et illumine votre chemin. 📚 ✨"
].join('\n\n');

// Construit le bloc de texte : paragraphes separes par une ligne vide.
function maintenanceText(message) {
  const txt = (message || '').trim() || MAINT_DEFAULT;
  return escapeHtml(txt)
    .split(/\n\s*\n/)
    .map((par, i) => '<p' + (i ? ' style="margin-top:1rem;"' : '') + '>'
      + par.replace(/\n/g, '<br>') + '</p>')
    .join('');
}

// Compte a rebours : rendu uniquement si la date de retour est future.
function maintenanceTimer(until) {
  if (!until) return '';
  const ts = Date.parse(until);
  if (!ts || ts <= Date.now()) return '';
  return '<div class="timer-section">'
    + '<div class="timer-label" id="timerLabel">Retour prévu dans</div>'
    + '<div class="timer" id="countdown" data-until="' + ts + '">--:--:--</div>'
    + '<div class="timer-unit">Heures : Minutes : Secondes</div>'
    + '</div>';
}

function sendMaintenance(res, message, until) {
  const file = path.join(__dirname, 'maintenance.html');
  try {
    if (_mHtml === null) _mHtml = fs.readFileSync(file, 'utf8');
  } catch {
    return res.status(503).send('Site en maintenance.');
  }
  res.status(503)
     .set('Cache-Control', 'no-store')
     .send(_mHtml
       .replace('<!--CUSTOM_MESSAGE-->', maintenanceText(message))
       .replace('<!--TIMER-->', maintenanceTimer(until)));
}

app.use(async (req, res, next) => {
  const p = req.path;
  if (M_ALLOW.some(a => p.startsWith(a))) return next();
  let f;
  try { f = await getMaintenanceFlags(); } catch { return next(); }

  if (f.kalam && M_KALAM.test(p)) return sendMaintenance(res, f.msgKalam, f.untilKalam);
  if (f.site) return sendMaintenance(res, f.msgSite, f.untilSite);
  next();
});

app.use(express.static(publicDir, staticOpts));
app.use(express.static(__dirname, staticOpts));

// ─── RATE LIMITERS ───────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Trop de requêtes.' },
});

app.use('/api/', apiLimiter);

// ─── TOKEN STORES ────────────────────────────────────────────
// ─── SESSION STORE (SQL instead of Map) ──────────────
// generateToken() : crée un token dans la table sessions
// getFromToken() : récupère l'user_id et nettoie les sessions expirées

// ─── HELPERS ─────────────────────────────────────────────────
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  // Try common pbkdf2 iteration counts for compatibility with Polsia hashes
  for (const iters of [10000, 100000, 1000, 310000]) {
    const verify = crypto.pbkdf2Sync(password, salt, iters, 64, 'sha512').toString('hex');
    if (verify === hash) return true;
  }
  return false;
}

async function generateToken(type, id, days = 7) {
  const token = crypto.randomBytes(64).toString('hex');
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  try {
    const result = await pool.query(
      'INSERT INTO sessions (token, type, user_id, expires_at) VALUES ($1, $2, $3, $4) RETURNING token',
      [token, type, id, expiresAt]);
    return token;
  } catch (err) {
    console.error('[generateToken] Error:', err.message);
    return null;
  }
}

async function getFromToken(type, token) {
  if (!token) return null;
  try {
    // Nettoyer les anciennes sessions
    await pool.query('DELETE FROM sessions WHERE expires_at < NOW()', []);
    // Récupérer la session valide
    const result = await pool.query(
      'SELECT user_id FROM sessions WHERE token = $1 AND type = $2 AND expires_at > NOW()',
      [token, type]);
    if (!result.rows.length) return null;
    const v = result.rows[0].user_id;
    return /^\d+$/.test(String(v)) ? Number(v) : v;
  } catch (err) {
    console.error('[getFromToken] Error:', err.message);
    return null;
  }
}

// ─── AUTH MIDDLEWARE ─────────────────────────────────────────
async function requireStudentAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Non autorisé' });
  const token = auth.slice(7);
  const studentId = await getFromToken('student', token);
  if (!studentId) return res.status(401).json({ error: 'Session expirée' });
  req.studentId = studentId;
  next();
}

async function requireTeacherAuth(req, res, next) {
  const token = req.headers['x-teacher-token'] || (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token requis' });
  const teacherId = await getFromToken('teacher', token);
  if (!teacherId) return res.status(401).json({ error: 'Session expirée' });
  req.teacherId = teacherId;
  next();
}

async function requireAdmin(req, res, next) {
  const token = req.headers['x-gerant-token'] || req.headers['x-admin-token'] ||
    (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token admin requis' });
  const id = await getFromToken('gerant', token);
  if (!id) return res.status(401).json({ error: 'Session admin expirée' });
  req.gerantId = id;
  next();
}

function requireGerant(req, res, next) { return requireAdmin(req, res, next); }

// ─── EMAIL ───────────────────────────────────────────────────
async function sendEmail({ to, subject, html, text }) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('[email] Not configured, skipping:', subject);
    return;
  }
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
    await transporter.sendMail({
      from: `"MedinImmersion" <${process.env.EMAIL_USER}>`,
      to, subject, html, text,
    });
    console.log('[email] Sent to:', to);
  } catch (err) {
    console.error('[email] Error:', err.message);
  }
}

async function sendWhatsApp(phone, message) {
  console.log('[whatsapp] Would send to', phone, ':', message.substring(0, 50));
}

// ─── R2 UPLOAD ───────────────────────────────────────────────
async function uploadToR2WithRetry(buffer, filename, mimetype, retries = 3) {
  const baseUrl = process.env.POLSIA_R2_BASE_URL || process.env.R2_BASE_URL;
  const apiKey = process.env.POLSIA_API_KEY || process.env.R2_API_KEY;
  if (!baseUrl || !apiKey) {
    console.log('[r2] Not configured, skipping upload');
    return null;
  }
  for (let i = 0; i < retries; i++) {
    try {
      const form = new FormDataLib();
      form.append('file', buffer, { filename, contentType: mimetype });
      const res = await fetch(`${baseUrl}/upload`, {
        method: 'POST',
        headers: { ...form.getHeaders(), 'x-api-key': apiKey },
        body: form,
      });
      if (!res.ok) throw new Error(`R2 error: ${res.status}`);
      const data = await res.json();
      return data.url || data.key;
    } catch (err) {
      console.error(`[r2] Attempt ${i + 1} failed:`, err.message);
      if (i === retries - 1) return null;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

// ─── PRICING ─────────────────────────────────────────────────
const PRICING = {
  coran:  { 4:[27,24,20], 8:[52,46,40], 16:[100,88,79], 20:[120,100,90], 40:[220,180,130] },
  arabe:  { 4:[32,28,23], 8:[62,52,44], 16:[120,84,84], 20:[148,120,100], 40:[250,180,160] },
  double_immersion: { 4:[56,49,43], 8:[108,93,83], 16:[209,163,150], 20:[255,209,190], 40:[446,361,275] },
};
const ENROLLMENT_FEE = 5;
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'contact.medinimmersion@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || process.env.GERANT_PASSWORD;
if (!ADMIN_PASSWORD) console.error('[config] ADMIN_PASSWORD absent des variables d\'environnement — l\'espace gérant est inaccessible.');

// ─── MAINTENANCE MODE ────────────────────────────────────────
async function isMaintenanceMode() {
  try {
    const r = await pool.query(`SELECT value FROM cms_content WHERE page_key='global' AND field_key='maintenance_mode'`);
    return r.rows.length > 0 && r.rows[0].value === 'true';
  } catch { return false; }
}

// ─── OPTS (shared context for all routes) ───────────────────
const opts = {
  pool,
  hashPassword,
  verifyPassword,
  generateToken,
  requireStudentAuth,
  requireTeacherAuth,
  requireAdmin,
  requireGerant,
  authLimiter,
  sendEmail,
  sendWhatsApp,
  uploadToR2WithRetry,
  FormDataLib,
  PRICING,
  ENROLLMENT_FEE,
  OWNER_EMAIL,
  ADMIN_PASSWORD,
  isMaintenanceMode,
  getMaintenanceFlags,
  invalidateMaintenanceCache,
};

// ─── LOAD ROUTES ─────────────────────────────────────────────
const routeFiles = [
  'members',
  'students',
  'teacher',
  'admin',
  'gerant',
  'bookings',
  'sessions',
  'schedules',
  'progression',
  'library',
  'pdfs',
  'chatbot',
  'notifications',
  'presences',
  'visits',
  'tracking',
  'zoom',
  'cms',
  'email',
  'email-subscribers',
  'dashboard-auth',
  'admin-dashboard',
  'group-sessions',
  'groups-teacher',
  'group-attendance',
  'teacher-permissions',
  'misc',
  'content-api',
  'kalam-live-token',
  'kalam-books',
  'kalam-signup',
  'boutique',
  'notifications-integration',
];

for (const name of routeFiles) {
  try {
    const routeModule = require(`./routes/${name}`);
    let router;
    // Handle different export signatures
    if (name === 'teacher-permissions') {
      router = routeModule(pool, opts.requireAdmin, opts.requireTeacherAuth);
    } else if (name === 'email' || name === 'visits') {
      router = routeModule(pool, opts.requireAdmin);
    } else if (name === 'group-sessions') {
      router = routeModule(pool, opts.requireAdmin);
    } else if (name === 'groups-teacher') {
      router = routeModule(pool, opts.requireTeacherAuth);
    } else if (name === 'library') {
      router = routeModule(pool, opts.requireAdmin, opts.requireTeacherAuth, opts.requireStudentAuth, opts.uploadToR2WithRetry, opts.FormDataLib);
    } else if (name === 'group-attendance') {
      router = routeModule(pool, opts.requireTeacherAuth, opts.requireAdmin);
    } else {
      router = routeModule(pool, opts);
    }
    app.use(router);
    console.log(`[routes] ✓ ${name}`);
  } catch (err) {
    console.error(`[routes] ✗ ${name}:`, err.message);
  }
}


// ─── HEALTH CHECK ────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', time: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'disconnected', error: err.message });
  }
});

// ─── SPA FALLBACK ────────────────────────────────────────────
// Adresses avec barre oblique → page correspondante avec tiret
// (/admin/gerant → /admin-gerant, /espace/eleve → /espace-eleve, etc.)
app.get('/:a/:b', (req, res, next) => {
  const page = req.params.a + '-' + req.params.b;
  const knownPages = [
    'nos-cours', 'tarifs', 'qui-sommes-nous', 'reglement',
    'inscription', 'espace-eleve', 'espace-professeur',
    'admin-gerant', 'reset-password', 'merci', 'kalam', 'kalam-test', 'kalam-live', 'kalam-ai',
  ];
  if (knownPages.includes(page)) return res.redirect('/' + page);
  next();
});
// L'ancien Kalam est remplacé par Kalam Live : /kalam sert directement la page temps réel
app.get(['/kalam', '/kalam.html'], (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'kalam-live.html'));
});

// Serve HTML files for known routes
const htmlPages = [
  'nos-cours', 'tarifs', 'qui-sommes-nous', 'reglement',
  'inscription', 'espace-eleve', 'espace-professeur',
  'admin-gerant', 'reset-password', 'merci', 'kalam', 'kalam-test', 'kalam-live', 'kalam-ai', 'boutique',
  'blog', 'blog-apprendre-arabe-immersion', 'blog-choisir-professeur-coran',
  'cgv-cgu', 'panier',
];

htmlPages.forEach(page => {
  app.get(`/${page}`, (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(__dirname, `${page}.html`), (err) => { if (err) res.sendFile(path.join(publicDir, `${page}.html`), (e) => { if (e) res.status(404).json({error: 'Page non trouvée'}); }); });
  });
  app.get(`/${page}.html`, (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(__dirname, `${page}.html`), (err) => { if (err) res.sendFile(path.join(publicDir, `${page}.html`), (e) => { if (e) res.status(404).json({error: 'Page non trouvée'}); }); });
  });
});

// Root → index.html
app.get('/', (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.sendFile(path.join(publicDir, 'index.html'));
});

// 404 fallback
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Route non trouvée' });
  }
  res.status(404).sendFile(path.join(publicDir, 'index.html'));
});

// ─── ERROR HANDLER ───────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[error]', err);
  res.status(500).json({ error: 'Erreur serveur interne' });
});

// ─── START ───────────────────────────────────────────────────
const http = require('http');
const httpServer = http.createServer(app);

// Proxy WebSocket temps réel pour Kalam (Gemini Live) — voix en streaming
try {
  require('./kalam-live-ws')(httpServer, pool, opts);
} catch (e) {
  console.error('[kalam-live] non chargé:', e.message);
}

httpServer.listen(PORT, () => {
  console.log(`\n🕌 MedinImmersion démarré sur le port ${PORT}`);
  console.log(`   URL: http://localhost:${PORT}`);
  console.log(`   ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   DB:  ${process.env.DATABASE_URL ? '✓ configurée' : '✗ non configurée'}\n`);
});

module.exports = app;

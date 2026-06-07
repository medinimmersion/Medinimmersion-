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

// ─── MIDDLEWARE ──────────────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files — serve from public/ if exists, otherwise root
const fs = require('fs');
const publicDir = fs.existsSync(path.join(__dirname, 'public'))
  ? path.join(__dirname, 'public')
  : __dirname;
app.use(express.static(publicDir, {
  maxAge: '1h',
  etag: true,
}));

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
const studentTokens = new Map();
const teacherTokens = new Map();
const gerantTokens = new Map();
const resetTokens = new Map();

// ─── HELPERS ─────────────────────────────────────────────────
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const verify = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return verify === hash;
}

function generateToken(store, id, days = 7) {
  const token = crypto.randomBytes(64).toString('hex');
  const expires = Date.now() + days * 24 * 60 * 60 * 1000;
  store.set(token, { id, expires });
  return token;
}

function getFromToken(store, token) {
  const entry = store.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expires) { store.delete(token); return null; }
  return entry.id;
}

// ─── AUTH MIDDLEWARE ─────────────────────────────────────────
function requireStudentAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Non autorisé' });
  const token = auth.slice(7);
  const studentId = getFromToken(studentTokens, token);
  if (!studentId) return res.status(401).json({ error: 'Session expirée' });
  req.studentId = studentId;
  next();
}

function requireTeacherAuth(req, res, next) {
  const token = req.headers['x-teacher-token'] || (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token requis' });
  const teacherId = getFromToken(teacherTokens, token);
  if (!teacherId) return res.status(401).json({ error: 'Session expirée' });
  req.teacherId = teacherId;
  next();
}

function requireAdmin(req, res, next) {
  const token = req.headers['x-gerant-token'] || req.headers['x-admin-token'] ||
    (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token admin requis' });
  const id = getFromToken(gerantTokens, token);
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
const ENROLLMENT_FEE = 10;
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'contact.medinimmersion@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || process.env.GERANT_PASSWORD || 'MedinGerant2024!';

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
  generateToken: (store, id, days) => generateToken(store, id, days),
  studentTokens,
  teacherTokens,
  gerantTokens,
  resetTokens,
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
// Serve HTML files for known routes
const htmlPages = [
  'nos-cours', 'tarifs', 'qui-sommes-nous', 'reglement',
  'inscription', 'espace-eleve', 'espace-professeur',
  'admin-gerant', 'reset-password', 'merci', 'kalam', 'kalam-test',
];

htmlPages.forEach(page => {
  app.get(`/${page}`, (req, res) => {
    res.sendFile(path.join(publicDir, `${page}.html`));
  });
  app.get(`/${page}.html`, (req, res) => {
    res.sendFile(path.join(publicDir, `${page}.html`));
  });
});

// Root → index.html
app.get('/', (req, res) => {
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
app.listen(PORT, () => {
  console.log(`\n🕌 MedinImmersion démarré sur le port ${PORT}`);
  console.log(`   URL: http://localhost:${PORT}`);
  console.log(`   ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   DB:  ${process.env.DATABASE_URL ? '✓ configurée' : '✗ non configurée'}\n`);
});

module.exports = app;

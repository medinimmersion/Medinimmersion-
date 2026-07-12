/**
 * kalam-books.js — Donne à Kalam l'accès au CONTENU réel des livres du programme.
 *
 * 1. Extraction : envoie le PDF d'un livre à Gemini (lit très bien l'arabe, même scanné),
 *    récupère le texte page par page et le stocke dans la table book_pages.
 * 2. Injection : buildBookContext() renvoie le texte des pages autour de la page en cours
 *    de l'élève, pour l'ajouter au prompt de Kalam.
 */
'use strict';

function getKey() { return process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY; }

const EXTRACT_MODELS = ['gemini-3.1-flash', 'gemini-2.5-flash', 'gemini-2.0-flash'];
const BATCH_SIZE = 5; // pages par requête d'extraction

// ── Tables (créées au démarrage, idempotent) ──
async function ensureTables(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS book_pages (
      id SERIAL PRIMARY KEY,
      book_id INTEGER NOT NULL,
      page_number INTEGER NOT NULL,
      content TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE (book_id, page_number)
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS book_extractions (
      book_id INTEGER PRIMARY KEY,
      status VARCHAR DEFAULT 'pending',
      pages_done INTEGER DEFAULT 0,
      total_pages INTEGER DEFAULT 0,
      error TEXT,
      updated_at TIMESTAMPTZ DEFAULT now()
    )`);
}

// ── Upload d'un PDF vers la File API de Gemini (multipart) ──
async function uploadPdfToGemini(key, pdfBuffer, displayName) {
  const boundary = 'medin' + Date.now();
  const meta = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=utf-8\r\n\r\n` +
    JSON.stringify({ file: { display_name: displayName } }) + `\r\n` +
    `--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`);
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([meta, pdfBuffer, tail]);

  const r = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${key}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'multipart',
      'Content-Type': `multipart/related; boundary=${boundary}`,
      'Content-Length': String(body.length),
    },
    body,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.file) throw new Error('Upload Gemini: ' + ((d.error && d.error.message) || ('HTTP ' + r.status)));

  // Attendre que le fichier soit traité (state ACTIVE)
  let file = d.file;
  for (let i = 0; i < 60 && file.state && file.state !== 'ACTIVE'; i++) {
    await new Promise(rs => setTimeout(rs, 2000));
    const fr = await fetch(`https://generativelanguage.googleapis.com/v1beta/${file.name}?key=${key}`);
    file = await fr.json();
    if (file.state === 'FAILED') throw new Error('Traitement du PDF échoué côté Gemini.');
  }
  return file; // { name, uri, mimeType, state }
}

// ── Appel generateContent avec le fichier + prompt, réponse JSON ──
async function askGeminiJson(key, fileUri, prompt) {
  let lastErr = 'aucun modèle';
  for (const model of EXTRACT_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [
              { fileData: { mimeType: 'application/pdf', fileUri } },
              { text: prompt },
            ] }],
            generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 8192, temperature: 0 },
          }),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) { lastErr = (d.error && d.error.message) || ('HTTP ' + r.status); continue; }
        const txt = d.candidates && d.candidates[0] && d.candidates[0].content
          && d.candidates[0].content.parts && d.candidates[0].content.parts.map(p => p.text || '').join('');
        if (!txt) { lastErr = 'réponse vide'; continue; }
        return JSON.parse(txt);
      } catch (e) { lastErr = e.message; }
    }
  }
  throw new Error(lastErr);
}

async function setStatus(pool, bookId, fields) {
  const { status, pages_done, total_pages, error } = fields;
  await pool.query(`
    INSERT INTO book_extractions (book_id, status, pages_done, total_pages, error, updated_at)
    VALUES ($1, $2, COALESCE($3, 0), COALESCE($4, 0), $5, now())
    ON CONFLICT (book_id) DO UPDATE SET
      status = COALESCE($2, book_extractions.status),
      pages_done = COALESCE($3, book_extractions.pages_done),
      total_pages = COALESCE($4, book_extractions.total_pages),
      error = $5, updated_at = now()`,
    [bookId, status || null, pages_done !== undefined ? pages_done : null,
     total_pages !== undefined ? total_pages : null, error || null]);
}

// ── Extraction complète d'un livre (à lancer en tâche de fond) ──
async function extractBook(pool, bookId) {
  const key = getKey();
  if (!key) throw new Error('Clé Gemini manquante côté serveur.');

  const br = await pool.query('SELECT id, name, file_url FROM library_books WHERE id = $1', [bookId]);
  if (!br.rows.length) throw new Error('Livre introuvable.');
  const book = br.rows[0];
  if (!book.file_url) throw new Error('Ce livre n\'a pas de fichier PDF.');

  await setStatus(pool, bookId, { status: 'telechargement', pages_done: 0, total_pages: 0, error: null });
  console.log(`[kalam-books] Extraction « ${book.name} » (livre ${bookId})…`);

  try {
    // 1. Télécharger le PDF
    const pr = await fetch(book.file_url);
    if (!pr.ok) throw new Error('Téléchargement du PDF impossible (HTTP ' + pr.status + ')');
    const pdf = Buffer.from(await pr.arrayBuffer());

    // 2. Envoyer à Gemini
    await setStatus(pool, bookId, { status: 'envoi_gemini' });
    const file = await uploadPdfToGemini(key, pdf, book.name);

    // 3. Nombre total de pages
    const info = await askGeminiJson(key, file.uri,
      'Ce document PDF est un manuel. Réponds UNIQUEMENT en JSON : {"total_pages": N} où N est le nombre total de pages du fichier PDF.');
    const total = parseInt(info.total_pages, 10);
    if (!total || total < 1) throw new Error('Nombre de pages non détecté.');
    await setStatus(pool, bookId, { status: 'extraction', total_pages: total, pages_done: 0 });

    // 4. On repart de zéro pour ce livre
    await pool.query('DELETE FROM book_pages WHERE book_id = $1', [bookId]);

    // 5. Extraction par lots
    let done = 0;
    for (let start = 1; start <= total; start += BATCH_SIZE) {
      const end = Math.min(start + BATCH_SIZE - 1, total);
      const pages = await askGeminiJson(key, file.uri,
        `Extrais le texte intégral des pages ${start} à ${end} de ce PDF (première page du fichier = page 1). ` +
        `Réponds UNIQUEMENT en JSON, un tableau : [{"page": numéro, "texte": "texte complet de la page"}]. ` +
        `Conserve le texte arabe tel quel (avec voyelles). Inclus les titres, dialogues, exercices et listes de vocabulaire. ` +
        `Si une page est une image sans texte, mets "texte": "".`);
      const arr = Array.isArray(pages) ? pages : (pages.pages || []);
      for (const p of arr) {
        const num = parseInt(p.page, 10);
        if (!num || num < start || num > end) continue;
        await pool.query(`
          INSERT INTO book_pages (book_id, page_number, content) VALUES ($1, $2, $3)
          ON CONFLICT (book_id, page_number) DO UPDATE SET content = $3`,
          [bookId, num, String(p.texte || '').slice(0, 20000)]);
      }
      done = end;
      await setStatus(pool, bookId, { status: 'extraction', pages_done: done, total_pages: total });
      console.log(`[kalam-books] « ${book.name} » : pages ${start}-${end} / ${total}`);
    }

    await setStatus(pool, bookId, { status: 'termine', pages_done: total, total_pages: total, error: null });
    console.log(`[kalam-books] ✓ « ${book.name} » extrait (${total} pages).`);
  } catch (e) {
    console.error(`[kalam-books] ✗ livre ${bookId}:`, e.message);
    await setStatus(pool, bookId, { status: 'erreur', error: e.message.slice(0, 300) }).catch(() => {});
    throw e;
  }
}

// ── Contexte livre pour le prompt de Kalam (page en cours ± 1) ──
async function buildBookContext(pool, niveau, currentPage) {
  try {
    const cur = Math.max(1, parseInt(currentPage, 10) || 1);
    const r = await pool.query(`
      SELECT lb.name AS book_name, bp.page_number, bp.content
      FROM library_books lb
      JOIN book_pages bp ON bp.book_id = lb.id
      WHERE lb.name = $1 AND lb.statut = 'approuve'
        AND bp.page_number BETWEEN $2 AND $3
        AND COALESCE(bp.content, '') <> ''
      ORDER BY bp.page_number`,
      [`Niveau ${niveau}`, cur - 1, cur + 1]);
    if (!r.rows.length) return '';

    let out = `\n\nCONTENU RÉEL DU MANUEL (« ${r.rows[0].book_name} » du programme de Médine — l'élève est à la page ${cur}) :`;
    let budget = 4500;
    for (const row of r.rows) {
      const label = row.page_number === cur ? `Page ${row.page_number} (PAGE EN COURS)` : `Page ${row.page_number}`;
      const txt = String(row.content).slice(0, Math.min(1800, budget));
      if (budget <= 0) break;
      budget -= txt.length;
      out += `\n--- ${label} ---\n${txt}`;
    }
    out += `\nAppuie-toi sur ce contenu : fais réviser et pratiquer EXACTEMENT le vocabulaire, les dialogues et les règles de ces pages (surtout la page en cours).`;
    return out;
  } catch (e) {
    console.error('[kalam-books] contexte:', e.message);
    return '';
  }
}

module.exports = { ensureTables, extractBook, buildBookContext };

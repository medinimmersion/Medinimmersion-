/**
 * routes/boutique.js — Boutique de vente des PDF du programme (livres de Médine).
 * FIX 20/07/2026 : couvertures stockées EN BASE au lieu de R2
 * UPDATED: Endpoints CRUD pour gérer les produits dynamiquement
 */
'use strict';

const PAYPAL_LINK = 'https://paypal.me/medinimmersion';

// Livres par défaut (fallback si table vide)
const DEFAULT_BOOKS = [
  { niveau: 1,  ar: 'الْمُسْتَوَى الْأَوَّلُ',  fr: 'Niveau 1',  price: 10 },
  { niveau: 2,  ar: 'الْمُسْتَوَى الثَّانِي',  fr: 'Niveau 2',  price: 12 },
  { niveau: 3,  ar: 'الْمُسْتَوَى الثَّالِثُ', fr: 'Niveau 3',  price: 14 },
  { niveau: 4,  ar: 'الْمُسْتَوَى الرَّابِعُ', fr: 'Niveau 4',  price: 14 },
  { niveau: 5,  ar: 'الْمُسْتَوَى الْخَامِسُ', fr: 'Niveau 5',  price: 14 },
  { niveau: 6,  ar: 'الْمُسْتَوَى السَّادِسُ', fr: 'Niveau 6',  price: 13 },
  { niveau: 7,  ar: 'الْمُسْتَوَى السَّابِعُ', fr: 'Niveau 7',  price: 13 },
  { niveau: 8,  ar: 'الْمُسْتَوَى الثَّامِنُ', fr: 'Niveau 8',  price: 13 },
  { niveau: 9,  ar: 'الْمُسْتَوَى التَّاسِعُ', fr: 'Niveau 9',  price: 13 },
  { niveau: 10, ar: 'الْمُسْتَوَى الْعَاشِرُ', fr: 'Niveau 10', price: 13 },
  { niveau: 11, ar: 'سِيرَةُ طَالِبِ عِلْمٍ',  fr: "Livre d'expression", price: 17 },
];
const FULL_PRICE = DEFAULT_BOOKS.reduce((s, b) => s + b.price, 0);
const PACK_PRICE = 70;

module.exports = function (pool, opts) {
  const router = require('express').Router();

  // Table boutique_orders
  pool.query(`
    CREATE TABLE IF NOT EXISTS boutique_orders (
      id SERIAL PRIMARY KEY,
      prenom VARCHAR, nom VARCHAR, email VARCHAR, whatsapp VARCHAR,
      items TEXT, total NUMERIC,
      payment_status VARCHAR DEFAULT 'unpaid',
      created_at TIMESTAMPTZ DEFAULT now()
    )`).then(
    () => console.log('[boutique] orders table prête'),
    (e) => console.error('[boutique] orders table:', e.message));

  // Table boutique_products (NOUVEAU) — stockage des couvertures EN BASE
  pool.query(`
    CREATE TABLE IF NOT EXISTS boutique_products (
      id SERIAL PRIMARY KEY,
      name VARCHAR NOT NULL,
      price_euros NUMERIC NOT NULL,
      cover_url TEXT,
      cover_base64 TEXT,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    ALTER TABLE boutique_products ADD COLUMN IF NOT EXISTS cover_data TEXT;
  `).then(
    () => console.log('[boutique] products table prête'),
    (e) => console.error('[boutique] products table:', e.message));

  // ── GET /api/files/cover/:id ────────────────────────────────────────
  // Sert une couverture stockée en base de données
  router.get('/api/files/cover/:id', async (req, res) => {
    const coverId = parseInt(req.params.id, 10);
    if (!Number.isFinite(coverId)) return res.status(400).send('ID invalide');
    try {
      const r = await pool.query('SELECT cover_data FROM boutique_products WHERE id = $1', [coverId]);
      if (r.rowCount === 0 || !r.rows[0].cover_data) return res.status(404).send('Couverture non trouvée');
      const buffer = Buffer.from(r.rows[0].cover_data, 'base64');
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(buffer);
    } catch (err) {
      console.error('[boutique] GET cover error:', err.message);
      res.status(500).send('Erreur serveur');
    }
  });

  // ── GET /api/boutique/books ─────────────────────────────────────────
  // Public : catalogue des livres
  router.get('/api/boutique/books', async (req, res) => {
    try {
      const r = await pool.query('SELECT id, name, price_euros as price, cover_url, description FROM boutique_products WHERE is_active = true ORDER BY created_at');
      const books = r.rowCount > 0 ? r.rows.map(b => ({
        ...b,
        cover_url: b.cover_url || (b.cover_data ? '/api/files/cover/' + b.id : null)
      })) : DEFAULT_BOOKS;
      res.json({ books, pack: { price: PACK_PRICE, full_price: FULL_PRICE } });
    } catch (err) {
      console.error('[boutique] GET books error:', err.message);
      res.json({ books: DEFAULT_BOOKS, pack: { price: PACK_PRICE, full_price: FULL_PRICE } });
    }
  });

  // ── POST /api/admin/boutique/products ────────────────────────────────
  // Gérant : ajouter un produit
  router.post('/api/admin/boutique/products', opts.requireAdmin, async (req, res) => {
    try {
      const { name, price, cover, description } = req.body || {};
      if (!name || !price) return res.status(400).json({ error: 'Nom et prix requis.' });
      
      const r = await pool.query(
        `INSERT INTO boutique_products (name, price_euros, cover_data, description)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [name.trim(), parseFloat(price), cover || null, description?.trim() || null]
      );
      res.json(r.rows[0]);
    } catch (err) {
      console.error('[boutique/products] POST error:', err.message);
      res.status(500).json({ error: 'Erreur serveur: ' + err.message });
    }
  });

  // ── GET /api/admin/boutique/products ─────────────────────────────────
  // Gérant : lister tous les produits
  router.get('/api/admin/boutique/products', opts.requireAdmin, async (req, res) => {
    try {
      const r = await pool.query('SELECT id, name, price_euros, description, is_active, created_at FROM boutique_products ORDER BY created_at DESC');
      res.json(r.rows);
    } catch (err) {
      console.error('[boutique/products] GET error:', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── PATCH /api/admin/boutique/products/:id ───────────────────────────
  // Gérant : modifier un produit
  router.patch('/api/admin/boutique/products/:id', opts.requireAdmin, async (req, res) => {
    try {
      const { name, price, cover, description } = req.body || {};
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID invalide' });

      const r = await pool.query(
        `UPDATE boutique_products 
         SET name = COALESCE($1, name),
             price_euros = COALESCE($2, price_euros),
             cover_data = COALESCE($3, cover_data),
             description = COALESCE($4, description),
             updated_at = NOW()
         WHERE id = $5 RETURNING *`,
        [name?.trim(), price ? parseFloat(price) : null, cover, description?.trim(), id]
      );
      if (r.rowCount === 0) return res.status(404).json({ error: 'Produit non trouvé' });
      res.json(r.rows[0]);
    } catch (err) {
      console.error('[boutique/products] PATCH error:', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── DELETE /api/admin/boutique/products/:id ──────────────────────────
  // Gérant : supprimer un produit
  router.delete('/api/admin/boutique/products/:id', opts.requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID invalide' });

      const r = await pool.query('DELETE FROM boutique_products WHERE id = $1', [id]);
      if (r.rowCount === 0) return res.status(404).json({ error: 'Produit non trouvé' });
      res.json({ success: true });
    } catch (err) {
      console.error('[boutique/products] DELETE error:', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── POST /api/boutique/order ─────────────────────────────────────────
  // Client : créer une commande
  router.post('/api/boutique/order', async (req, res) => {
    try {
      const { prenom, nom, email, whatsapp, niveaux, pack } = req.body || {};
      if (!prenom || !nom) return res.status(400).json({ error: 'Prénom et nom requis.' });
      if (!email && !whatsapp) return res.status(400).json({ error: 'Email ou WhatsApp requis.' });

      let items, total;
      const sel = Array.isArray(niveaux) ? [...new Set(niveaux.map(n => parseInt(n, 10)))].filter(n => DEFAULT_BOOKS.some(b => b.niveau === n)) : [];
      if (pack || sel.length === DEFAULT_BOOKS.length) {
        items = `PACK COMPLET — les ${DEFAULT_BOOKS.length} PDF (valeur ${FULL_PRICE}€)`;
        total = PACK_PRICE;
      } else {
        if (!sel.length) return res.status(400).json({ error: 'Choisis au moins un livre.' });
        const chosen = DEFAULT_BOOKS.filter(b => sel.includes(b.niveau));
        items = chosen.map(b => `${b.fr} (${b.price}€)`).join(' + ');
        total = chosen.reduce((s, b) => s + b.price, 0);
      }

      const r = await pool.query(
        `INSERT INTO boutique_orders (prenom, nom, email, whatsapp, items, total)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [prenom.trim(), nom.trim(), (email || '').trim().toLowerCase() || null, (whatsapp || '').trim() || null, items, total]);

      if (opts.sendEmail) {
        opts.sendEmail(
          opts.OWNER_EMAIL || 'contact.medinimmersion@gmail.com',
          'Nouvelle commande Boutique (PDF)',
          `<h2>Nouvelle commande de PDF</h2>
           <p><b>${prenom} ${nom}</b> — ${email || ''} ${whatsapp || ''}</p>
           <p>Commande : ${items}</p>
           <p>TOTAL À RECEVOIR : <b>${total.toFixed(2)}€</b></p>
           <p>Valide dans Espace Gérant → Paiements → Livres une fois le PayPal reçu, puis envoie les PDF à l'acheteur.</p>`
        ).catch(() => {});
      }

      res.json({
        success: true,
        order_id: r.rows[0].id,
        items, total: total.toFixed(2),
        paypal: `${PAYPAL_LINK}/${total.toFixed(2)}EUR`,
      });
    } catch (err) {
      console.error('[boutique/order]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ── GET /api/admin/boutique/orders ───────────────────────────────────
  // Gérant : liste des commandes
  router.get('/api/admin/boutique/orders', opts.requireAdmin, async (req, res) => {
    try {
      const r = await pool.query('SELECT * FROM boutique_orders ORDER BY created_at DESC LIMIT 200');
      res.json(r.rows);
    } catch (err) { res.json([]); }
  });

  // ── PATCH /api/admin/boutique/orders/:id ─────────────────────────────
  // Gérant : valider / annuler un paiement
  router.patch('/api/admin/boutique/orders/:id', opts.requireAdmin, async (req, res) => {
    try {
      const paid = req.body.payment_status === 'paid';
      await pool.query('UPDATE boutique_orders SET payment_status = $2 WHERE id = $1',
        [req.params.id, paid ? 'paid' : 'unpaid']);
      res.json({ success: true });
    } catch (err) { console.error('[boutique/pay]', err.message); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  return router;
};

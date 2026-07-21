/**
 * routes/boutique.js — Boutique avec gestion des produits
 * Gère les COMMANDES + les PRODUITS (livres) modifiables depuis l'espace gérant
 */
'use strict';

const PAYPAL_LINK = 'https://paypal.me/medinimmersion';

// Livres par défaut — servent de "seed" à la première initialisation de la table
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
const PACK_PRICE = 70;

module.exports = function (pool, opts) {
  const router = require('express').Router();

  // ── Tables ───────────────────────────────────────────────────────────
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

  pool.query(`
    CREATE TABLE IF NOT EXISTS boutique_products (
      id SERIAL PRIMARY KEY,
      name VARCHAR NOT NULL,
      price NUMERIC NOT NULL,
      description TEXT,
      cover_data TEXT,
      image_url VARCHAR,
      sort_order INTEGER DEFAULT 0,
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now()
    )`).then(seedProducts,
    (e) => console.error('[boutique] products table:', e.message));

  // Remplit la table avec les livres par défaut si elle est vide
  async function seedProducts() {
    try {
      const r = await pool.query('SELECT COUNT(*)::int AS n FROM boutique_products');
      if (r.rows[0].n > 0) { console.log('[boutique] products déjà présents'); return; }
      for (const b of DEFAULT_BOOKS) {
        await pool.query(
          `INSERT INTO boutique_products (name, price, image_url, sort_order)
           VALUES ($1, $2, $3, $4)`,
          [b.fr, b.price, `/images/livres/niveau-${b.niveau}.jpg`, b.niveau]);
      }
      console.log('[boutique] products initialisés (' + DEFAULT_BOOKS.length + ')');
    } catch (e) { console.error('[boutique] seed:', e.message); }
  }

  // Renvoie la liste des produits actifs, formatée pour la boutique publique
  async function getBooks() {
    try {
      const r = await pool.query(
        'SELECT * FROM boutique_products WHERE active = true ORDER BY sort_order ASC, id ASC');
      if (!r.rows.length) return DEFAULT_BOOKS.map(b => ({
        niveau: b.niveau, fr: b.fr, price: b.price,
        img: `/images/livres/niveau-${b.niveau}.jpg`,
      }));
      return r.rows.map(p => ({
        id: p.id,
        niveau: p.sort_order || p.id,
        fr: p.name,
        name: p.name,
        price: Number(p.price),
        description: p.description || '',
        img: p.cover_data ? `/api/boutique/products/${p.id}/cover` : (p.image_url || `/images/livres/niveau-${p.sort_order || 1}.jpg`),
      }));
    } catch (e) {
      console.error('[boutique] getBooks:', e.message);
      return DEFAULT_BOOKS.map(b => ({
        niveau: b.niveau, fr: b.fr, price: b.price,
        img: `/images/livres/niveau-${b.niveau}.jpg`,
      }));
    }
  }

  // ── GET /api/boutique/books ─────────────────────────────────────────
  // Public : catalogue des livres (depuis la base)
  router.get('/api/boutique/books', async (req, res) => {
    const books = await getBooks();
    const full = books.reduce((s, b) => s + Number(b.price), 0);
    res.json({ books, pack: { price: PACK_PRICE, full_price: full } });
  });

  // ── GET /api/boutique/products/:id/cover ────────────────────────────
  // Public : image de couverture stockée en base
  router.get('/api/boutique/products/:id/cover', async (req, res) => {
    try {
      const r = await pool.query('SELECT cover_data FROM boutique_products WHERE id = $1', [req.params.id]);
      if (!r.rows.length || !r.rows[0].cover_data) return res.status(404).end();
      const buf = Buffer.from(r.rows[0].cover_data, 'base64');
      res.set('Content-Type', 'image/jpeg');
      res.set('Cache-Control', 'public, max-age=3600');
      res.send(buf);
    } catch (e) { res.status(404).end(); }
  });

  // ── POST /api/boutique/order ─────────────────────────────────────────
  // Client : créer une commande
  router.post('/api/boutique/order', async (req, res) => {
    try {
      const { prenom, nom, email, whatsapp, niveaux, items: itemsIn, total: totalIn, pack } = req.body || {};
      if (!prenom || !nom) return res.status(400).json({ error: 'Prénom et nom requis.' });
      if (!email && !whatsapp) return res.status(400).json({ error: 'Email ou WhatsApp requis.' });

      const books = await getBooks();
      const full = books.reduce((s, b) => s + Number(b.price), 0);
      let items, total;

      // Cas 1 : le panier envoie directement items + total (nouveau panier.html)
      if (Array.isArray(itemsIn) && itemsIn.length && totalIn != null) {
        items = itemsIn.map(it => `${it.name || ('Niveau ' + it.niveau)} (${Number(it.price).toFixed(2)}€)`).join(' + ');
        total = Number(totalIn);
      }
      // Cas 2 : ancienne logique par niveaux + pack
      else {
        const sel = Array.isArray(niveaux) ? [...new Set(niveaux.map(n => parseInt(n, 10)))] : [];
        if (pack || sel.length === books.length) {
          items = `PACK COMPLET — les ${books.length} PDF (valeur ${full}€)`;
          total = PACK_PRICE;
        } else {
          const chosen = books.filter(b => sel.includes(b.niveau));
          if (!chosen.length) return res.status(400).json({ error: 'Choisis au moins un livre.' });
          items = chosen.map(b => `${b.fr} (${b.price}€)`).join(' + ');
          total = chosen.reduce((s, b) => s + Number(b.price), 0);
        }
      }

      if (!(total > 0)) return res.status(400).json({ error: 'Total invalide.' });

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
           <p>TOTAL À RECEVOIR : <b>${total.toFixed(2)}€</b></p>`
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

  // ── GET /api/admin/boutique/products ─────────────────────────────────
  // Gérant : liste des produits (pour édition)
  router.get('/api/admin/boutique/products', opts.requireAdmin, async (req, res) => {
    try {
      const r = await pool.query('SELECT * FROM boutique_products ORDER BY sort_order ASC, id ASC');
      res.json(r.rows.map(p => ({
        id: p.id,
        name: p.name,
        price: Number(p.price),
        description: p.description || '',
        image_url: p.image_url || '',
        has_cover: !!p.cover_data,
        cover_url: p.cover_data ? `/api/boutique/products/${p.id}/cover` : (p.image_url || ''),
        sort_order: p.sort_order || 0,
        active: p.active,
      })));
    } catch (err) { console.error('[boutique/products]', err.message); res.json([]); }
  });

  // ── POST /api/admin/boutique/products ────────────────────────────────
  // Gérant : ajouter un livre
  router.post('/api/admin/boutique/products', opts.requireAdmin, async (req, res) => {
    try {
      const { name, price, cover, description } = req.body || {};
      if (!name || price == null) return res.status(400).json({ error: 'Nom et prix requis.' });
      const so = await pool.query('SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM boutique_products');
      const r = await pool.query(
        `INSERT INTO boutique_products (name, price, description, cover_data, sort_order)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [String(name).trim(), Number(price), (description || '').trim() || null, cover || null, so.rows[0].n]);
      res.json({ success: true, id: r.rows[0].id });
    } catch (err) { console.error('[boutique/products POST]', err.message); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // ── PUT /api/admin/boutique/products/:id ─────────────────────────────
  // Gérant : modifier un livre (cover optionnelle)
  router.put('/api/admin/boutique/products/:id', opts.requireAdmin, async (req, res) => {
    try {
      const { name, price, cover, description } = req.body || {};
      if (!name || price == null) return res.status(400).json({ error: 'Nom et prix requis.' });
      if (cover) {
        await pool.query(
          `UPDATE boutique_products SET name = $2, price = $3, description = $4, cover_data = $5 WHERE id = $1`,
          [req.params.id, String(name).trim(), Number(price), (description || '').trim() || null, cover]);
      } else {
        await pool.query(
          `UPDATE boutique_products SET name = $2, price = $3, description = $4 WHERE id = $1`,
          [req.params.id, String(name).trim(), Number(price), (description || '').trim() || null]);
      }
      res.json({ success: true });
    } catch (err) { console.error('[boutique/products PUT]', err.message); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // ── DELETE /api/admin/boutique/products/:id ──────────────────────────
  // Gérant : supprimer un livre
  router.delete('/api/admin/boutique/products/:id', opts.requireAdmin, async (req, res) => {
    try {
      await pool.query('DELETE FROM boutique_products WHERE id = $1', [req.params.id]);
      res.json({ success: true });
    } catch (err) { console.error('[boutique/products DELETE]', err.message); res.status(500).json({ error: 'Erreur serveur' }); }
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

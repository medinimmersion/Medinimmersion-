/**
 * routes/boutique.js — Boutique simplifiée
 * Gère juste les COMMANDES, pas les produits
 */
'use strict';

const PAYPAL_LINK = 'https://paypal.me/medinimmersion';

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

  // ── GET /api/boutique/books ─────────────────────────────────────────
  // Public : catalogue des livres (par défaut)
  router.get('/api/boutique/books', async (req, res) => {
    res.json({ books: DEFAULT_BOOKS, pack: { price: PACK_PRICE, full_price: FULL_PRICE } });
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

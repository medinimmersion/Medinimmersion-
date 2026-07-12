/**
 * routes/kalam-signup.js — Inscription publique « Kalam AI » (utiliser uniquement l'IA).
 * L'utilisateur choisit un forfait, crée son compte, paie via PayPal ;
 * le gérant valide le paiement dans Paiements → Kalam (active le temps).
 */
'use strict';

const PAYPAL_LINK = 'https://paypal.me/medinimmersion';

// Forfaits par défaut (créés au premier démarrage si la table est vide)
const DEFAULT_PACKAGES = [
  { name: 'Découverte',    minutes_per_day: 10,  price_euros: 2.90,  duration_days: 30 },
  { name: 'Apprentissage', minutes_per_day: 20,  price_euros: 4.90,  duration_days: 30 },
  { name: 'Progression',   minutes_per_day: 60,  price_euros: 9.90,  duration_days: 30 },
  { name: 'Immersion',     minutes_per_day: -1,  price_euros: 14.90, duration_days: 30 },
];

const OBJECTIFS = ['alphabet', 'lecture', 'ecriture', 'conversation'];

// Prix des livres du programme (Niveau 1 à 11)
const BOOK_PRICES = { 1: 10, 2: 12, 3: 14, 4: 14, 5: 14, 6: 13, 7: 13, 8: 13, 9: 13, 10: 13, 11: 17 };
function bookLabel(n) { return n === 11 ? 'Niveau 11 — Expression (سيرة طالب علم)' : `Niveau ${n}`; }
// Ces objectifs nécessitent l'achat du livre correspondant
const OBJECTIFS_AVEC_LIVRE = ['alphabet', 'lecture', 'ecriture'];

module.exports = function (pool, opts) {
  const router = require('express').Router();
  const crypto = require('crypto');

  // Prépare la colonne objectif + synchronise les forfaits officiels (idempotent).
  // Les tarifs officiels de l'école priment : les anciens forfaits hors liste sont désactivés.
  (async () => {
    try {
      await pool.query("ALTER TABLE students ADD COLUMN IF NOT EXISTS kalam_objectif VARCHAR");
      for (const p of DEFAULT_PACKAGES) {
        const ex = await pool.query('SELECT id FROM kalam_packages WHERE name = $1 LIMIT 1', [p.name]);
        if (ex.rows.length) {
          await pool.query(
            `UPDATE kalam_packages SET minutes_per_day = $2, price_euros = $3, duration_days = $4, active = true WHERE id = $1`,
            [ex.rows[0].id, p.minutes_per_day, p.price_euros, p.duration_days]);
        } else {
          await pool.query(
            `INSERT INTO kalam_packages (name, minutes_per_day, price_euros, duration_days)
             VALUES ($1, $2, $3, $4)`,
            [p.name, p.minutes_per_day, p.price_euros, p.duration_days]);
        }
      }
      const off = await pool.query(
        `UPDATE kalam_packages SET active = false WHERE active = true AND name <> ALL($1) RETURNING name`,
        [DEFAULT_PACKAGES.map(p => p.name)]);
      console.log('[kalam-signup] forfaits synchronisés' + (off.rowCount ? ' (désactivés: ' + off.rows.map(r => r.name).join(', ') + ')' : ''));
    } catch (e) { console.error('[kalam-signup] init:', e.message); }
  })();

  // GET /api/kalam/books — liste des livres du programme avec leurs prix (public)
  router.get('/api/kalam/books', (req, res) => {
    res.json(Object.keys(BOOK_PRICES).map(n => ({
      niveau: parseInt(n, 10), label: bookLabel(parseInt(n, 10)), price_euros: BOOK_PRICES[n],
    })));
  });

  // POST /api/kalam/signup — crée le compte + la demande de forfait (paiement en attente)
  router.post('/api/kalam/signup', async (req, res) => {
    try {
      const { prenom, nom, email, whatsapp, gender, password, package_id, objectif, book_niveau } = req.body || {};
      if (!prenom || !nom) return res.status(400).json({ error: 'Prénom et nom requis.' });
      if (!email && !whatsapp) return res.status(400).json({ error: 'Email ou WhatsApp requis (pour te connecter).' });
      if (!password || String(password).length < 4) return res.status(400).json({ error: 'Mot de passe requis (4 caractères minimum).' });
      const pkgId = parseInt(package_id, 10);
      if (!pkgId) return res.status(400).json({ error: 'Choisis un forfait.' });
      const obj = OBJECTIFS.includes(objectif) ? objectif : 'conversation';

      // Livre : obligatoire pour alphabet / lecture / écriture
      let book = null;
      const bn = parseInt(book_niveau, 10);
      if (OBJECTIFS_AVEC_LIVRE.includes(obj)) {
        if (!bn || !BOOK_PRICES[bn]) return res.status(400).json({ error: 'Choisis ton livre (Niveau 1 à 11) — il est requis pour cet objectif.' });
        book = { niveau: bn, label: bookLabel(bn), price_euros: BOOK_PRICES[bn] };
      } else if (bn && BOOK_PRICES[bn]) {
        book = { niveau: bn, label: bookLabel(bn), price_euros: BOOK_PRICES[bn] }; // livre optionnel
      }

      const pk = await pool.query('SELECT * FROM kalam_packages WHERE id = $1 AND active = true', [pkgId]);
      if (!pk.rows.length) return res.status(404).json({ error: 'Forfait introuvable.' });
      const p = pk.rows[0];

      // Unicité
      if (email) {
        const e = await pool.query('SELECT id FROM students WHERE LOWER(email) = LOWER($1)', [email.trim()]);
        if (e.rows.length) return res.status(409).json({ error: 'Cet email est déjà utilisé. Connecte-toi sur /kalam.' });
      }
      if (whatsapp) {
        const w = await pool.query(
          'SELECT id FROM students WHERE REPLACE(REPLACE(whatsapp, $1, $2), $3, $4) = REPLACE(REPLACE($5, $1, $2), $3, $4)',
          ['+', '', ' ', '', whatsapp]);
        if (w.rows.length) return res.status(409).json({ error: 'Ce numéro WhatsApp est déjà utilisé. Connecte-toi sur /kalam.' });
      }

      // Compte validé et actif : l'élève peut se connecter tout de suite
      // (3 min/jour offertes par défaut ; le forfait s'active à la validation du paiement)
      const objectifStocke = obj + (book ? ` · livre ${book.label}` : '');
      const st = await pool.query(
        `INSERT INTO students (nom, prenom, whatsapp, email, gender, password_hash, validation_status, status, kalam_objectif)
         VALUES ($1, $2, $3, $4, $5, $6, 'validated', 'active', $7)
         RETURNING id, nom, prenom, email, whatsapp`,
        [nom.trim(), prenom.trim(), (whatsapp || '').trim(),
         email ? email.trim().toLowerCase() : null, gender || null,
         opts.hashPassword(password), objectifStocke]);
      const student = st.rows[0];

      // Total = forfait + livre éventuel (le gérant voit le montant complet à valider)
      const total = Number(p.price_euros) + (book ? book.price_euros : 0);

      // Demande de forfait (paiement en attente — le gérant valide dans Paiements → Kalam)
      await pool.query(
        `INSERT INTO kalam_payments (student_id, package_id, minutes_per_day, price_euros, payment_status)
         VALUES ($1, $2, $3, $4, 'unpaid')`,
        [student.id, p.id, p.minutes_per_day, total]);

      // Notification au gérant (sans bloquer la réponse)
      const objLabels = { alphabet: 'Apprendre l\'alphabet', lecture: 'Apprendre à lire', ecriture: 'Apprendre à écrire', conversation: 'Conversation' };
      if (opts.sendEmail) {
        opts.sendEmail(
          opts.OWNER_EMAIL || 'contact.medinimmersion@gmail.com',
          'Nouvelle inscription Kalam AI',
          `<h2>Nouvelle inscription Kalam AI</h2>
           <p><b>${prenom} ${nom}</b> — ${email || ''} ${whatsapp || ''}</p>
           <p>Forfait : <b>${p.name}</b> (${p.minutes_per_day === -1 ? 'illimité' : p.minutes_per_day + ' min/jour'}) — ${p.price_euros}€/mois</p>
           <p>Objectif : ${objLabels[obj]}</p>
           ${book ? `<p>Livre : <b>${book.label}</b> — ${book.price_euros}€ (à remettre à l'élève après paiement, ex. via Livres → « Donner à un élève »)</p>` : ''}
           <p>TOTAL À RECEVOIR : <b>${total.toFixed(2)}€</b></p>
           <p>Valide le paiement dans Espace Gérant → Paiements → Kalam une fois le PayPal reçu.</p>`
        ).catch(() => {});
      }

      res.json({
        success: true,
        student: { id: student.id, prenom: student.prenom },
        package: { name: p.name, price_euros: Number(p.price_euros).toFixed(2), minutes_per_day: p.minutes_per_day },
        book: book,
        total: total.toFixed(2),
        objectif: obj,
        paypal: `${PAYPAL_LINK}/${total.toFixed(2)}EUR`,
        message: 'Compte créé ! Règle ton forfait via PayPal ; il sera activé dès réception. En attendant, tu profites de 3 minutes par jour offertes.',
      });
    } catch (err) {
      console.error('[kalam/signup]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  return router;
};

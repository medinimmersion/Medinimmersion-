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

module.exports = function (pool, opts) {
  const router = require('express').Router();
  const crypto = require('crypto');

  // Prépare la colonne objectif + les forfaits par défaut (idempotent)
  (async () => {
    try {
      await pool.query("ALTER TABLE students ADD COLUMN IF NOT EXISTS kalam_objectif VARCHAR");
      const n = await pool.query('SELECT COUNT(*)::int AS n FROM kalam_packages WHERE active = true');
      if (n.rows[0].n === 0) {
        for (const p of DEFAULT_PACKAGES) {
          await pool.query(
            `INSERT INTO kalam_packages (name, minutes_per_day, price_euros, duration_days)
             VALUES ($1, $2, $3, $4)`,
            [p.name, p.minutes_per_day, p.price_euros, p.duration_days]);
        }
        console.log('[kalam-signup] 4 forfaits par défaut créés');
      }
    } catch (e) { console.error('[kalam-signup] init:', e.message); }
  })();

  // POST /api/kalam/signup — crée le compte + la demande de forfait (paiement en attente)
  router.post('/api/kalam/signup', async (req, res) => {
    try {
      const { prenom, nom, email, whatsapp, gender, password, package_id, objectif } = req.body || {};
      if (!prenom || !nom) return res.status(400).json({ error: 'Prénom et nom requis.' });
      if (!email && !whatsapp) return res.status(400).json({ error: 'Email ou WhatsApp requis (pour te connecter).' });
      if (!password || String(password).length < 4) return res.status(400).json({ error: 'Mot de passe requis (4 caractères minimum).' });
      const pkgId = parseInt(package_id, 10);
      if (!pkgId) return res.status(400).json({ error: 'Choisis un forfait.' });
      const obj = OBJECTIFS.includes(objectif) ? objectif : 'conversation';

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
      const st = await pool.query(
        `INSERT INTO students (nom, prenom, whatsapp, email, gender, password_hash, validation_status, status, kalam_objectif)
         VALUES ($1, $2, $3, $4, $5, $6, 'validated', 'active', $7)
         RETURNING id, nom, prenom, email, whatsapp`,
        [nom.trim(), prenom.trim(), (whatsapp || '').trim(),
         email ? email.trim().toLowerCase() : null, gender || null,
         opts.hashPassword(password), obj]);
      const student = st.rows[0];

      // Demande de forfait (paiement en attente — le gérant valide dans Paiements → Kalam)
      await pool.query(
        `INSERT INTO kalam_payments (student_id, package_id, minutes_per_day, price_euros, payment_status)
         VALUES ($1, $2, $3, $4, 'unpaid')`,
        [student.id, p.id, p.minutes_per_day, p.price_euros]);

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
           <p>Valide le paiement dans Espace Gérant → Paiements → Kalam une fois le PayPal reçu.</p>`
        ).catch(() => {});
      }

      const price = Number(p.price_euros).toFixed(2);
      res.json({
        success: true,
        student: { id: student.id, prenom: student.prenom },
        package: { name: p.name, price_euros: price, minutes_per_day: p.minutes_per_day },
        objectif: obj,
        paypal: `${PAYPAL_LINK}/${price}EUR`,
        message: 'Compte créé ! Règle ton forfait via PayPal ; il sera activé dès réception. En attendant, tu profites de 3 minutes par jour offertes.',
      });
    } catch (err) {
      console.error('[kalam/signup]', err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  return router;
};

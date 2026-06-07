/**
 * routes/bookings.js — Booking CRUD + creation
 * Owns: /api/bookings POST
 * Does NOT own: admin booking management (see admin.js)
 */
'use strict';

module.exports = function (pool, opts) {
  const { requireStudentAuth, requireAdmin, requireTeacherAuth, pool: db, PRICING } = opts;
  const router = require('express').Router();

  const ENROLLMENT_FEE = opts.ENROLLMENT_FEE || 10;

  function calcPrice(courseType, hours, format) {
    const hMap = PRICING[courseType];
    if (!hMap || !hMap[hours]) return null;
    const idx = format === 'binome' ? 1 : format === 'groupe' ? 2 : 0;
    return hMap[hours][idx];
  }

  // POST /api/bookings — Create a new booking
  router.post('/api/bookings', async (req, res) => {
    try {
      const { student_id, course_type, hours, format, teacher_id } = req.body;
      if (!student_id || !course_type || !hours || !format) {
        return res.status(400).json({ error: 'student_id, course_type, hours, format requis' });
      }

      const price = calcPrice(course_type, parseInt(hours), format);
      if (price === null) return res.status(400).json({ error: 'Combinaison invalide' });

      const result = await pool.query(
        `INSERT INTO bookings (student_id, course_type, hours, format, price_euros, status, payment_status, teacher_id)
         VALUES ($1, $2, $3, $4, $5, 'pending', 'unpaid', $6) RETURNING *`,
        [student_id, course_type, parseInt(hours), format, price, teacher_id || null]
      );

      res.json(result.rows[0]);
    } catch (err) { console.error('[bookings]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  return router;
};
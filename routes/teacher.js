/**
 * routes/teacher.js — Teacher dashboard endpoints
 * Owns: /api/teacher/* endpoints (auth, profile, students, schedules, zoom, attendance)
 * Does NOT own: admin teacher management (see admin.js)
 */
'use strict';

module.exports = function (pool, opts) {
  const { requireTeacherAuth, requireAdmin, hashPassword, verifyPassword, generateToken, teacherTokens, sendEmail, uploadToR2WithRetry, FormDataLib, pool: db } = opts;
  const router = require('express').Router();

  // POST /api/teacher/login
  router.post('/api/teacher/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) return res.status(400).json({ error: 'Username et mot de passe requis' });

      const result = await pool.query('SELECT id, username, nom, prenom, email, zoom_link, password_hash FROM teachers WHERE username = $1', [username.trim()]);
      if (!result.rows.length) return res.status(401).json({ error: 'Identifiants incorrects' });

      const teacher = result.rows[0];
      if (!teacher.password_hash || !verifyPassword(password, teacher.password_hash)) {
        return res.status(401).json({ error: 'Mot de passe incorrect' });
      }

      const token = generateToken(teacherTokens, teacher.id, 7);
      delete teacher.password_hash;
      console.log('[teacher] Login:', teacher.nom, teacher.prenom);
      res.json({ teacher, token });
    } catch (err) { console.error('[teacher/login]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // GET /api/teacher/profile
  router.get('/api/teacher/profile', requireTeacherAuth, async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT id, username, email, nom, prenom, zoom_link, can_edit_planning, can_send_books, can_edit_zoom, can_edit_student_info FROM teachers WHERE id = $1',
        [req.teacherId]
      );
      if (!result.rows.length) return res.status(404).json({ error: 'Professeur non trouvé' });
      res.json(result.rows[0]);
    } catch (err) { console.error('[teacher/profile]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // GET /api/teacher/dashboard
  router.get('/api/teacher/dashboard', requireTeacherAuth, async (req, res) => {
    try {
      const teacher = await pool.query('SELECT id, nom, prenom FROM teachers WHERE id = $1', [req.teacherId]);
      const students = await pool.query(`
        SELECT s.id, s.nom, s.prenom, s.kounia, s.whatsapp, s.validation_status,
          (SELECT b.course_type FROM bookings b WHERE b.student_id = s.id ORDER BY b.created_at DESC LIMIT 1) as course_type,
          (SELECT b.hours FROM bookings b WHERE b.student_id = s.id ORDER BY b.created_at DESC LIMIT 1) as hours
        FROM teacher_student_assignments tsa
        JOIN students s ON s.id = tsa.student_id
        WHERE tsa.teacher_id = $1 ORDER BY s.nom, s.prenom
      `, [req.teacherId]);

      const sessions = await pool.query(`
        SELECT ss.id, ss.session_date, ss.time_start, ss.time_end, ss.course_type, ss.status, ss.notes,
          (SELECT COUNT(*) FROM session_students sst WHERE sst.session_id = ss.id)::int as student_count
        FROM scheduled_sessions ss
        WHERE ss.teacher_id = $1 AND ss.session_date >= CURRENT_DATE AND ss.status != 'cancelled'
        ORDER BY ss.session_date, ss.time_start LIMIT 20
      `, [req.teacherId]);

      res.json({ teacher: teacher.rows[0], students: students.rows, upcoming_sessions: sessions.rows });
    } catch (err) { console.error('[teacher/dashboard]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // GET /api/teacher/students
  router.get('/api/teacher/students', requireTeacherAuth, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT s.id, s.nom, s.prenom, s.kounia, s.whatsapp, s.email, s.gender, s.validation_status,
          b.course_type, b.hours, b.format, b.status as booking_status, b.payment_status
        FROM teacher_student_assignments tsa
        JOIN students s ON s.id = tsa.student_id
        LEFT JOIN bookings b ON b.student_id = s.id AND b.teacher_id = $1
        WHERE tsa.teacher_id = $1 ORDER BY s.nom, s.prenom
      `, [req.teacherId]);
      res.json(result.rows);
    } catch (err) { console.error('[teacher/students]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // GET /api/teacher/sessions
  router.get('/api/teacher/sessions', requireTeacherAuth, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT ss.id, ss.session_date, ss.time_start, ss.time_end, ss.course_type, ss.status, ss.notes,
          cs.title as schedule_title,
          (SELECT COUNT(*) FROM session_students sst WHERE sst.session_id = ss.id)::int as student_count,
          (SELECT json_agg(json_build_object('id', st.id, 'nom', st.nom, 'prenom', st.prenom))
           FROM session_students sst JOIN students st ON st.id = sst.student_id
           WHERE sst.session_id = ss.id) as students
        FROM scheduled_sessions ss
        LEFT JOIN course_schedules cs ON cs.id = ss.schedule_id
        WHERE ss.teacher_id = $1
        ORDER BY ss.session_date DESC, ss.time_start DESC LIMIT 50
      `, [req.teacherId]);
      res.json(result.rows);
    } catch (err) { console.error('[teacher/sessions]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // GET /api/teacher/schedules
  router.get('/api/teacher/schedules', requireTeacherAuth, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT cs.*,
          (SELECT COUNT(*) FROM schedule_students ss WHERE ss.schedule_id = cs.id)::int as student_count
        FROM course_schedules cs
        WHERE cs.teacher_id = $1 ORDER BY cs.start_date DESC
      `, [req.teacherId]);
      res.json(result.rows);
    } catch (err) { console.error('[teacher/schedules]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // GET /api/teacher/books
  router.get('/api/teacher/books', requireTeacherAuth, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT lb.id, lb.name, lb.file_url, lb.category_id, lc.name as category_name
        FROM library_books lb
        LEFT JOIN library_categories lc ON lc.id = lb.category_id
        WHERE lb.uploaded_by_type = 'teacher' AND lb.uploaded_by_id = $1
        ORDER BY lb.name
      `, [req.teacherId]);
      res.json(result.rows);
    } catch (err) { console.error('[teacher/books]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // POST /api/teacher/zoom-session — create a Zoom session for a session
  router.post('/api/teacher/zoom-session', requireTeacherAuth, async (req, res) => {
    try {
      const { session_id, zoom_url } = req.body;
      if (!session_id) return res.status(400).json({ error: 'session_id requis' });
      const result = await pool.query(
        'INSERT INTO zoom_sessions (session_id, teacher_id, zoom_url) VALUES ($1, $2, $3) RETURNING *',
        [session_id, req.teacherId, zoom_url || null]
      );
      res.json(result.rows[0]);
    } catch (err) { console.error('[teacher/zoom-session]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // GET /api/teacher/zoom-link
  router.get('/api/teacher/zoom-link', requireTeacherAuth, async (req, res) => {
    try {
      const result = await pool.query('SELECT zoom_link FROM teachers WHERE id = $1', [req.teacherId]);
      res.json({ zoom_link: result.rows[0]?.zoom_link || null });
    } catch (err) { console.error('[teacher/zoom-link]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // GET /api/teacher/student-connections/:student_id
  router.get('/api/teacher/student-connections/:student_id', requireTeacherAuth, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT logged_in_at, ip_address, user_agent FROM student_connection_logs
        WHERE student_id = $1 ORDER BY logged_in_at DESC LIMIT 10
      `, [req.params.student_id]);
      res.json(result.rows);
    } catch (err) { console.error('[teacher/connections]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // GET /api/teacher/progression/:student_id
  router.get('/api/teacher/progression/:student_id', requireTeacherAuth, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT sp.*, s.nom, s.prenom FROM student_progression sp
        JOIN students s ON s.id = sp.student_id
        WHERE sp.student_id = $1
      `, [req.params.student_id]);
      res.json(result.rows[0] || null);
    } catch (err) { console.error('[teacher/progression]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // PUT /api/teacher/progression/:student_id — le professeur met à jour niveau + page du livre
  router.put('/api/teacher/progression/:student_id', requireTeacherAuth, async (req, res) => {
    try {
      // Seuls les élèves assignés à ce professeur sont modifiables
      const assigned = await pool.query(
        'SELECT 1 FROM teacher_student_assignments WHERE teacher_id = $1 AND student_id = $2',
        [req.teacherId, req.params.student_id]);
      if (!assigned.rowCount) return res.status(403).json({ error: 'Cet élève ne vous est pas assigné.' });

      let { niveau, current_page } = req.body;
      niveau = niveau === undefined || niveau === null || niveau === '' ? null : parseInt(niveau, 10);
      current_page = current_page === undefined || current_page === null || current_page === '' ? null : parseInt(current_page, 10);
      if (niveau !== null && (isNaN(niveau) || niveau < 1 || niveau > 11)) return res.status(400).json({ error: 'Niveau invalide (1 à 11).' });
      if (current_page !== null && (isNaN(current_page) || current_page < 1)) return res.status(400).json({ error: 'Page invalide.' });

      const result = await pool.query(
        `INSERT INTO student_progression (student_id, niveau, current_page, updated_by, updated_at)
         VALUES ($1, COALESCE($2, 1), COALESCE($3, 1), 'teacher', NOW())
         ON CONFLICT (student_id) DO UPDATE SET
           niveau = COALESCE($2, student_progression.niveau),
           current_page = COALESCE($3, student_progression.current_page),
           updated_by = 'teacher', updated_at = NOW()
         RETURNING *`,
        [req.params.student_id, niveau, current_page]);
      res.json(result.rows[0]);
    } catch (err) { console.error('[teacher/update-progression]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // GET /api/teacher/notifications
  router.get('/api/teacher/notifications', requireTeacherAuth, async (req, res) => {
    try {
      const result = await pool.query(`SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50`);
      res.json(result.rows);
    } catch (err) { console.error('[teacher/notifications]', err); res.status(500).json({ error: 'Erreur serveur' }); }
  });

  // GET /api/teacher/notifications/count
  router.get('/api/teacher/notifications/count', requireTeacherAuth, async (req, res) => {
    try {
      const result = await pool.query('SELECT COUNT(*)::int as count FROM notifications');
      res.json({ count: result.rows[0].count });
    } catch (err) { res.json({ count: 0 }); }
  });

  // POST /api/teacher/zoom-call — Start a live Zoom session (teacher selects group or students)
  router.post('/api/teacher/zoom-call', requireTeacherAuth, async (req, res) => {
    try {
      const { studentIds, zoomLink } = req.body;
      if (!zoomLink) return res.status(400).json({ error: 'Lien Zoom requis' });

      // Mark any existing active calls for this teacher as ended
      await pool.query(
        `UPDATE zoom_calls SET active = FALSE, ended_at = NOW() WHERE teacher_id = $1 AND active = TRUE`,
        [req.teacherId]
      );

      const ids = Array.isArray(studentIds) ? studentIds : [];
      const result = await pool.query(
        `INSERT INTO zoom_calls (teacher_id, student_ids, zoom_link)
         VALUES ($1, $2, $3) RETURNING id, started_at`,
        [req.teacherId, JSON.stringify(ids), zoomLink]
      );

      res.json({ id: result.rows[0].id, started_at: result.rows[0].started_at, zoom_link: zoomLink });
    } catch (err) {
      console.error('[teacher/zoom-call]', err);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  return router;
};
// group-sessions.js — API for fetching course sessions related to a group's members
// Owns: GET /api/admin/groups/:id/sessions (returns future sessions where group members are enrolled)
// Does NOT own: session CRUD (see server.js planning section), group membership (see server.js groups section)
'use strict';

const { Router } = require('express');

module.exports = function (pool, requireAdmin) {
    const router = Router();

    // Get future course sessions relevant to this group (sessions where at least one group member is enrolled)
    // Returns them grouped by course_schedule for the enrollment picker UI
    router.get('/groups/:id/sessions', requireAdmin, async (req, res) => {
        const groupId = req.params.id;
        try {
            // Find future sessions where at least one group member is enrolled
            const result = await pool.query(`
                SELECT DISTINCT
                    ss.id AS session_id,
                    ss.schedule_id,
                    ss.course_type,
                    ss.session_date,
                    ss.time_start,
                    ss.time_end,
                    ss.status,
                    ss.notes,
                    cs.title AS schedule_title,
                    t.nom AS teacher_nom,
                    t.prenom AS teacher_prenom
                FROM scheduled_sessions ss
                JOIN session_students sst ON sst.session_id = ss.id
                JOIN group_members gm ON gm.student_id = sst.student_id AND gm.group_id = $1
                LEFT JOIN course_schedules cs ON cs.id = ss.schedule_id
                LEFT JOIN teachers t ON t.id = ss.teacher_id
                WHERE ss.session_date >= CURRENT_DATE
                  AND ss.status != 'cancelled'
                ORDER BY ss.session_date, ss.time_start
            `, [groupId]);

            // Group by schedule_id (null schedule_id = standalone sessions)
            const bySchedule = {};
            for (const row of result.rows) {
                const key = row.schedule_id ? `schedule_${row.schedule_id}` : `standalone_${row.session_id}`;
                if (!bySchedule[key]) {
                    bySchedule[key] = {
                        schedule_id: row.schedule_id,
                        title: row.schedule_title || row.notes || null,
                        course_type: row.course_type,
                        teacher: row.teacher_prenom && row.teacher_nom
                            ? `${row.teacher_prenom} ${row.teacher_nom}`
                            : null,
                        sessions: []
                    };
                }
                bySchedule[key].sessions.push({
                    id: row.session_id,
                    date: row.session_date,
                    time_start: row.time_start,
                    time_end: row.time_end,
                    status: row.status
                });
            }

            res.json(Object.values(bySchedule));
        } catch (err) {
            console.error('Group sessions error:', err);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    // Bulk-enroll a student into multiple sessions at once
    router.post('/groups/:id/enroll', requireAdmin, async (req, res) => {
        const { student_id, session_ids } = req.body;
        if (!student_id || !Array.isArray(session_ids) || session_ids.length === 0) {
            return res.status(400).json({ error: 'student_id et session_ids requis' });
        }
        try {
            // Verify student is in the group
            const memberCheck = await pool.query(
                'SELECT 1 FROM group_members WHERE group_id = $1 AND student_id = $2',
                [req.params.id, student_id]
            );
            if (!memberCheck.rows.length) {
                return res.status(400).json({ error: 'L\'élève n\'est pas membre de ce groupe' });
            }

            let enrolled = 0;
            for (const sessionId of session_ids) {
                const r = await pool.query(
                    'INSERT INTO session_students (session_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [sessionId, student_id]
                );
                if (r.rowCount > 0) enrolled++;
            }
            res.json({ ok: true, enrolled });
        } catch (err) {
            console.error('Group enroll error:', err);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    // Unenroll a student from all future group sessions when they leave the group
    router.post('/groups/:id/unenroll', requireAdmin, async (req, res) => {
        const { student_id } = req.body;
        if (!student_id) return res.status(400).json({ error: 'student_id requis' });
        try {
            // Remove from future sessions where at least one other group member is also enrolled
            // This prevents removing them from sessions they joined independently
            const result = await pool.query(`
                DELETE FROM session_students
                WHERE student_id = $1
                  AND session_id IN (
                    SELECT DISTINCT ss.id
                    FROM scheduled_sessions ss
                    JOIN session_students sst ON sst.session_id = ss.id
                    JOIN group_members gm ON gm.student_id = sst.student_id
                        AND gm.group_id = $2
                        AND gm.student_id != $1
                    WHERE ss.session_date >= CURRENT_DATE
                      AND ss.status != 'cancelled'
                  )
            `, [student_id, req.params.id]);
            res.json({ ok: true, unenrolled: result.rowCount });
        } catch (err) {
            console.error('Group unenroll error:', err);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    return router;
};

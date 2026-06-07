// groups-teacher.js — group management for teachers (with can_edit_planning)
// Owns: CRUD /api/teacher/groups, GET/POST/DELETE /api/teacher/groups/:id/members
// Group creation requires can_edit_planning. Groups are shared — visible to gérant + all teachers.
'use strict';

const { Router } = require('express');
const { syncGroupsFromSchedules } = require('../db/groups');

module.exports = function(pool, requireTeacherAuth) {
    const router = Router();

    // Helper: verify teacher has can_edit_planning permission
    async function requirePlanningPermission(req, res, next) {
        const teacherId = req.teacherId;
        if (!teacherId) return res.status(403).json({ error: 'Permission refusée' });
        try {
            const result = await pool.query(
                'SELECT can_edit_planning FROM teachers WHERE id = $1',
                [teacherId]
            );
            if (!result.rows.length || !result.rows[0].can_edit_planning) {
                return res.status(403).json({ error: 'Permission Planning requise' });
            }
            next();
        } catch (err) {
            res.status(500).json({ error: 'Erreur serveur' });
        }
    }

    // Create a new group (requires can_edit_planning)
    router.post('/groups', requireTeacherAuth, requirePlanningPermission, async (req, res) => {
        const { name, description, color } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ error: 'Nom du groupe requis' });
        try {
            const result = await pool.query(
                'INSERT INTO student_groups (name, description, color) VALUES ($1, $2, $3) RETURNING *',
                [name.trim(), description || null, color || '#1B5E3A']
            );
            res.status(201).json(result.rows[0]);
        } catch (err) {
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    // List all groups with member count (teacher view — read only requires auth, no planning perm needed)
    // Lazy-syncs student_groups from course_schedules with 2+ students before fetching.
    router.get('/groups', requireTeacherAuth, async (req, res) => {
        try {
            // Ensure groups derived from course schedules exist before querying
            await syncGroupsFromSchedules(pool);

            const result = await pool.query(`
                SELECT sg.id, sg.name, sg.description, sg.color, sg.created_at,
                    COUNT(gm.student_id)::int AS member_count
                FROM student_groups sg
                LEFT JOIN group_members gm ON gm.group_id = sg.id
                GROUP BY sg.id
                ORDER BY sg.created_at DESC
            `);
            res.json(result.rows);
        } catch (err) {
            console.error('Teacher groups list error:', err);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    // Get members of a group (teacher view)
    router.get('/groups/:id/members', requireTeacherAuth, async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT s.id, s.nom, s.prenom, s.kounia, s.whatsapp, s.email, gm.added_at
                FROM group_members gm
                JOIN students s ON s.id = gm.student_id
                WHERE gm.group_id = $1
                ORDER BY s.nom, s.prenom
            `, [req.params.id]);
            res.json(result.rows);
        } catch (err) {
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    // Add member to group (requires can_edit_planning)
    router.post('/groups/:id/members', requireTeacherAuth, requirePlanningPermission, async (req, res) => {
        const { student_id } = req.body;
        if (!student_id) return res.status(400).json({ error: 'student_id requis' });
        try {
            await pool.query(
                'INSERT INTO group_members (group_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [req.params.id, student_id]
            );
            res.json({ ok: true });
        } catch (err) {
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    // Remove member from group (requires can_edit_planning)
    router.delete('/groups/:id/members/:student_id', requireTeacherAuth, requirePlanningPermission, async (req, res) => {
        try {
            await pool.query(
                'DELETE FROM group_members WHERE group_id=$1 AND student_id=$2',
                [req.params.id, req.params.student_id]
            );
            res.json({ ok: true });
        } catch (err) {
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    // Get future sessions relevant to this group (where at least one member is enrolled)
    router.get('/groups/:id/sessions', requireTeacherAuth, requirePlanningPermission, async (req, res) => {
        const groupId = req.params.id;
        try {
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
            console.error('Teacher group sessions error:', err);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    // Bulk-enroll a student into multiple sessions
    router.post('/groups/:id/enroll', requireTeacherAuth, requirePlanningPermission, async (req, res) => {
        const { student_id, session_ids } = req.body;
        if (!student_id || !Array.isArray(session_ids) || session_ids.length === 0) {
            return res.status(400).json({ error: 'student_id et session_ids requis' });
        }
        try {
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
            console.error('Teacher group enroll error:', err);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    // Unenroll a student from future group sessions (when removing from group)
    router.post('/groups/:id/unenroll', requireTeacherAuth, requirePlanningPermission, async (req, res) => {
        const { student_id } = req.body;
        if (!student_id) return res.status(400).json({ error: 'student_id requis' });
        try {
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
            console.error('Teacher group unenroll error:', err);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    return router;
};

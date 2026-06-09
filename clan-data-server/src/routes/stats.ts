import { Router } from 'express';
import { db } from '../db';
import { routeError } from '../lib/routeError';

const router = Router();

const PERIODS: Record<string, string | null> = {
  today: '-1 day',
  week: '-7 days',
  month: '-30 days',
  all_time: null,
};

function periodFilter(period: string): { condition: string; args: unknown[] } {
  const offset = PERIODS[period];
  if (offset === undefined) return periodFilter('week');
  if (offset === null) return { condition: '', args: [] };
  return { condition: `AND s.occurred_at >= datetime('now', ?)`, args: [offset] };
}

router.get('/clan', async (req, res) => {
  const period = String(req.query.period ?? 'week');
  const { condition, args } = periodFilter(period);

  try {
    const totals = await db.get(
      `SELECT COUNT(*) as session_count, COUNT(DISTINCT s.member_id) as active_members
         FROM uploaded_sessions s
         JOIN members m ON s.member_id = m.id
        WHERE m.status = 'approved' ${condition}`,
      args,
    );

    const byType = await db.all(
      `SELECT s.session_type, COUNT(*) as count
         FROM uploaded_sessions s
         JOIN members m ON s.member_id = m.id
        WHERE m.status = 'approved' ${condition}
        GROUP BY s.session_type
        ORDER BY count DESC`,
      args,
    );

    const memberCount = await db.get('SELECT COUNT(*) as count FROM members');

    res.json({
      period: PERIODS[period] !== undefined ? period : 'week',
      sessionCount: totals?.session_count ?? 0,
      activeMembers: totals?.active_members ?? 0,
      memberCount: memberCount?.count ?? 0,
      sessionsByType: byType,
    });
  } catch (e: unknown) { routeError(res, e); }
});

router.get('/member/:username', async (req, res) => {
  try {
    const member = await db.get(
      'SELECT id, username, first_seen, last_seen FROM members WHERE username = ?',
      [req.params.username],
    );
    if (!member) { res.status(404).json({ error: 'Member not found' }); return; }

    const [sessionsByType, activityByType, recentActivity] = await Promise.all([
      db.all(
        `SELECT session_type, COUNT(*) AS count
           FROM uploaded_sessions WHERE member_id = ?
          GROUP BY session_type ORDER BY count DESC`,
        [member.id],
      ),
      db.all(
        `SELECT activity_type, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total_amount
           FROM activity_log WHERE member_id = ?
          GROUP BY activity_type ORDER BY count DESC`,
        [member.id],
      ),
      db.all(
        `SELECT activity_type, description, amount, occurred_at
           FROM activity_log WHERE member_id = ?
          ORDER BY occurred_at DESC LIMIT 20`,
        [member.id],
      ),
    ]);

    res.json({ ...member, sessionsByType, activityByType, recentActivity });
  } catch (e: unknown) { routeError(res, e); }
});

router.get('/activity/recent', async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);

  try {
    const rows = await db.all(
      `SELECT a.activity_type, a.description, a.amount, a.occurred_at, m.username
         FROM activity_log a
         LEFT JOIN members m ON m.id = a.member_id
        ORDER BY a.occurred_at DESC
        LIMIT ?`,
      [limit]
    );
    res.json(rows);
  } catch (e: unknown) { routeError(res, e); }
});

export default router;

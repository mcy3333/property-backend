import { Router } from 'express';
import { get, all } from '../db/database.js';
import { authMiddleware, adminOnly } from '../middleware/auth.js';

const router = Router();

// GET /api/users - 用户列表（管理员）
router.get('/', authMiddleware, adminOnly, (req, res) => {
  try {
    const { community_id, role } = req.query;

    let sql = `SELECT id, username, name, phone, role, community_id, building_id, unit, room_no, created_at FROM users WHERE 1=1`;
    const params = [];

    if (community_id) { sql += ' AND community_id = ?'; params.push(community_id); }
    if (role) { sql += ' AND role = ?'; params.push(role); }
    sql += ' ORDER BY created_at DESC';

    res.json(all(sql, params));
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/users/buildings
router.get('/buildings', authMiddleware, (req, res) => {
  try {
    const communityId = req.query.community_id || req.user.community_id || 'c001';
    res.json(all('SELECT * FROM buildings WHERE community_id = ? ORDER BY name', [communityId]));
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/users/community
router.get('/community', authMiddleware, (req, res) => {
  try {
    const communityId = req.query.community_id || req.user.community_id || 'c001';
    const community = get('SELECT * FROM communities WHERE id = ?', [communityId]);
    if (!community) return res.status(404).json({ error: '小区不存在' });
    res.json(community);
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/users/stats
router.get('/stats', authMiddleware, adminOnly, (req, res) => {
  try {
    const communityId = req.query.community_id || 'c001';

    const userCount = get('SELECT COUNT(*) as c FROM users WHERE community_id = ?', [communityId]);
    const ownerCount = get('SELECT COUNT(*) as c FROM users WHERE community_id = ? AND role = ?', [communityId, 'owner']);
    const pendingRepairs = get(`SELECT COUNT(*) as c FROM repairs WHERE community_id = ? AND status IN ('pending','processing')`, [communityId]);
    const unpaidFees = get('SELECT COUNT(*) as c, SUM(amount) as t FROM fees WHERE community_id = ? AND status = ?', [communityId, 'unpaid']);

    res.json({
      userCount: userCount?.c || 0,
      ownerCount: ownerCount?.c || 0,
      pendingRepairs: pendingRepairs?.c || 0,
      unpaidCount: unpaidFees?.c || 0,
      unpaidAmount: unpaidFees?.t || 0
    });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

export default router;

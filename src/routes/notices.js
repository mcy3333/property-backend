import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { get, all, run, datetime } from '../db/database.js';
import { authMiddleware, adminOnly } from '../middleware/auth.js';

const router = Router();

// GET /api/notices - 获取公告列表
router.get('/', authMiddleware, (req, res) => {
  try {
    const communityId = req.query.community_id;
    const type = req.query.type;

    let sql = `SELECT n.*, u.name as author_name FROM notices n
               LEFT JOIN users u ON n.author_id = u.id WHERE 1=1`;
    const params = [];

    if (communityId) { sql += ' AND n.community_id = ?'; params.push(communityId); }
    if (type) { sql += ' AND n.type = ?'; params.push(type); }
    sql += ' ORDER BY n.created_at DESC';

    const notices = all(sql, params);
    const userId = req.user.id;
    const readRows = all('SELECT notice_id FROM notice_reads WHERE user_id = ?', [userId]);
    const readSet = new Set(readRows.map(r => r.notice_id));

    const result = notices.map(n => ({ ...n, isRead: readSet.has(n.id) }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/notices/unread-count
router.get('/unread-count', authMiddleware, (req, res) => {
  try {
    const communityId = req.query.community_id;
    const userId = req.user.id;

    let sql = `SELECT COUNT(*) as count FROM notices n
               WHERE n.id NOT IN (SELECT notice_id FROM notice_reads WHERE user_id = ?)`;
    const params = [userId];

    if (communityId) { sql += ' AND n.community_id = ?'; params.push(communityId); }

    const result = get(sql, params);
    res.json({ count: result?.count || 0 });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/notices/:id
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const notice = get(`
      SELECT n.*, u.name as author_name FROM notices n
      LEFT JOIN users u ON n.author_id = u.id WHERE n.id = ?`, [req.params.id]);

    if (!notice) return res.status(404).json({ error: '公告不存在' });

    const existing = get('SELECT 1 FROM notice_reads WHERE notice_id = ? AND user_id = ?',
      [req.params.id, req.user.id]);
    if (!existing) {
      run('INSERT INTO notice_reads (notice_id, user_id) VALUES (?, ?)',
        [req.params.id, req.user.id]);
    }

    res.json(notice);
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/notices - 创建公告（管理员）
router.post('/', authMiddleware, adminOnly, (req, res) => {
  try {
    const { title, content, type, community_id } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: '标题和内容不能为空' });
    }

    const id = uuidv4();
    run(
      `INSERT INTO notices (id, community_id, title, content, type, author_id) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, community_id || req.user.community_id || 'c001', title, content, type || 'general', req.user.id]
    );

    res.json({ success: true, id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

export default router;

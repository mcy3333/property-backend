import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { get, all, run } from '../db/database.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// GET /api/visitors
router.get('/', authMiddleware, (req, res) => {
  try {
    let sql = 'SELECT * FROM visitors WHERE 1=1';
    const params = [];

    if (req.user.role !== 'admin') {
      sql += ' AND user_id = ?';
      params.push(req.user.id);
    }
    if (req.query.community_id) {
      sql += ' AND community_id = ?';
      params.push(req.query.community_id);
    }
    sql += ' ORDER BY created_at DESC';

    res.json(all(sql, params));
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/visitors
router.post('/', authMiddleware, (req, res) => {
  try {
    const { visitor_name, visitor_phone, visit_date, visit_time_start, visit_time_end, purpose } = req.body;
    if (!visitor_name) return res.status(400).json({ error: '访客姓名不能为空' });

    const id = uuidv4();
    const code = generateCode();
    const communityId = req.user.community_id || 'c001';

    run(
      `INSERT INTO visitors (id, user_id, community_id, visitor_name, visitor_phone, visit_date, visit_time_start, visit_time_end, purpose, code, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [id, req.user.id, communityId, visitor_name, visitor_phone || null,
       visit_date || null, visit_time_start || null, visit_time_end || null, purpose || null, code]
    );

    const visitor = get('SELECT * FROM visitors WHERE id = ?', [id]);
    res.json(visitor);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/visitors/:id
router.put('/:id', authMiddleware, (req, res) => {
  try {
    const visitor = get('SELECT * FROM visitors WHERE id = ?', [req.params.id]);
    if (!visitor) return res.status(404).json({ error: '记录不存在' });

    if (req.user.role !== 'admin' && visitor.user_id !== req.user.id) {
      return res.status(403).json({ error: '无权操作' });
    }

    const { visit_date, visit_time_start, visit_time_end, purpose } = req.body;
    run(
      `UPDATE visitors SET visit_date = ?, visit_time_start = ?, visit_time_end = ?, purpose = ? WHERE id = ?`,
      [visit_date || null, visit_time_start || null, visit_time_end || null, purpose || null, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/visitors/:id
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const visitor = get('SELECT * FROM visitors WHERE id = ?', [req.params.id]);
    if (!visitor) return res.status(404).json({ error: '记录不存在' });

    if (req.user.role !== 'admin' && visitor.user_id !== req.user.id) {
      return res.status(403).json({ error: '无权操作' });
    }

    run('DELETE FROM visitors WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

export default router;

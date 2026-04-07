import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { get, all, run, datetime } from '../db/database.js';
import { authMiddleware, adminOnly } from '../middleware/auth.js';

const router = Router();

function parseRepairImages(repair) {
  if (!repair) return null;
  try {
    return { ...repair, images: repair.images ? JSON.parse(repair.images) : [] };
  } catch (e) {
    return { ...repair, images: [] };
  }
}

// GET /api/repairs
router.get('/', authMiddleware, (req, res) => {
  try {
    const { status, community_id } = req.query;

    let sql = `SELECT r.*, u.name as owner_name, u.phone as owner_phone, u.room_no
               FROM repairs r LEFT JOIN users u ON r.user_id = u.id WHERE 1=1`;
    const params = [];

    if (req.user.role !== 'admin') {
      sql += ' AND r.user_id = ?';
      params.push(req.user.id);
    }
    if (status) { sql += ' AND r.status = ?'; params.push(status); }
    if (community_id) { sql += ' AND r.community_id = ?'; params.push(community_id); }
    sql += ' ORDER BY r.created_at DESC';

    const repairs = all(sql, params).map(parseRepairImages);
    res.json(repairs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/repairs/:id
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const repair = get(`
      SELECT r.*, u.name as owner_name, u.phone as owner_phone, u.room_no
      FROM repairs r LEFT JOIN users u ON r.user_id = u.id WHERE r.id = ?`, [req.params.id]);

    if (!repair) return res.status(404).json({ error: '报修不存在' });

    if (req.user.role !== 'admin' && repair.user_id !== req.user.id) {
      return res.status(403).json({ error: '无权查看' });
    }

    const progress = all('SELECT * FROM repair_progress WHERE repair_id = ? ORDER BY created_at ASC', [req.params.id]);
    res.json({ ...parseRepairImages(repair), progress });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/repairs
router.post('/', authMiddleware, (req, res) => {
  try {
    const { title, description, category, images } = req.body;
    if (!title) return res.status(400).json({ error: '报修标题不能为空' });

    const id = uuidv4();
    const communityId = req.user.community_id || 'c001';

    run(
      `INSERT INTO repairs (id, user_id, community_id, title, description, category, images, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [id, req.user.id, communityId, title, description || '', category || 'general',
       images ? JSON.stringify(images) : null]
    );

    run('INSERT INTO repair_progress (id, repair_id, step, message) VALUES (?, ?, ?, ?)',
      [uuidv4(), id, 'submit', '业主提交了报修申请']);

    res.json({ success: true, id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/repairs/:id
router.put('/:id', authMiddleware, adminOnly, (req, res) => {
  try {
    const repair = get('SELECT * FROM repairs WHERE id = ?', [req.params.id]);
    if (!repair) return res.status(404).json({ error: '报修不存在' });

    const { status, handler_name, handler_phone, handler_remark } = req.body;
    const now = datetime();

    const fields = [];
    const params = [];

    if (status !== undefined) {
      fields.push('status = ?');
      params.push(status);
      if (status === 'completed') {
        fields.push('completed_at = ?');
        params.push(now);
      }
    }
    if (handler_name !== undefined) { fields.push('handler_name = ?'); params.push(handler_name); }
    if (handler_phone !== undefined) { fields.push('handler_phone = ?'); params.push(handler_phone); }
    if (handler_remark !== undefined) { fields.push('handler_remark = ?'); params.push(handler_remark); }
    fields.push('updated_at = ?');
    params.push(now);
    params.push(req.params.id);

    run(`UPDATE repairs SET ${fields.join(', ')} WHERE id = ?`, params);

    const stepMessages = {
      assigned: `已派单：${handler_name || repair.handler_name || '待指派'}`,
      processing: '维修中',
      completed: '维修完成',
      cancelled: '已取消'
    };

    if (stepMessages[status]) {
      run('INSERT INTO repair_progress (id, repair_id, step, message, operator_id) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), req.params.id, status, stepMessages[status], req.user.id]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/repairs/:id/rate
router.post('/:id/rate', authMiddleware, (req, res) => {
  try {
    const { rating } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: '评分为1-5星' });
    }

    const repair = get('SELECT * FROM repairs WHERE id = ?', [req.params.id]);
    if (!repair) return res.status(404).json({ error: '报修不存在' });
    if (repair.user_id !== req.user.id) return res.status(403).json({ error: '无权评价' });

    run('UPDATE repairs SET rating = ? WHERE id = ?', [rating, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

export default router;

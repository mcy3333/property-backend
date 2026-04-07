import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { get, all, run, datetime } from '../db/database.js';
import { authMiddleware, adminOnly } from '../middleware/auth.js';

const router = Router();

// GET /api/fees
router.get('/', authMiddleware, (req, res) => {
  try {
    const { status, community_id } = req.query;

    let sql = 'SELECT * FROM fees WHERE 1=1';
    const params = [];

    if (req.user.role !== 'admin') {
      sql += ' AND user_id = ?';
      params.push(req.user.id);
    }
    if (status) { sql += ' AND status = ?'; params.push(status); }
    if (community_id) { sql += ' AND community_id = ?'; params.push(community_id); }
    sql += ' ORDER BY created_at DESC';

    const fees = all(sql, params);
    const stats = {
      total: fees.length,
      unpaid: fees.filter(f => f.status === 'unpaid').reduce((sum, f) => sum + (f.amount || 0), 0),
      paid: fees.filter(f => f.status === 'paid').reduce((sum, f) => sum + (f.amount || 0), 0)
    };

    res.json({ fees, stats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/fees/:id
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const fee = get('SELECT * FROM fees WHERE id = ?', [req.params.id]);
    if (!fee) return res.status(404).json({ error: '账单不存在' });

    if (req.user.role !== 'admin' && fee.user_id !== req.user.id) {
      return res.status(403).json({ error: '无权查看' });
    }
    res.json(fee);
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/fees
router.post('/', authMiddleware, adminOnly, (req, res) => {
  try {
    const { user_id, title, amount, period, due_date, community_id } = req.body;
    if (!user_id || !title || !amount) {
      return res.status(400).json({ error: '参数不完整' });
    }

    const id = uuidv4();
    run(
      `INSERT INTO fees (id, user_id, community_id, title, amount, period, due_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'unpaid')`,
      [id, user_id, community_id || req.user.community_id || 'c001', title, amount, period || null, due_date || null]
    );

    res.json({ success: true, id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/fees/:id/pay
router.post('/:id/pay', authMiddleware, (req, res) => {
  try {
    const fee = get('SELECT * FROM fees WHERE id = ?', [req.params.id]);
    if (!fee) return res.status(404).json({ error: '账单不存在' });

    if (req.user.role !== 'admin' && fee.user_id !== req.user.id) {
      return res.status(403).json({ error: '无权操作' });
    }

    run("UPDATE fees SET status = ?, paid_at = ? WHERE id = ?",
      ['paid', datetime(), req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/fees/pay-all
router.post('/pay-all', authMiddleware, (req, res) => {
  try {
    let sql = "UPDATE fees SET status = 'paid', paid_at = ? WHERE status = 'unpaid'";
    const params = [datetime()];

    if (req.user.role !== 'admin') {
      sql += ' AND user_id = ?';
      params.push(req.user.id);
    }
    if (req.body.community_id) {
      sql += ' AND community_id = ?';
      params.push(req.body.community_id);
    }

    const result = run(sql, params);
    res.json({ success: true, count: result.changes });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

export default router;

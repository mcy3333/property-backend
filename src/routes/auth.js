import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { get, run, datetime } from '../db/database.js';
import { generateToken, authMiddleware } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    const user = get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const token = generateToken(user);
    const { password: _, ...userInfo } = user;

    res.json({ success: true, token, user: userInfo });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  try {
    const user = get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    const { password: _, ...userInfo } = user;
    res.json(userInfo);
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/auth/register
router.post('/register', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: '仅管理员可注册用户' });
    }

    const { username, password, name, phone, role, community_id, building_id, unit, room_no } = req.body;
    if (!username || !password || !name) {
      return res.status(400).json({ error: '用户名、密码、姓名不能为空' });
    }

    const existing = get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return res.status(400).json({ error: '用户名已存在' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const id = uuidv4();

    run(
      `INSERT INTO users (id, username, password, name, phone, role, community_id, building_id, unit, room_no)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, username, hashedPassword, name, phone || null, role || 'owner',
       community_id || null, building_id || null, unit || null, room_no || null]
    );

    res.json({ success: true, id });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT /api/auth/password
router.put('/password', authMiddleware, (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: '请填写完整' });
    }

    const user = get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!bcrypt.compareSync(oldPassword, user.password)) {
      return res.status(400).json({ error: '原密码错误' });
    }

    const hashed = bcrypt.hashSync(newPassword, 10);
    run('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

export default router;

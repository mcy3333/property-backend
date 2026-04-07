import express from 'express';
import cors from 'cors';
import { initPromise, get, all, run } from './db/database.js';

const app = express();
const PORT = process.env.PORT || 3001;

// 等待数据库初始化
await initPromise;

// CORS：允许前端域名（优先读环境变量，本地开发兼容）
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173'];

app.use(cors({
  origin: (origin, callback) => {
    // 允许无 origin 请求（如 Postman）或匹配白名单
    if (!origin || allowedOrigins.some(o => origin.startsWith(o))) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed: ' + origin));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 统计概览
app.get('/api/overview', (req, res) => {
  try {
    const communityId = req.query.community_id || 'c001';
    const notices = get(`SELECT COUNT(*) as c FROM notices WHERE community_id = ?`, [communityId]);
    const repairs = get(`SELECT COUNT(*) as c FROM repairs WHERE community_id = ? AND status != 'completed'`, [communityId]);
    const unpaidFees = get(`SELECT COUNT(*) as c, SUM(amount) as t FROM fees WHERE community_id = ? AND status = 'unpaid'`, [communityId]);
    const today = new Date().toISOString().split('T')[0];
    const visitors = get(`SELECT COUNT(*) as c FROM visitors WHERE community_id = ? AND created_at >= ?`, [communityId, today]);

    res.json({
      noticeCount: notices?.c || 0,
      pendingRepairs: repairs?.c || 0,
      unpaidCount: unpaidFees?.c || 0,
      unpaidAmount: unpaidFees?.t || 0,
      todayVisitors: visitors?.c || 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 动态导入路由
const authRoutes = (await import('./routes/auth.js')).default;
const noticeRoutes = (await import('./routes/notices.js')).default;
const repairRoutes = (await import('./routes/repairs.js')).default;
const feeRoutes = (await import('./routes/fees.js')).default;
const visitorRoutes = (await import('./routes/visitors.js')).default;
const userRoutes = (await import('./routes/users.js')).default;

app.use('/api/auth', authRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/repairs', repairRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/visitors', visitorRoutes);
app.use('/api/users', userRoutes);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🏠 物业管理后端服务已启动`);
  console.log(`📡 API地址: http://0.0.0.0:${PORT}`);
  console.log(`📋 健康检查: http://0.0.0.0:${PORT}/api/health`);
  console.log('');
});

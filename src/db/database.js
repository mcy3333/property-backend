import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '../../data/property.db');

// 确保 data 目录存在
try {
  mkdirSync(join(__dirname, '../../data'), { recursive: true });
} catch (e) {}

let db = null;

// 数据库表定义
const SCHEMA = `
-- 小区表
CREATE TABLE IF NOT EXISTS communities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 楼栋表
CREATE TABLE IF NOT EXISTS buildings (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL,
  name TEXT NOT NULL,
  floors INTEGER DEFAULT 1,
  units INTEGER DEFAULT 1,
  FOREIGN KEY (community_id) REFERENCES communities(id)
);

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  id_card TEXT,
  role TEXT DEFAULT 'owner',
  community_id TEXT,
  building_id TEXT,
  unit INTEGER,
  room_no TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (community_id) REFERENCES communities(id),
  FOREIGN KEY (building_id) REFERENCES buildings(id)
);

-- 公告表
CREATE TABLE IF NOT EXISTS notices (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'general',
  author_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (community_id) REFERENCES communities(id)
);

-- 公告阅读记录
CREATE TABLE IF NOT EXISTS notice_reads (
  notice_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  read_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (notice_id, user_id)
);

-- 报修表
CREATE TABLE IF NOT EXISTS repairs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  community_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  images TEXT,
  status TEXT DEFAULT 'pending',
  handler_id TEXT,
  handler_name TEXT,
  handler_phone TEXT,
  handler_remark TEXT,
  rating INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (community_id) REFERENCES communities(id)
);

-- 报修进度
CREATE TABLE IF NOT EXISTS repair_progress (
  id TEXT PRIMARY KEY,
  repair_id TEXT NOT NULL,
  step TEXT NOT NULL,
  message TEXT,
  operator_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (repair_id) REFERENCES repairs(id)
);

-- 账单表
CREATE TABLE IF NOT EXISTS fees (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  community_id TEXT NOT NULL,
  title TEXT NOT NULL,
  amount REAL NOT NULL,
  period TEXT,
  due_date TEXT,
  status TEXT DEFAULT 'unpaid',
  paid_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (community_id) REFERENCES communities(id)
);

-- 访客表
CREATE TABLE IF NOT EXISTS visitors (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  community_id TEXT NOT NULL,
  visitor_name TEXT NOT NULL,
  visitor_phone TEXT,
  visit_date TEXT,
  visit_time_start TEXT,
  visit_time_end TEXT,
  purpose TEXT,
  code TEXT UNIQUE,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (community_id) REFERENCES communities(id)
);
`;

// 初始化数据库
async function initDB() {
  const SQL = await initSqlJs();

  let data = null;
  if (existsSync(DB_PATH)) {
    try {
      data = readFileSync(DB_PATH);
    } catch (e) {
      data = null;
    }
  }

  db = new SQL.Database(data);

  // 执行建表
  db.run(SCHEMA);

  // 检查是否已有数据
  const result = db.exec('SELECT COUNT(*) as count FROM users');
  const count = result.length > 0 ? result[0].values[0][0] : 0;

  if (count === 0) {
    console.log('正在初始化演示数据...');
    initDemoData();
  }

  // 每次修改后自动保存
  saveDB();

  return db;
}

function initDemoData() {
  const adminId = 'admin001';
  const adminPassword = bcrypt.hashSync('admin123', 10);
  const ownerPassword = bcrypt.hashSync('owner123', 10);

  // 小区
  db.run(`INSERT INTO communities (id, name, address) VALUES (?, ?, ?)`,
    ['c001', '阳光花园小区', '北京市朝阳区望京街道88号']);

  // 楼栋
  db.run(`INSERT INTO buildings (id, community_id, name, floors, units) VALUES (?, ?, ?, ?, ?)`,
    ['b001', 'c001', '1号楼', 18, 2]);
  db.run(`INSERT INTO buildings (id, community_id, name, floors, units) VALUES (?, ?, ?, ?, ?)`,
    ['b002', 'c001', '2号楼', 18, 2]);

  // 管理员
  db.run(`INSERT INTO users (id, username, password, name, phone, role, community_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [adminId, 'admin', adminPassword, '系统管理员', '13800138000', 'admin', 'c001']);

  // 业主
  db.run(`INSERT INTO users (id, username, password, name, phone, role, community_id, building_id, unit, room_no) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['owner001', 'owner1', ownerPassword, '张三', '13900139001', 'owner', 'c001', 'b001', 1, '101']);
  db.run(`INSERT INTO users (id, username, password, name, phone, role, community_id, building_id, unit, room_no) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['owner002', 'owner2', ownerPassword, '李四', '13900139002', 'owner', 'c001', 'b001', 1, '102']);

  // 公告
  db.run(`INSERT INTO notices (id, community_id, title, content, type, author_id) VALUES (?, ?, ?, ?, ?, ?)`,
    ['n001', 'c001', '关于清明节放假的通知', '各位业主：清明节假期为4月4日至4月6日，共3天。物业服务中心正常值班，联系电话：010-12345678。祝大家节日愉快！', 'important', adminId]);
  db.run(`INSERT INTO notices (id, community_id, title, content, type, author_id) VALUES (?, ?, ?, ?, ?, ?)`,
    ['n002', 'c001', '小区绿化改造通知', '为进一步提升小区环境品质，我司计划于4月10日起对小区公共区域进行绿化升级改造，届时部分区域可能临时封闭，请各位业主配合。', 'general', adminId]);
  db.run(`INSERT INTO notices (id, community_id, title, content, type, author_id) VALUES (?, ?, ?, ?, ?, ?)`,
    ['n003', 'c001', '电梯维保通知', '本月电梯例行维保时间为4月15日凌晨0:00-6:00，届时1号楼电梯将暂停使用。给您带来不便敬请谅解！', 'notice', adminId]);

  // 报修
  db.run(`INSERT INTO repairs (id, user_id, community_id, title, description, category, status, handler_name, handler_phone, handler_remark, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['r001', 'owner001', 'c001', '厨房水龙头漏水', '厨房水槽左侧水龙头滴水，已持续2天', 'water', 'completed', '王师傅', '13811112222', '已更换阀芯，问题解决', datetime()]);
  db.run(`INSERT INTO repairs (id, user_id, community_id, title, description, category, status, handler_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['r002', 'owner001', 'c001', '门禁卡消磁', '业主门禁卡无法刷卡开门', 'door', 'processing', '李主管']);
  db.run(`INSERT INTO repairs (id, user_id, community_id, title, description, category, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['r003', 'owner001', 'c001', '楼道灯不亮', '2单元6楼楼道灯不亮，影响出行', 'electric', 'pending']);

  // 账单
  db.run(`INSERT INTO fees (id, user_id, community_id, title, amount, period, status, paid_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['f001', 'owner001', 'c001', '2026年3月物业费', 350, '2026-03', 'paid', '2026-03-15']);
  db.run(`INSERT INTO fees (id, user_id, community_id, title, amount, period, status, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['f002', 'owner001', 'c001', '2026年4月物业费', 350, '2026-04', 'unpaid', '2026-04-30']);
  db.run(`INSERT INTO fees (id, user_id, community_id, title, amount, period, status, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['f003', 'owner001', 'c001', '2026年第一季度水电费', 280, '2026-Q1', 'unpaid', '2026-04-15']);
  db.run(`INSERT INTO fees (id, user_id, community_id, title, amount, period, status, paid_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['f004', 'owner001', 'c001', '2026年3月车位费', 300, '2026-03', 'paid', '2026-03-18']);

  // 访客
  db.run(`INSERT INTO visitors (id, user_id, community_id, visitor_name, visitor_phone, purpose, code, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['v001', 'owner001', 'c001', '王亲戚', '13988880001', '探亲', 'A1B2C3', 'used']);
  db.run(`INSERT INTO visitors (id, user_id, community_id, visitor_name, visitor_phone, purpose, code, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['v002', 'owner001', 'c001', '快递员张', '13988880002', '快递签收', 'D4E5F6', 'active']);

  console.log('');
  console.log('========== 测试账号 ==========');
  console.log('管理员：admin / admin123');
  console.log('业主1：owner1 / owner123');
  console.log('业主2：owner2 / owner123');
  console.log('==============================');
}

function datetime() {
  return new Date().toISOString();
}

function saveDB() {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    writeFileSync(DB_PATH, buffer);
  } catch (e) {
    console.error('保存数据库失败:', e.message);
  }
}

// 便捷查询方法
function get(sql, params = []) {
  const result = db.exec(sql, params);
  if (result.length === 0 || result[0].values.length === 0) return null;
  const columns = result[0].columns;
  const values = result[0].values[0];
  const obj = {};
  columns.forEach((col, i) => obj[col] = values[i]);
  return obj;
}

function all(sql, params = []) {
  const result = db.exec(sql, params);
  if (result.length === 0) return [];
  const columns = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => obj[col] = row[i]);
    return obj;
  });
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDB();
  return { changes: db.getRowsModified() };
}

// 等待初始化
let initPromise = initDB();

export { db, get, all, run, datetime, initPromise, saveDB };
export default { get, all, run, datetime, initPromise };

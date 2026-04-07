const API_BASE = 'http://localhost:3001/api';

class ApiService {
  constructor() {
    this.token = localStorage.getItem('token');
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  async request(method, path, body = null) {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const options = { method, headers };
    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const res = await fetch(`${API_BASE}${path}`, options);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || '请求失败');
    }
    return data;
  }

  get(path) { return this.request('GET', path); }
  post(path, body) { return this.request('POST', path, body); }
  put(path, body) { return this.request('PUT', path, body); }
  delete(path) { return this.request('DELETE', path); }

  // ===== 认证 =====
  async login(username, password) {
    const data = await this.post('/auth/login', { username, password });
    this.setToken(data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
  }

  logout() {
    this.setToken(null);
    localStorage.removeItem('user');
  }

  getUser() {
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  }

  isLoggedIn() {
    return !!this.token;
  }

  // ===== 首页概览 =====
  async getOverview(communityId = 'c001') {
    return this.get(`/overview?community_id=${communityId}`);
  }

  // ===== 公告 =====
  async getNotices(communityId) {
    const params = new URLSearchParams();
    if (communityId) params.append('community_id', communityId);
    return this.get(`/notices?${params}`);
  }

  async getNotice(id) { return this.get(`/notices/${id}`); }
  async getUnreadCount(communityId) {
    return this.get(`/notices/unread-count?community_id=${communityId}`);
  }
  async createNotice(data) { return this.post('/notices', data); }

  // ===== 报修 =====
  async getRepairs(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.get(`/repairs${q ? '?' + q : ''}`);
  }
  async getRepair(id) { return this.get(`/repairs/${id}`); }
  async createRepair(data) { return this.post('/repairs', data); }
  async updateRepair(id, data) { return this.put(`/repairs/${id}`, data); }
  async rateRepair(id, rating) { return this.post(`/repairs/${id}/rate`, { rating }); }

  // ===== 账单 =====
  async getFees(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.get(`/fees${q ? '?' + q : ''}`);
  }
  async payFee(id) { return this.post(`/fees/${id}/pay`); }
  async payAllFees(communityId) {
    return this.post('/fees/pay-all', { community_id: communityId });
  }

  // ===== 访客 =====
  async getVisitors(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.get(`/visitors${q ? '?' + q : ''}`);
  }
  async createVisitor(data) { return this.post('/visitors', data); }
  async updateVisitor(id, data) { return this.put(`/visitors/${id}`, data); }
  async deleteVisitor(id) { return this.delete(`/visitors/${id}`); }

  // ===== 管理（管理员） =====
  async getUsers(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.get(`/users${q ? '?' + q : ''}`);
  }
  async getStats(communityId) { return this.get(`/users/stats?community_id=${communityId}`); }
  async getCommunity(communityId) { return this.get(`/users/community?community_id=${communityId}`); }
  async getBuildings(communityId) { return this.get(`/users/buildings?community_id=${communityId}`); }
}

export default new ApiService();

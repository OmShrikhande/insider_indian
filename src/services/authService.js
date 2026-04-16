const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:11000';

class AuthService {
  async request(endpoint, method, payload) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Server error');
    return data.data;
  }

  async login(username, password) {
    const data = await this.request('/api/auth/login', 'POST', { username, password });
    if (data.token) localStorage.setItem('roxey_token', JSON.stringify(data));
    return data;
  }

  async register(username, password) {
    const data = await this.request('/api/auth/register', 'POST', { username, password });
    if (data.token) localStorage.setItem('roxey_token', JSON.stringify(data));
    return data;
  }

  logout() {
    localStorage.removeItem('roxey_token');
  }

  getCurrentUser() {
    return JSON.parse(localStorage.getItem('roxey_token'));
  }
}

export default new AuthService();

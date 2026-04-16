// API Service for Stock Data
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:11000';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;

    let token = null;
    try {
      const stored = localStorage.getItem('roxey_token');
      if (stored) token = JSON.parse(stored).token;
    } catch (e) {}

    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  // Get stock data for a symbol — fetches all available data by default
  async getStockData(symbol, timeframe = '1h', limit = 100000) {
    return this.request(`/api/stocks/${symbol}?timeframe=${timeframe}&limit=${limit}`);
  }

  // Search symbols from stocks_summary
  async searchSymbols(query) {
    return this.request(`/api/stocks/search/all?q=${encodeURIComponent(query)}`);
  }

  // Get latest news from ClickHouse DB
  async getLatestNews(search = '', sort = 'desc') {
    return this.request(`/api/stocks/news/latest?q=${encodeURIComponent(search)}&sort=${sort}`);
  }

  // Get futuristic trades
  async getFuturisticTrades() {
    return this.request('/api/stocks/trades/futuristic');
  }

  // Get available symbols
  async getAvailableSymbols(timeframe = '1h') {
    return this.request(`/api/stocks/symbols?timeframe=${timeframe}`);
  }

  // Get symbols metadata with data ranges
  async getSymbolsMetadata(timeframe = '1h') {
    return this.request(`/api/stocks/symbols/metadata?timeframe=${timeframe}`);
  }

  // Health check
  async healthCheck() {
    return this.request('/health');
  }

  // --- Watchlist Methods ---
  async getWatchlist() {
    return this.request('/api/watchlist');
  }

  async toggleWatchlist(symbol) {
    return this.request('/api/watchlist/toggle', {
      method: 'POST',
      body: JSON.stringify({ symbol })
    });
  }
}

export default new ApiService();
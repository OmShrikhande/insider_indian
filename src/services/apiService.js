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
  async getStockData(symbol, timeframe = '1h', limit = 3000) {
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

  // --- FNO Methods ---
  async getFnoContracts(query = '', limit = 100) {
    return this.request(`/api/fno/contracts?q=${encodeURIComponent(query)}&limit=${limit}`);
  }

  async syncFnoContracts(query = 'NIFTY', limit = 100) {
    return this.request('/api/fno/sync', {
      method: 'POST',
      body: JSON.stringify({ q: query, limit })
    });
  }

  async getFnoExpiries(query = '') {
    return this.request(`/api/fno/expiries?q=${encodeURIComponent(query)}`);
  }

  async getFnoStrikeLadder(underlying = 'NIFTY', expiry = '') {
    return this.request(`/api/fno/strike-ladder?underlying=${encodeURIComponent(underlying)}&expiry=${encodeURIComponent(expiry)}`);
  }

  async getFnoPCR(underlying = 'NIFTY', expiry = '') {
    return this.request(`/api/fno/pcr?underlying=${encodeURIComponent(underlying)}&expiry=${encodeURIComponent(expiry)}`);
  }

  async getFnoOhlcv(underlying, expiry, strike, timeframe = '1h') {
    return this.request(`/api/fno/ohlcv?underlying=${encodeURIComponent(underlying)}&expiry=${encodeURIComponent(expiry)}&strike=${encodeURIComponent(strike)}&timeframe=${encodeURIComponent(timeframe)}`);
  }

  /** NIFTY / BANKNIFTY / FINNIFTY index OHLC (1m, 1h, 1d) from ClickHouse */
  async getIndexOhlc(underlying, timeframe = '1h', limit = 8000) {
    const q = new URLSearchParams({
      underlying: String(underlying || 'NIFTY').toUpperCase(),
      timeframe,
      limit: String(limit),
    });
    return this.request(`/api/fno/index-ohlc?${q.toString()}`);
  }

  async getOptionChain(symbol, expiry) {
    if (!symbol || !expiry) throw new Error('Symbol and Expiry are required');
    return this.request(`/api/fno/option-chain/${symbol}/${expiry}`);
  }

  resolveFnoInstrumentKey(symbol) {
    const value = String(symbol || '').trim();
    if (!value) return '';
    if (value.includes('|')) return value;

    const keyMap = {
      NIFTY: 'NSE_INDEX|Nifty 50',
      BANKNIFTY: 'NSE_INDEX|Nifty Bank',
      FINNIFTY: 'NSE_INDEX|Nifty Fin Service',
      MIDCPNIFTY: 'NSE_INDEX|Nifty Mid Select',
    };

    const upper = value.toUpperCase();
    if (keyMap[upper]) return keyMap[upper];
    return `NSE_EQ|${upper}`;
  }

  async getOptionChainByInstrument(instrumentKey, expiryDate) {
    if (!instrumentKey || !expiryDate) {
      throw new Error('instrumentKey and expiryDate are required');
    }
    return this.request(
      `/api/fno/option-chain?instrument_key=${encodeURIComponent(instrumentKey)}&expiry_date=${encodeURIComponent(expiryDate)}`
    );
  }

  getStockStreamUrl(symbol, timeframe = '1h', limit = 3000) {
    const params = new URLSearchParams({
      symbol,
      timeframe,
      limit: String(limit)
    });
    return `${this.baseURL}/api/live/stream/stocks?${params.toString()}`;
  }

  getFnoStreamUrl(underlying, expiry, strike, timeframe = '1h') {
    const params = new URLSearchParams({
      underlying,
      expiry,
      strike: String(strike),
      timeframe
    });
    return `${this.baseURL}/api/live/stream/fno-ohlcv?${params.toString()}`;
  }

  async getDataSources() {
    return this.request('/api/system/sources');
  }

  async getMomentumScreener(limit = 20) {
    return this.request(`/api/screeners/momentum?limit=${limit}`);
  }

  async getVolatilityScreener(limit = 20) {
    return this.request(`/api/screeners/volatility?limit=${limit}`);
  }

  async getTrendScreener(limit = 20) {
    return this.request(`/api/screeners/trend?limit=${limit}`);
  }

  async getStrategyTemplates() {
    return this.request('/api/strategies/templates');
  }

  async getAlerts() {
    return this.request('/api/alerts');
  }

  async createAlert(payload) {
    return this.request('/api/alerts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}

export default new ApiService();
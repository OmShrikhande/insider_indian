// API Service for Stock Data
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:11000';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;

    const config = {
      headers: {
        'Content-Type': 'application/json',
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

  // Get stock data for a symbol
  async getStockData(symbol, timeframe = 'hourly', limit = 100) {
    const backendTimeframe = timeframe === '1d' ? 'daily' : 'hourly';
    return this.request(`/api/stocks/${symbol}?timeframe=${backendTimeframe}&limit=${limit}`);
  }

  // Get stock data within date range
  async getStockDataByDateRange(symbol, timeframe = 'hourly', startDate, endDate) {
    const backendTimeframe = timeframe === '1d' ? 'daily' : 'hourly';
    return this.request(`/api/stocks/${symbol}/range?timeframe=${backendTimeframe}&startDate=${startDate}&endDate=${endDate}`);
  }

  // Get available symbols
  async getAvailableSymbols(timeframe = 'hourly') {
    const backendTimeframe = timeframe === '1d' ? 'daily' : 'hourly';
    return this.request(`/api/stocks/symbols?timeframe=${backendTimeframe}`);
  }

  // Get symbols metadata with data ranges
  async getSymbolsMetadata(timeframe = 'hourly') {
    const backendTimeframe = timeframe === '1d' ? 'daily' : 'hourly';
    return this.request(`/api/stocks/symbols/metadata?timeframe=${backendTimeframe}`);
  }

  // Health check
  async healthCheck() {
    return this.request('/health');
  }
}

export default new ApiService();
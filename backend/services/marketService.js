const { testConnection } = require('../config/database');

class MarketService {
  constructor() {
    this.holidays = [];
    this.timings = {};
    this.lastFetch = null;
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
  }

  shouldRun() {
    return Boolean(process.env.UPSTOX_ACCESS_TOKEN);
  }

  async fetchHolidays() {
    if (!this.shouldRun()) return [];

    try {
      const url = `${process.env.UPSTOX_BASE_URL || 'https://api.upstox.com'}/v2/market/holidays`;

      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${process.env.UPSTOX_ACCESS_TOKEN}`,
        },
      });

      if (!response.ok) {
        console.error(`[MarketService] Failed to fetch holidays: HTTP ${response.status}`);
        return [];
      }

      const data = await response.json();
      if (data.status === 'success' && data.data) {
        this.holidays = data.data.map(holiday => ({
          date: holiday.date,
          description: holiday.description,
          type: holiday.holiday_type,
          closedExchanges: holiday.closed_exchanges || [],
          openExchanges: holiday.open_exchanges || [],
        }));
        console.log(`[MarketService] Fetched ${this.holidays.length} holidays`);
        return this.holidays;
      }
    } catch (error) {
      console.error('[MarketService] Error fetching holidays:', error.message);
    }
    return [];
  }

  async fetchTimings(date = null) {
    if (!this.shouldRun()) return {};

    const targetDate = date || new Date().toISOString().split('T')[0];

    try {
      const url = `${process.env.UPSTOX_BASE_URL || 'https://api.upstox.com'}/v2/market/timings/${targetDate}`;

      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${process.env.UPSTOX_ACCESS_TOKEN}`,
        },
      });

      if (!response.ok) {
        console.error(`[MarketService] Failed to fetch timings for ${targetDate}: HTTP ${response.status}`);
        return {};
      }

      const data = await response.json();
      if (data.status === 'success' && data.data) {
        const timings = {};
        data.data.forEach(exchange => {
          timings[exchange.exchange] = {
            startTime: new Date(exchange.start_time),
            endTime: new Date(exchange.end_time),
          };
        });
        this.timings[targetDate] = timings;
        console.log(`[MarketService] Fetched timings for ${targetDate}`);
        return timings;
      }
    } catch (error) {
      console.error('[MarketService] Error fetching timings:', error.message);
    }
    return {};
  }

  async getHolidays() {
    // Cache holidays for 24 hours
    if (!this.lastFetch || Date.now() - this.lastFetch > this.cacheExpiry) {
      await this.fetchHolidays();
      this.lastFetch = Date.now();
    }
    return this.holidays;
  }

  async getTimings(date = null) {
    const targetDate = date || new Date().toISOString().split('T')[0];

    if (!this.timings[targetDate]) {
      await this.fetchTimings(targetDate);
    }
    return this.timings[targetDate] || {};
  }

  isHoliday(date) {
    const dateStr = date.toISOString().split('T')[0];
    return this.holidays.some(holiday =>
      holiday.date === dateStr &&
      (holiday.closedExchanges.includes('NSE') || holiday.type === 'TRADING_HOLIDAY')
    );
  }

  isMarketOpen(date = new Date()) {
    const dateStr = date.toISOString().split('T')[0];
    const timings = this.timings[dateStr];

    if (!timings || !timings.NSE) return false;

    const now = date.getTime();
    const start = timings.NSE.startTime.getTime();
    const end = timings.NSE.endTime.getTime();

    return now >= start && now <= end;
  }

  async getMarketStatus() {
    const now = new Date();
    const holidays = await this.getHolidays();
    const timings = await this.getTimings();

    const isHoliday = this.isHoliday(now);
    const isOpen = !isHoliday && this.isMarketOpen(now);

    return {
      isOpen,
      isHoliday,
      currentTime: now.toISOString(),
      timings: timings.NSE ? {
        startTime: timings.NSE.startTime.toISOString(),
        endTime: timings.NSE.endTime.toISOString(),
      } : null,
    };
  }

  async init() {
    if (!this.shouldRun()) {
      console.log('[MarketService] Disabled - no Upstox credentials');
      return;
    }

    // Check database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.warn('[MarketService] Database not available. Skipping market data initialization.');
      return;
    }

    console.log('[MarketService] Initializing market data...');
    await this.getHolidays();
    await this.getTimings();
  }
}

module.exports = new MarketService();
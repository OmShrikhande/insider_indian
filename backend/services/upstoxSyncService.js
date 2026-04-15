const { client } = require('../config/database');

class UpstoxSyncService {
  constructor() {
    this.isSyncing = {
      '15m': false,
      '1h': false,
      '1d': false,
    };
    this.intervals = [];
    this.instrumentCache = new Map(); // Cache symbol -> instrument_key mappings
  }

  shouldRun() {
    return process.env.ENABLE_UPSTOX_SYNC === 'true';
  }

  hasCredentials() {
    return Boolean(process.env.UPSTOX_API_KEY || process.env.UPSTOX_ACCESS_TOKEN);
  }

  async init() {
    if (!this.shouldRun()) {
      console.log('[UpstoxSync] Disabled (ENABLE_UPSTOX_SYNC=false).');
      return;
    }

    if (!this.hasCredentials()) {
      console.warn('[UpstoxSync] Missing credentials. Set UPSTOX_API_KEY or UPSTOX_ACCESS_TOKEN.');
      return;
    }

    console.log('[UpstoxSync] Initializing background sync jobs...');
    await this.runAllTimeframes();

    this.intervals.push(setInterval(() => this.syncTimeframe('15m'), 15 * 60 * 1000));
    this.intervals.push(setInterval(() => this.syncTimeframe('1h'), 60 * 60 * 1000));
    this.intervals.push(setInterval(() => this.syncTimeframe('1d'), 24 * 60 * 60 * 1000));
  }

  async runAllTimeframes() {
    await this.syncTimeframe('15m');
    await this.syncTimeframe('1h');
    await this.syncTimeframe('1d');
  }

  async getTrackedStocks() {
    // First try to get symbols from stocks_summary (which has the master list)
    // Limit to top 50 stocks for initial sync to avoid overwhelming the API
    const primaryQuery = `
      SELECT
        symbol,
        '' AS sector
      FROM stocks_summary
      ORDER BY symbol
      LIMIT 50
    `;

    try {
      const result = await client.query({
        query: primaryQuery,
        format: 'JSONEachRow',
      });
      const rows = await result.json();
      if (rows.length > 0) return rows;
    } catch (error) {
      console.warn('[UpstoxSync] stocks_summary lookup failed, falling back to stocks_hourly.', error.message);
    }

    // Fallback: get symbols from existing hourly data
    const fallbackQuery = `
      SELECT DISTINCT
        symbol,
        '' AS sector
      FROM stocks_hourly
      ORDER BY symbol
    `;
    try {
      const fallbackResult = await client.query({
        query: fallbackQuery,
        format: 'JSONEachRow',
      });
      const rows = await fallbackResult.json();
      if (rows.length > 0) return rows;
    } catch (error) {
      console.warn('[UpstoxSync] stocks_hourly lookup also failed.', error.message);
    }

    // Last resort: use a hardcoded list of common Indian stocks
    console.log('[UpstoxSync] Using hardcoded list of common Indian stocks');
    const commonStocks = [
      'RELIANCE', 'TCS', 'HDFCBANK', 'ICICIBANK', 'INFY', 'HINDUNILVR', 'ITC', 'KOTAKBANK',
      'LT', 'AXISBANK', 'MARUTI', 'BAJFINANCE', 'BHARTIARTL', 'WIPRO', 'HCLTECH', 'NTPC',
      'POWERGRID', 'ONGC', 'COALINDIA', 'GAIL', 'DRREDDY', 'SUNPHARMA', 'CIPLA', 'DIVISLAB'
    ];

    // Use common stocks as fallback, but limit to top 50 for initial sync
    const limitedStocks = commonStocks.slice(0, 50);
    return limitedStocks.map(symbol => ({ symbol, sector: '' }));
  }

  getTimeframeConfig(timeframe) {
    if (timeframe === '15m') {
      return { unit: 'minutes', interval: '15', table: 'stocks_15min', lookbackDays: 30 }; // 1 month max for 15m
    }
    if (timeframe === '1h') {
      return { unit: 'hours', interval: '1', table: 'stocks_hourly', lookbackDays: 90 }; // 3 months for 1h
    }
    return { unit: 'days', interval: '1', table: 'stocks_daily', lookbackDays: 365 }; // 1 year for daily
  }

  formatDateOnly(date) {
    return date.toISOString().slice(0, 10);
  }

  formatDateTime(date) {
    return date.toISOString().replace('T', ' ').slice(0, 19);
  }

  async searchInstrumentKey(symbol) {
    // Check cache first
    if (this.instrumentCache.has(symbol)) {
      return this.instrumentCache.get(symbol);
    }

    try {
      const url = `${process.env.UPSTOX_BASE_URL.replace('v3', 'v2')}/instruments/search?query=${encodeURIComponent(symbol)}&exchanges=NSE&segments=EQ&records=1`;

      const headers = {
        Accept: 'application/json',
      };

      if (process.env.UPSTOX_ACCESS_TOKEN) {
        headers.Authorization = `Bearer ${process.env.UPSTOX_ACCESS_TOKEN}`;
      }

      const response = await fetch(url, { headers });
      if (!response.ok) {
        console.error(`[UpstoxSync] Instrument search failed for ${symbol}: HTTP ${response.status}`);
        return null;
      }

      const payload = await response.json();
      const instruments = payload?.data || [];

      // Find the NSE_EQ instrument
      const nseInstrument = instruments.find(inst => inst.segment === 'NSE_EQ');

      if (nseInstrument) {
        const instrumentKey = nseInstrument.instrument_key;
        this.instrumentCache.set(symbol, instrumentKey);
        console.log(`[UpstoxSync] Found instrument key for ${symbol}: ${instrumentKey}`);
        return instrumentKey;
      }

      console.warn(`[UpstoxSync] No NSE_EQ instrument found for ${symbol}`);
      return null;
    } catch (error) {
      console.error(`[UpstoxSync] Error searching instrument for ${symbol}:`, error.message);
      return null;
    }
  }

  toUpstoxInstrumentKey(symbol) {
    const direct = process.env.UPSTOX_INSTRUMENT_DIRECT === 'true';
    if (direct) return symbol;
    const prefix = process.env.UPSTOX_INSTRUMENT_PREFIX || 'NSE_EQ|';
    return `${prefix}${symbol}`;
  }

  async fetchCandles(symbol, timeframe) {
    const { unit, interval, lookbackDays } = this.getTimeframeConfig(timeframe);
    const toDate = new Date();
    const fromDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

    // Get the correct instrument key
    const instrumentKey = await this.searchInstrumentKey(symbol);
    if (!instrumentKey) {
      throw new Error(`Could not find instrument key for symbol: ${symbol}`);
    }

    const encodedInstrumentKey = encodeURIComponent(instrumentKey);
    const url = `${process.env.UPSTOX_BASE_URL || 'https://api.upstox.com/v3'}/historical-candle/${encodedInstrumentKey}/${unit}/${interval}/${this.formatDateOnly(toDate)}/${this.formatDateOnly(fromDate)}`;

    const headers = {
      Accept: 'application/json',
    };

    if (process.env.UPSTOX_ACCESS_TOKEN) {
      headers.Authorization = `Bearer ${process.env.UPSTOX_ACCESS_TOKEN}`;
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[UpstoxSync] API Error for ${symbol} ${timeframe}: HTTP ${response.status} - ${errorText}`);
      throw new Error(`HTTP ${response.status} for ${symbol} ${timeframe}: ${errorText}`);
    }

    const payload = await response.json();
    const candles = payload?.data?.candles || payload?.candles || [];
    return candles;
  }

  normalizeCandle(raw) {
    if (!Array.isArray(raw) || raw.length < 6) return null;
    const [ts, open, high, low, close, volume] = raw;
    const parsed = new Date(ts);
    if (Number.isNaN(parsed.getTime())) return null;

    return {
      date: this.formatDateTime(parsed),
      open: Number(open),
      high: Number(high),
      low: Number(low),
      close: Number(close),
      volume: Number(volume || 0),
    };
  }

  async getLatestTimestamp(table, symbol) {
    const result = await client.query({
      query: `
        SELECT max(date) AS latest
        FROM ${table}
        WHERE symbol = {symbol:String}
      `,
      query_params: {
        symbol,
      },
      format: 'JSONEachRow',
    });
    const rows = await result.json();
    return rows?.[0]?.latest ? new Date(rows[0].latest) : null;
  }

  async insertCandles(table, timeframe, symbol, sector, candles) {
    if (!candles.length) return 0;
    const rows = candles.map((c) => ({
      date: c.date,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
      symbol,
      timeframe,
      sector: sector || '',
    }));

    await client.insert({
      table,
      values: rows,
      format: 'JSONEachRow',
    });

    return rows.length;
  }

  async syncTimeframe(timeframe) {
    if (this.isSyncing[timeframe]) return;
    this.isSyncing[timeframe] = true;

    try {
      const stocks = await this.getTrackedStocks();
      if (stocks.length === 0) {
        console.warn(`[UpstoxSync] No symbols found for ${timeframe} sync.`);
        return;
      }

      console.log(`[UpstoxSync] Starting ${timeframe} sync for ${stocks.length} stocks`);
      const { table } = this.getTimeframeConfig(timeframe);
      let insertedTotal = 0;
      let successCount = 0;

      for (const stock of stocks) {
        const symbol = stock.symbol;
        try {
          const latest = await this.getLatestTimestamp(table, symbol);
          const upstreamCandles = await this.fetchCandles(symbol, timeframe);
          const normalized = upstreamCandles
            .map((c) => this.normalizeCandle(c))
            .filter(Boolean)
            .sort((a, b) => new Date(a.date) - new Date(b.date));

          const filtered = latest
            ? normalized.filter((c) => new Date(c.date) > latest)
            : normalized;

          const inserted = await this.insertCandles(table, timeframe, symbol, stock.sector, filtered);
          insertedTotal += inserted;
          successCount++;
          console.log(`[UpstoxSync] ${symbol} ${timeframe}: ${inserted} rows inserted`);
        } catch (error) {
          console.warn(`[UpstoxSync] Failed to sync ${symbol} ${timeframe}:`, error.message);
        }
      }

      console.log(`[UpstoxSync] ${timeframe} sync complete. ${successCount}/${stocks.length} stocks successful. Total inserted rows: ${insertedTotal}`);
    } catch (error) {
      console.error(`[UpstoxSync] ${timeframe} sync failed:`, error.message);
    } finally {
      this.isSyncing[timeframe] = false;
    }
  }
}

module.exports = new UpstoxSyncService();

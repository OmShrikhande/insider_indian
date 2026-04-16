const { client, testConnection } = require('../config/database');

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

    // Check database connection before starting sync
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.warn('[UpstoxSync] Database not available. Skipping sync initialization.');
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
    // Limit to top 300 stocks for sync to match user requirements
    const primaryQuery = `
      SELECT
        symbol,
        '' AS sector
      FROM stocks_summary
      ORDER BY symbol
      LIMIT 300
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

    // Use common stocks as fallback, but limit to top 300 for sync
    const limitedStocks = commonStocks.slice(0, 300);
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

  async searchInstrumentKey(symbol, retryCount = 0) {
    const maxRetries = 3;

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

        // Retry on rate limit or server errors
        if ((response.status === 429 || response.status >= 500) && retryCount < maxRetries) {
          const delay = Math.pow(2, retryCount) * 1000;
          console.log(`[UpstoxSync] Retrying instrument search for ${symbol} in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.searchInstrumentKey(symbol, retryCount + 1);
        }

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

      // Retry on network errors
      if (retryCount < maxRetries && (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND'))) {
        const delay = Math.pow(2, retryCount) * 1000;
        console.log(`[UpstoxSync] Network error in instrument search, retrying ${symbol} in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.searchInstrumentKey(symbol, retryCount + 1);
      }

      return null;
    }
  }

  toUpstoxInstrumentKey(symbol) {
    const direct = process.env.UPSTOX_INSTRUMENT_DIRECT === 'true';
    if (direct) return symbol;
    const prefix = process.env.UPSTOX_INSTRUMENT_PREFIX || 'NSE_EQ|';
    return `${prefix}${symbol}`;
  }

  async fetchCandles(symbol, timeframe, retryCount = 0) {
    const maxRetries = 3;
    const { unit, interval, lookbackDays } = this.getTimeframeConfig(timeframe);
    const toDate = new Date();
    const fromDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

    try {
      // Get the correct instrument key
      const instrumentKey = await this.searchInstrumentKey(symbol);
      if (!instrumentKey) {
        throw new Error(`Could not find instrument key for symbol: ${symbol}`);
      }

      const encodedInstrumentKey = encodeURIComponent(instrumentKey);
      const url = `${process.env.UPSTOX_BASE_URL || 'https://api.upstox.com/v2'}/historical-candle/${encodedInstrumentKey}/${unit}/${interval}/${this.formatDateOnly(toDate)}/${this.formatDateOnly(fromDate)}`;

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

        // Retry on rate limit or server errors
        if ((response.status === 429 || response.status >= 500) && retryCount < maxRetries) {
          const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
          console.log(`[UpstoxSync] Retrying ${symbol} ${timeframe} in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.fetchCandles(symbol, timeframe, retryCount + 1);
        }

        throw new Error(`HTTP ${response.status} for ${symbol} ${timeframe}: ${errorText}`);
      }

      const payload = await response.json();
      const candles = payload?.data?.candles || payload?.candles || [];
      return candles;
    } catch (error) {
      if (retryCount < maxRetries && (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND'))) {
        const delay = Math.pow(2, retryCount) * 1000;
        console.log(`[UpstoxSync] Network error, retrying ${symbol} ${timeframe} in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchCandles(symbol, timeframe, retryCount + 1);
      }
      throw error;
    }
  }

  normalizeCandle(raw) {
    if (!Array.isArray(raw) || raw.length < 6) return null;
    const [ts, open, high, low, close, volume] = raw;

    try {
      let timestampMs;

      // Handle different timestamp formats from Upstox API
      if (typeof ts === 'string') {
        // Try parsing as number first (string number)
        const numTs = Number(ts);
        if (!Number.isNaN(numTs)) {
          ts = numTs;
        } else {
          // ISO string format - assume it's already in IST
          const date = new Date(ts);
          if (Number.isNaN(date.getTime())) return null;
          timestampMs = date.getTime();
        }
      }

      if (typeof ts === 'number') {
        if (ts > 1e10) {
          // Unix milliseconds - Upstox returns these in IST
          timestampMs = ts;
        } else {
          // Unix seconds - convert to milliseconds
          timestampMs = ts * 1000;
        }
      }

      if (!timestampMs || Number.isNaN(timestampMs)) return null;

      // Upstox timestamps are in IST, convert to UTC for storage
      // Subtract 5.5 hours to convert IST to UTC
      const utcTimestampMs = timestampMs - (5.5 * 60 * 60 * 1000);
      const candleDate = new Date(utcTimestampMs);

      return {
        date: this.formatDateTime(candleDate),
        open: Number(open),
        high: Number(high),
        low: Number(low),
        close: Number(close),
        volume: Number(volume || 0),
      };
    } catch (error) {
      console.error('Error normalizing candle:', error, raw);
      return null;
    }
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
          console.log(`[UpstoxSync] ${symbol} ${timeframe}: Latest timestamp in DB: ${latest}`);

          const upstreamCandles = await this.fetchCandles(symbol, timeframe);
          console.log(`[UpstoxSync] ${symbol} ${timeframe}: Fetched ${upstreamCandles.length} candles from API`);

          const normalized = upstreamCandles
            .map((c) => this.normalizeCandle(c))
            .filter(Boolean)
            .sort((a, b) => new Date(a.date) - new Date(b.date));

          console.log(`[UpstoxSync] ${symbol} ${timeframe}: ${normalized.length} normalized candles`);

          // Remove duplicates by timestamp
          const seen = new Set();
          const deduplicated = normalized.filter(candle => {
            const timestamp = Math.floor(new Date(candle.date).getTime() / 1000);
            if (seen.has(timestamp)) {
              return false;
            }
            seen.add(timestamp);
            return true;
          });

          console.log(`[UpstoxSync] ${symbol} ${timeframe}: ${deduplicated.length} deduplicated candles`);

          // Debug date comparison
          if (deduplicated.length > 0) {
            console.log(`[UpstoxSync] ${symbol} ${timeframe}: First API candle date: ${deduplicated[0].date}`);
            console.log(`[UpstoxSync] ${symbol} ${timeframe}: Last API candle date: ${deduplicated[deduplicated.length - 1].date}`);
            console.log(`[UpstoxSync] ${symbol} ${timeframe}: Latest DB date: ${latest}`);
            console.log(`[UpstoxSync] ${symbol} ${timeframe}: Comparison test - first candle > latest: ${new Date(deduplicated[0].date) > latest}`);
          }

          const filtered = latest
            ? deduplicated.filter((c) => new Date(c.date) > latest)
            : deduplicated;

          console.log(`[UpstoxSync] ${symbol} ${timeframe}: ${filtered.length} new candles to insert`);

          const inserted = await this.insertCandles(table, timeframe, symbol, stock.sector, filtered);
          insertedTotal += inserted;
          if (inserted > 0) {
            successCount++;
          }
          console.log(`[UpstoxSync] ${symbol} ${timeframe}: ${inserted} rows inserted`);
        } catch (error) {
          console.warn(`[UpstoxSync] Failed to sync ${symbol} ${timeframe}:`, error.message);
        }

        // Add small delay between stocks to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
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

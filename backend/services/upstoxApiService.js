class UpstoxApiService {
  constructor() {
    this.baseUrl = (process.env.UPSTOX_BASE_URL || 'https://api.upstox.com/v2').replace(/\/$/, '');
    this.accessToken = process.env.UPSTOX_ACCESS_TOKEN || '';
    this.rateLimitedUntil = 0;
  }

  getV2BaseUrl() {
    return this.baseUrl.includes('/v3') ? this.baseUrl.replace('/v3', '/v2') : this.baseUrl;
  }

  /** Upstox v3 historical candles: /historical-candle/{key}/{unit}/{interval}/{to_date}/{from_date} */
  getV3BaseUrl() {
    return 'https://api.upstox.com/v3';
  }

  /**
   * @param {string} instrumentKey e.g. NSE_INDEX|Nifty 50
   * @param {'minutes'|'hours'|'days'} unit
   * @param {number} interval e.g. 1 for 1-minute / 1-hour / 1-day
   * @param {string} toDate YYYY-MM-DD (inclusive end)
   * @param {string} fromDate YYYY-MM-DD (inclusive start)
   */
  async fetchHistoricalCandlesV3(instrumentKey, unit, interval, toDate, fromDate) {
    if (!process.env.UPSTOX_ACCESS_TOKEN && !this.accessToken) return [];
    if (this.isRateLimitedNow()) return [];

    const safeUnit = ['minutes', 'hours', 'days', 'weeks', 'months'].includes(unit) ? unit : 'minutes';
    const safeInterval = Math.max(1, Math.min(300, Number(interval) || 1));
    const key = encodeURIComponent(String(instrumentKey).trim());
    const url = `${this.getV3BaseUrl()}/historical-candle/${key}/${safeUnit}/${safeInterval}/${toDate}/${fromDate}`;

    try {
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) {
        const txt = await response.text();
        if (response.status === 429) {
          const waitMs = this.extractRetryAfterMs(response, txt);
          this.markRateLimited(waitMs);
          console.warn(`[UpstoxAPI] v3 candle rate-limited. Cooling down for ${Math.ceil(waitMs / 1000)}s`);
        }
        console.warn(`[UpstoxAPI] v3 Candle fetch failed [${response.status}] for ${instrumentKey} ${safeUnit}/${safeInterval} ${toDate}..${fromDate}`);
        return [];
      }
      const payload = await response.json();
      return payload?.data?.candles || [];
    } catch (e) {
      console.error(`[UpstoxAPI] v3 network error for ${instrumentKey}:`, e.message);
      return [];
    }
  }

  getHeaders() {
    const token = process.env.UPSTOX_ACCESS_TOKEN || process.env.UPSTOX_API_KEY || this.accessToken;
    const headers = { 
      'Accept': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    };
    return headers;
  }

  isRateLimitedNow() {
    return Date.now() < this.rateLimitedUntil;
  }

  getRateLimitRemainingMs() {
    return Math.max(0, this.rateLimitedUntil - Date.now());
  }

  markRateLimited(waitMs = 30000) {
    const until = Date.now() + Math.max(1000, waitMs);
    this.rateLimitedUntil = Math.max(this.rateLimitedUntil, until);
  }

  extractRetryAfterMs(response, bodyText = '') {
    const header = Number(response.headers.get('retry-after') || 0);
    if (header > 0) return header * 1000;
    try {
      const parsed = JSON.parse(bodyText || '{}');
      if (parsed?.retry_after) return Number(parsed.retry_after) * 1000;
    } catch (_) {}
    return 30000;
  }

  async searchInstrument(query, exchange = 'NSE', segment = 'EQ', limit = 1) {
    if (!process.env.UPSTOX_ACCESS_TOKEN && !this.accessToken) return [];
    if (this.isRateLimitedNow()) return [];

    // ROAST FIX: Strict segment mapping for v2 search
    const validSegments = ['EQ', 'FO', 'INDEX', 'COM', 'CD'];
    const seg = validSegments.includes(segment) ? segment : 'EQ';
    const searchUrl = `${this.getV2BaseUrl()}/instruments/search?query=${encodeURIComponent(query)}&exchanges=${exchange}&segments=${seg}&records=${limit}`;
    
    console.log(`[UpstoxAPI] Search: ${query} on ${exchange}:${seg}`);
    try {
      const response = await fetch(searchUrl, { headers: this.getHeaders() });
      if (!response.ok) {
        const txt = await response.text();
        if (response.status === 429) {
          const waitMs = this.extractRetryAfterMs(response, txt);
          this.markRateLimited(waitMs);
          console.warn(`[UpstoxAPI] Search rate-limited. Cooling down for ${Math.ceil(waitMs / 1000)}s`);
        }
        console.warn(`[UpstoxAPI] Search failed [${response.status}]: ${txt}`);
        return [];
      }
      const payload = await response.json();
      console.log(`[UpstoxAPI] Result count for "${query}": ${payload?.data?.length || 0}`);
      return payload?.data || [];
    } catch (e) {
      if (e.message.includes('Invalid token') || (e.response && e.response.status === 401)) {
        console.error('[UpstoxAPI] FATAL: Your UPSTOX_ACCESS_TOKEN is invalid or expired. Please update it in .env');
      } else {
        console.error(`[UpstoxAPI] Search error for ${query}:`, e.message);
      }
      return [];
    }
  }

  async fetchCandles(instrumentKey, timeframe = '1h', lookbackDays = 30) {
    if (!process.env.UPSTOX_ACCESS_TOKEN && !this.accessToken) return [];
    if (this.isRateLimitedNow()) return [];

    const toDate = new Date();
    const fromDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
    const formatDate = (d) => d.toISOString().slice(0, 10);
    
    // ROAST FIX: Only 'day' and '1minute' are reliable v2 tokens
    let interval = '1minute';
    if (timeframe === '1d') interval = 'day';
    else if (timeframe === '30m') interval = '30minute';

    // Strictly 5 segments: /historical-candle/{key}/{interval}/{to}/{from}
    const url = `${this.getV2BaseUrl()}/historical-candle/${encodeURIComponent(instrumentKey)}/${interval}/${formatDate(toDate)}/${formatDate(fromDate)}`;
    
    try {
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) {
        const txt = await response.text();
        if (response.status === 429) {
          const waitMs = this.extractRetryAfterMs(response, txt);
          this.markRateLimited(waitMs);
          console.warn(`[UpstoxAPI] Candle rate-limited. Cooling down for ${Math.ceil(waitMs / 1000)}s`);
        }
        console.warn(`[UpstoxAPI] Candle fetch failed [${response.status}] for ${instrumentKey}`);
        return [];
      }
      const payload = await response.json();
      return payload?.data?.candles || payload?.candles || [];
    } catch (e) {
      console.error(`[UpstoxAPI] Network error for ${instrumentKey}:`, e.message);
      return [];
    }
  }

  /**
   * Upstox v3 market quote OHLC (live + previous candle) — used for LTP / ATM strike.
   * GET /v3/market-quote/ohlc?instrument_key=...&interval=I30
   */
  async fetchMarketQuoteOhlc(instrumentKey, interval = 'I30') {
    if (!process.env.UPSTOX_ACCESS_TOKEN && !this.accessToken) return null;
    if (this.isRateLimitedNow()) return null;

    const key = String(instrumentKey || '').trim();
    if (!key) return null;

    const safeInterval = String(interval || 'I30').trim() || 'I30';
    const url = `${this.getV3BaseUrl()}/market-quote/ohlc?instrument_key=${encodeURIComponent(key)}&interval=${encodeURIComponent(safeInterval)}`;

    try {
      const response = await fetch(url, { headers: this.getHeaders() });
      const bodyText = await response.text();
      if (!response.ok) {
        if (response.status === 429) {
          const waitMs = this.extractRetryAfterMs(response, bodyText);
          this.markRateLimited(waitMs);
        }
        console.warn(`[UpstoxAPI] market-quote/ohlc failed [${response.status}]: ${bodyText.slice(0, 200)}`);
        return null;
      }
      const payload = JSON.parse(bodyText);
      const rawData = payload?.data;
      if (!rawData || typeof rawData !== 'object') return null;

      const entries = Object.entries(rawData);
      if (!entries.length) return null;

      const [, row] = entries[0];
      if (!row || typeof row !== 'object') return null;

      return {
        instrument_key: row.instrument_token || key,
        last_price: Number(row.last_price),
        prev_ohlc: row.prev_ohlc || null,
        live_ohlc: row.live_ohlc || null,
        raw: row,
      };
    } catch (e) {
      console.error('[UpstoxAPI] market-quote/ohlc network error:', e.message);
      return null;
    }
  }

  async fetchOptionChain(instrumentKey, expiry) {
    if (!process.env.UPSTOX_ACCESS_TOKEN && !this.accessToken) return [];
    if (this.isRateLimitedNow()) return [];

    // Correct v2 endpoint as per Upstox specs
    const url = `${this.getV2BaseUrl()}/option/chain?instrument_key=${encodeURIComponent(instrumentKey)}&expiry_date=${expiry}`;
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
      try {
        const response = await fetch(url, { headers: this.getHeaders() });
        if (response.ok) {
          const payload = await response.json();
          return payload?.data || [];
        }

        const bodyText = await response.text();
        if (response.status === 429 && attempt < maxRetries - 1) {
          const waitMs = this.extractRetryAfterMs(response, bodyText);
          this.markRateLimited(waitMs);
          console.warn(`[UpstoxAPI] Option chain rate-limited, retrying in ${waitMs}ms`);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }

        console.warn(`[UpstoxAPI] Option Chain error [${response.status}]: ${bodyText}`);
        return [];
      } catch (e) {
        if (attempt < maxRetries - 1) {
          const waitMs = 300 * (attempt + 1);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }
        console.error('[UpstoxAPI] Option Chain network error:', e.message);
        return [];
      }
    }
    return [];
  }

  normalizeCandle(raw) {
    if (!raw || raw.length < 6) return null;
    const [ts, open, high, low, close, volume] = raw;
    
    let dateObj;
    if (typeof ts === 'string') dateObj = new Date(ts);
    else dateObj = new Date(ts > 1e10 ? ts : ts * 1000);

    return {
      date: dateObj.toISOString().replace('T', ' ').slice(0, 19),
      open: Number(open),
      high: Number(high),
      low: Number(low),
      close: Number(close),
      volume: Number(volume || 0),
      timestamp: dateObj.getTime()
    };
  }
}

module.exports = new UpstoxApiService();

class UpstoxApiService {
  constructor() {
    this.baseUrl = (process.env.UPSTOX_BASE_URL || 'https://api.upstox.com/v2').replace(/\/$/, '');
    this.accessToken = process.env.UPSTOX_ACCESS_TOKEN || '';
  }

  getHeaders() {
    const token = process.env.UPSTOX_ACCESS_TOKEN || this.accessToken;
    const headers = { 
      'Accept': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    };
    return headers;
  }

  async searchInstrument(query, exchange = 'NSE', segment = 'EQ', limit = 1) {
    if (!this.accessToken) return [];

    // ROAST FIX: Strict segment mapping for v2 search
    const validSegments = ['EQ', 'FO', 'INDEX', 'COM', 'CD'];
    const seg = validSegments.includes(segment) ? segment : 'EQ';
    const searchUrl = `${this.baseUrl.replace('/v3', '/v2')}/instruments/search?query=${encodeURIComponent(query)}&exchanges=${exchange}&segments=${seg}&records=${limit}`;
    
    console.log(`[UpstoxAPI] Search: ${query} on ${exchange}:${seg}`);
    try {
      const response = await fetch(searchUrl, { headers: this.getHeaders() });
      if (!response.ok) {
        const txt = await response.text();
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
    if (!this.accessToken) return [];

    const toDate = new Date();
    const fromDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
    const formatDate = (d) => d.toISOString().slice(0, 10);
    
    // ROAST FIX: Only 'day' and '1minute' are reliable v2 tokens
    let interval = '1minute';
    if (timeframe === '1d') interval = 'day';
    else if (timeframe === '30m') interval = '30minute';

    // Strictly 5 segments: /historical-candle/{key}/{interval}/{to}/{from}
    const url = `${this.baseUrl}/historical-candle/${encodeURIComponent(instrumentKey)}/${interval}/${formatDate(toDate)}/${formatDate(fromDate)}`;
    
    // Attempt with retry logic
    let attempts = 0;
    while (attempts < 2) {
      try {
        const response = await fetch(url, { headers: this.getHeaders() });
        if (!response.ok) {
          const txt = await response.text();
          if (response.status === 429 && attempts === 0) {
            console.log(`[UpstoxAPI] Rate limited. Retrying ${instrumentKey}...`);
            await new Promise(r => setTimeout(r, 1000));
            attempts++;
            continue;
          }
          console.warn(`[UpstoxAPI] Candle fetch failed [${response.status}]: ${txt}`);
          return [];
        }
        const payload = await response.json();
        return payload?.data?.candles || payload?.candles || [];
      } catch (e) {
        if (attempts === 0) {
           await new Promise(r => setTimeout(r, 500));
           attempts++;
           continue;
        }
        console.error(`[UpstoxAPI] Network error for ${instrumentKey}:`, e.message);
        return [];
      }
    }
    return [];
  }

  async fetchOptionChain(instrumentKey, expiry) {
    if (!this.accessToken) return [];

    // Correct v2 endpoint as per Upstox specs
    const url = `${this.baseUrl}/option/chain?instrument_key=${encodeURIComponent(instrumentKey)}&expiry_date=${expiry}`;

    try {
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) {
        const txt = await response.text();
        console.warn(`[UpstoxAPI] Option Chain error [${response.status}]: ${txt}`);
        return [];
      }
      const payload = await response.json();
      return payload.data || [];
    } catch (e) {
      console.error('[UpstoxAPI] Option Chain network error:', e.message);
      return [];
    }
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

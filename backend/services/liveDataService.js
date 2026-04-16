class LiveDataService {
  getBaseV2() {
    const base = process.env.UPSTOX_BASE_URL || 'https://api.upstox.com/v2';
    return base.includes('/v3') ? base.replace('/v3', '/v2') : base;
  }

  getHeaders() {
    const headers = { Accept: 'application/json' };
    if (process.env.UPSTOX_ACCESS_TOKEN) {
      headers.Authorization = `Bearer ${process.env.UPSTOX_ACCESS_TOKEN}`;
    }
    return headers;
  }

  async getLtp(instrumentKey) {
    const url = `${this.getBaseV2()}/market-quote/ltp?instrument_key=${encodeURIComponent(instrumentKey)}`;
    const response = await fetch(url, { headers: this.getHeaders() });
    if (!response.ok) {
      throw new Error(`Live LTP fetch failed: HTTP ${response.status}`);
    }
    return response.json();
  }
}

module.exports = new LiveDataService();

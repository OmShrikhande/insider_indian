const { client } = require('../config/database');

class FnoService {
  constructor() {
    this.baseUrl = process.env.UPSTOX_BASE_URL || 'https://api.upstox.com/v2';
  }

  getHeaders() {
    const headers = { Accept: 'application/json' };
    if (process.env.UPSTOX_ACCESS_TOKEN) {
      headers.Authorization = `Bearer ${process.env.UPSTOX_ACCESS_TOKEN}`;
    }
    return headers;
  }

  normalizeQuery(query) {
    return String(query || '').trim().toUpperCase().replace(/[^A-Z0-9&\-]/g, '').slice(0, 24);
  }

  async fetchFromUpstox(query, limit = 50) {
    if (!process.env.UPSTOX_ACCESS_TOKEN) {
      throw new Error('UPSTOX_ACCESS_TOKEN is required for FNO sync');
    }

    const safeQuery = this.normalizeQuery(query || 'NIFTY');
    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
    const baseV2 = this.baseUrl.includes('/v3') ? this.baseUrl.replace('/v3', '/v2') : this.baseUrl;
    const url = `${baseV2}/instruments/search?query=${encodeURIComponent(safeQuery)}&exchanges=NSE&segments=NSE_FO&records=${safeLimit}`;
    const response = await fetch(url, { headers: this.getHeaders() });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Upstox FNO fetch failed: HTTP ${response.status} ${body}`);
    }

    const payload = await response.json();
    const rows = Array.isArray(payload?.data) ? payload.data : [];
    return rows.map((item) => ({
      instrument_key: item.instrument_key || '',
      trading_symbol: item.trading_symbol || item.symbol || '',
      name: item.name || '',
      segment: item.segment || 'NSE_FO',
      exchange: item.exchange || 'NSE',
      instrument_type: item.instrument_type || '',
      lot_size: Number(item.lot_size || 0),
      tick_size: Number(item.tick_size || 0),
      expiry: item.expiry || null,
      strike: item.strike_price != null ? Number(item.strike_price) : null,
      option_type: item.option_type || null,
      underlying_symbol: safeQuery,
      updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
    })).filter((item) => item.instrument_key && item.trading_symbol);
  }

  async storeContracts(contracts) {
    if (!contracts.length) return 0;
    await client.insert({
      table: 'fno_contracts',
      values: contracts,
      format: 'JSONEachRow',
    });
    return contracts.length;
  }

  async getContracts(query = '', limit = 100) {
    const safeQuery = this.normalizeQuery(query);
    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 100));
    const baseSelect = `
      SELECT
        instrument_key,
        trading_symbol,
        name,
        segment,
        exchange,
        instrument_type,
        lot_size,
        tick_size,
        expiry,
        strike,
        option_type,
        underlying_symbol,
        updated_at
      FROM fno_contracts
    `;

    const result = await client.query({
      query: safeQuery
        ? `${baseSelect} WHERE trading_symbol LIKE {q:String} OR underlying_symbol LIKE {q:String} ORDER BY updated_at DESC LIMIT {limit:UInt32}`
        : `${baseSelect} ORDER BY updated_at DESC LIMIT {limit:UInt32}`,
      query_params: safeQuery
        ? { q: `%${safeQuery}%`, limit: safeLimit }
        : { limit: safeLimit },
      format: 'JSONEachRow',
    });
    return result.json();
  }

  async syncContracts(query = 'NIFTY', limit = 100) {
    const contracts = await this.fetchFromUpstox(query, limit);
    const inserted = await this.storeContracts(contracts);
    return { inserted, count: contracts.length };
  }
}

module.exports = new FnoService();

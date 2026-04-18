const { client } = require('../config/database');
const upstoxApi = require('./upstoxApiService');

/**
 * Persists Upstox v3 /market-quote/ohlc snapshots to ClickHouse and serves them via REST.
 * Flow: fetch from Upstox → insert row → return latest row for instrument_key + interval.
 */
class MarketQuoteOhlcService {
  normalizeRow(ik, interval, apiRow, rawForStorage) {
    if (!apiRow) return null;
    const prev = apiRow.prev_ohlc || {};
    const live = apiRow.live_ohlc || {};
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const rawPayload = rawForStorage != null ? rawForStorage : apiRow;
    return {
      instrument_key: String(ik).trim(),
      interval: String(interval || 'I30').trim(),
      last_price: Number(apiRow.last_price) || 0,
      prev_open: Number(prev.open) || 0,
      prev_high: Number(prev.high) || 0,
      prev_low: Number(prev.low) || 0,
      prev_close: Number(prev.close) || 0,
      prev_volume: Math.max(0, Math.floor(Number(prev.volume) || 0)),
      prev_ts: Math.floor(Number(prev.ts) || 0),
      live_open: Number(live.open) || 0,
      live_high: Number(live.high) || 0,
      live_low: Number(live.low) || 0,
      live_close: Number(live.close) || 0,
      live_volume: Math.max(0, Math.floor(Number(live.volume) || 0)),
      live_ts: Math.floor(Number(live.ts) || 0),
      raw_json: JSON.stringify(rawPayload),
      ingested_at: now,
    };
  }

  async fetchStoreAndReturn(instrumentKey, interval = 'I30') {
    const ik = String(instrumentKey || '').trim();
    const iv = String(interval || 'I30').trim();
    if (!ik) {
      return { success: false, error: 'instrument_key is required' };
    }

    const fresh = await upstoxApi.fetchMarketQuoteOhlc(ik, iv);
    if (fresh) {
      const apiShape = {
        last_price: fresh.last_price,
        prev_ohlc: fresh.prev_ohlc,
        live_ohlc: fresh.live_ohlc,
      };
      const row = this.normalizeRow(ik, iv, apiShape, fresh.raw);
      if (row) {
        try {
          await client.insert({ table: 'market_quote_ohlc', values: [row], format: 'JSONEachRow' });
        } catch (e) {
          console.warn('[MarketQuoteOhlc] insert failed:', e.message);
        }
      }
    }

    return this.getLatestFromDb(ik, iv);
  }

  async getLatestFromDb(instrumentKey, interval = 'I30') {
    const ik = String(instrumentKey || '').trim();
    const iv = String(interval || 'I30').trim();
    try {
      const result = await client.query({
        query: `
          SELECT
            instrument_key,
            interval,
            last_price,
            prev_open,
            prev_high,
            prev_low,
            prev_close,
            prev_volume,
            prev_ts,
            live_open,
            live_high,
            live_low,
            live_close,
            live_volume,
            live_ts,
            raw_json,
            ingested_at
          FROM market_quote_ohlc
          WHERE instrument_key = {ik:String} AND interval = {iv:String}
          ORDER BY ingested_at DESC
          LIMIT 1
        `,
        query_params: { ik, iv },
        format: 'JSONEachRow',
      });
      const rows = await result.json();
      if (!rows.length) {
        return { success: true, data: null, stale: true, source: 'db' };
      }
      const r = rows[0];
      let parsedRaw = {};
      try {
        parsedRaw = r.raw_json ? JSON.parse(r.raw_json) : {};
      } catch (_) {}
      return {
        success: true,
        stale: false,
        source: 'db',
        data: {
          instrument_key: r.instrument_key,
          interval: r.interval,
          last_price: Number(r.last_price),
          prev_ohlc: {
            open: Number(r.prev_open),
            high: Number(r.prev_high),
            low: Number(r.prev_low),
            close: Number(r.prev_close),
            volume: Number(r.prev_volume),
            ts: Number(r.prev_ts),
          },
          live_ohlc: {
            open: Number(r.live_open),
            high: Number(r.live_high),
            low: Number(r.live_low),
            close: Number(r.live_close),
            volume: Number(r.live_volume),
            ts: Number(r.live_ts),
          },
          ingested_at: r.ingested_at,
          raw: parsedRaw,
        },
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}

module.exports = new MarketQuoteOhlcService();

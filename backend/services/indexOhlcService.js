const { client } = require('../config/database');
const upstoxApi = require('./upstoxApiService');
const fnoService = require('./fnoService');

const INDEX_UNDERLYINGS = ['NIFTY', 'BANKNIFTY', 'FINNIFTY'];

function formatYMD(d) {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseBarTime(ts) {
  if (typeof ts === 'string') return new Date(ts);
  return new Date(ts > 1e12 ? ts : ts * 1000);
}

/**
 * Calendar month slices from `fromDate` through `toDate` (inclusive), capped at each month end.
 */
function monthRanges(fromDate, toDate) {
  const start = new Date(fromDate);
  const end = new Date(toDate);
  if (start > end) return [];

  const ranges = [];
  let cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMs = end.getTime();

  while (cur.getTime() <= endMs) {
    const y = cur.getFullYear();
    const m = cur.getMonth();
    const monthStart = new Date(y, m, 1);
    const monthEnd = new Date(y, m + 1, 0);
    const sliceFrom = monthStart < start ? start : monthStart;
    const sliceTo = monthEnd > end ? end : monthEnd;
    if (sliceFrom <= sliceTo) {
      ranges.push({ from: formatYMD(sliceFrom), to: formatYMD(sliceTo) });
    }
    cur.setMonth(cur.getMonth() + 1);
  }
  return ranges;
}

class IndexOhlcService {
  resolveInstrumentKey(underlying) {
    const u = fnoService.normalizeQuery(underlying);
    return fnoService.resolveCanonicalIndexKey(u) || null;
  }

  candlesToRows(underlying, instrumentKey, unit, interval, rawCandles, ingestedAt) {
    const rows = [];
    for (const c of rawCandles || []) {
      if (!c || c.length < 6) continue;
      const t = parseBarTime(c[0]);
      rows.push({
        underlying_symbol: underlying,
        instrument_key: instrumentKey,
        bar_time: t.toISOString().replace('T', ' ').slice(0, 19),
        unit,
        interval,
        open: Number(c[1]),
        high: Number(c[2]),
        low: Number(c[3]),
        close: Number(c[4]),
        volume: Number(c[5] || 0),
        open_interest: Number(c[6] ?? 0),
        ingested_at: ingestedAt,
      });
    }
    return rows;
  }

  async insertRows(rows) {
    if (!rows.length) return 0;
    await client.insert({ table: 'index_ohlc', values: rows, format: 'JSONEachRow' });
    return rows.length;
  }

  /**
   * Fetch one month window for a single unit/interval and persist.
   */
  async fetchMonthWindow(underlying, instrumentKey, unit, interval, fromStr, toStr) {
    const raw = await upstoxApi.fetchHistoricalCandlesV3(instrumentKey, unit, interval, toStr, fromStr);
    const ingested = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const rows = this.candlesToRows(underlying, instrumentKey, unit, interval, raw, ingested);
    return this.insertRows(rows);
  }

  async syncRange(underlying, unit, interval, fromDate, toDate, delayMs = 500) {
    const u = fnoService.normalizeQuery(underlying);
    const ik = this.resolveInstrumentKey(u);
    if (!ik) return { ok: false, error: 'Unknown index underlying' };

    const ranges = monthRanges(fromDate, toDate);
    let inserted = 0;
    for (const { from, to } of ranges) {
      const n = await this.fetchMonthWindow(u, ik, unit, interval, from, to);
      inserted += n;
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    }
    return { ok: true, inserted, underlying: u, unit, interval };
  }

  /** Last ~45 days in one or two month chunks — used by hourly job. */
  async syncRecent(underlying) {
    const to = new Date();
    const from = new Date(to.getTime() - 45 * 24 * 60 * 60 * 1000);
    const out = [];
    for (const spec of [
      { unit: 'minutes', interval: 1 },
      { unit: 'hours', interval: 1 },
      { unit: 'days', interval: 1 },
    ]) {
      const r = await this.syncRange(underlying, spec.unit, spec.interval, from, to, 400);
      out.push(r);
    }
    return out;
  }

  /** Backfill up to `monthsBack` calendar months (default 24). */
  async backfillUnderlying(underlying, monthsBack = 24, delayMs = 600) {
    const to = new Date();
    const from = new Date(to.getFullYear(), to.getMonth() - monthsBack, 1);
    const out = [];
    for (const spec of [
      { unit: 'minutes', interval: 1 },
      { unit: 'hours', interval: 1 },
      { unit: 'days', interval: 1 },
    ]) {
      const r = await this.syncRange(underlying, spec.unit, spec.interval, from, to, delayMs);
      out.push(r);
    }
    return out;
  }

  async syncAllRecent() {
    if (!process.env.UPSTOX_ACCESS_TOKEN && !process.env.UPSTOX_API_KEY) return [];
    const results = [];
    for (const sym of INDEX_UNDERLYINGS) {
      try {
        const part = await this.syncRecent(sym);
        results.push({ underlying: sym, parts: part });
      } catch (e) {
        console.warn(`[IndexOhlc] syncRecent failed ${sym}:`, e.message);
      }
    }
    return results;
  }

  async maybeBackfillOnStartup() {
    if (process.env.INDEX_OHLC_V3_BACKFILL !== 'true') return;
    if (!process.env.UPSTOX_ACCESS_TOKEN && !process.env.UPSTOX_API_KEY) return;
    const months = Math.min(36, Math.max(1, Number(process.env.INDEX_OHLC_BACKFILL_MONTHS) || 24));
    console.log(`[IndexOhlc] Starting background v3 backfill (${months} mo per index)...`);
    setImmediate(async () => {
      for (const sym of INDEX_UNDERLYINGS) {
        try {
          await this.backfillUnderlying(sym, months, 700);
          console.log(`[IndexOhlc] Backfill done for ${sym}`);
        } catch (e) {
          console.warn(`[IndexOhlc] Backfill failed ${sym}:`, e.message);
        }
      }
    });
  }

  mapTimeframeToSpec(timeframe) {
    const tf = String(timeframe || '1h').toLowerCase();
    if (tf === '1m' || tf === '1min') return { unit: 'minutes', interval: 1 };
    if (tf === '1h' || tf === '60m') return { unit: 'hours', interval: 1 };
    if (tf === '1d' || tf === '1D') return { unit: 'days', interval: 1 };
    return { unit: 'hours', interval: 1 };
  }

  async getOhlc(underlying, timeframe = '1h', limit = 5000) {
    const u = fnoService.normalizeQuery(underlying);
    if (!INDEX_UNDERLYINGS.includes(u)) {
      throw new Error('underlying must be one of NIFTY, BANKNIFTY, FINNIFTY');
    }
    const { unit, interval } = this.mapTimeframeToSpec(timeframe);
    const safeLimit = Math.max(10, Math.min(20000, Number(limit) || 5000));

    const result = await client.query({
      query: `
        SELECT bar_time, open, high, low, close, volume, unit, interval
        FROM index_ohlc
        WHERE underlying_symbol = {u:String} AND unit = {unit:String} AND interval = {iv:UInt16}
        ORDER BY bar_time DESC
        LIMIT {lim:UInt32}
      `,
      query_params: { u, unit, iv: interval, lim: safeLimit },
      format: 'JSONEachRow',
    });
    const rows = await result.json();
    const seen = new Set();
    const out = [];
    for (const row of rows) {
      const bt = String(row.bar_time).replace(' ', 'T');
      const t = Math.floor(new Date(bt.endsWith('Z') ? bt : `${bt}Z`).getTime() / 1000);
      if (seen.has(t)) continue;
      seen.add(t);
      out.push({
        time: t,
        open: Number(row.open),
        high: Number(row.high),
        low: Number(row.low),
        close: Number(row.close),
        volume: Number(row.volume) || 0,
      });
    }
    return out.reverse();
  }
}

module.exports = new IndexOhlcService();

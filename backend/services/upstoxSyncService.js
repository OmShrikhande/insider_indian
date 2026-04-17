const { client, testConnection } = require('../config/database');
const upstoxApi = require('./upstoxApiService');
const fnoService = require('./fnoService');

/**
 * UpstoxSyncService - Handles background data synchronization.
 * ROAST FIX: Eliminated redundant fetching/normalization logic by delegating to UpstoxApiService and FnoService.
 */
class UpstoxSyncService {
  constructor() {
    this.isSyncing = { '15m': false, '1h': false, '1d': false };
    this.intervals = [];
    this.instrumentCache = new Map();
  }

  resampleCandles(rawCandles, timeframe) {
    if (!rawCandles.length || timeframe === '1d' || timeframe === '30m' || timeframe === '1m') {
      return rawCandles;
    }
    const minutes = timeframe === '15m' ? 15 : 60;
    const resampled = [];
    const sorted = [...rawCandles].reverse();
    let currentBucket = [];
    for (const candle of sorted) {
      const date = new Date(candle[0]);
      const bucketTimestamp = Math.floor(date.getTime() / (minutes * 60 * 1000)) * (minutes * 60 * 1000);
      if (currentBucket.length === 0 || currentBucket[0].bucket === bucketTimestamp) {
        currentBucket.push({ candle, bucket: bucketTimestamp });
      } else {
        resampled.push(this.summarizeBucket(currentBucket));
        currentBucket = [{ candle, bucket: bucketTimestamp }];
      }
    }
    if (currentBucket.length > 0) resampled.push(this.summarizeBucket(currentBucket));
    return resampled.reverse();
  }

  summarizeBucket(bucket) {
    const candles = bucket.map(b => b.candle);
    let high = -Infinity, low = Infinity, vol = 0;
    for (const c of candles) {
      if (c[2] > high) high = c[2];
      if (c[3] < low) low = c[3];
      vol += (c[5] || 0);
    }
    return [new Date(bucket[0].bucket).toISOString(), candles[0][1], high, low, candles[candles.length - 1][4], vol, candles[candles.length - 1][6]];
  }

  shouldRun() { return process.env.ENABLE_UPSTOX_SYNC === 'true'; }
  hasCredentials() { return Boolean(process.env.UPSTOX_ACCESS_TOKEN); }

  async init() {
    if (!this.shouldRun()) return console.log('[UpstoxSync] Disabled.');
    if (!this.hasCredentials()) return console.warn('[UpstoxSync] Missing credentials.');

    const dbConnected = await testConnection();
    if (!dbConnected) return console.warn('[UpstoxSync] Database not available.');

    console.log('[UpstoxSync] Initializing background sync jobs...');
    await this.runAllTimeframes();

    this.intervals.push(setInterval(() => this.syncTimeframe('15m'), 15 * 60 * 1000));
    this.intervals.push(setInterval(() => {
      this.syncTimeframe('1h');
      this.syncFnoATM();
    }, 60 * 60 * 1000));
    this.intervals.push(setInterval(() => this.syncTimeframe('1d'), 24 * 60 * 60 * 1000));
    
    this.syncFnoATM();
  }

  async runAllTimeframes() {
    await Promise.all([this.syncTimeframe('15m'), this.syncTimeframe('1h'), this.syncTimeframe('1d')]);
  }

  async getTrackedStocks() {
    // Limited to top 300 stocks for sync performance
    const q = 'SELECT symbol, sector, instrument_key FROM stocks_summary ORDER BY symbol LIMIT 300';
    try {
      const result = await client.query({ query: q, format: 'JSONEachRow' });
      const rows = await result.json();
      if (rows.length > 0) return rows;
    } catch (e) {
      console.warn('[UpstoxSync] Summary lookup failed, falling back...');
    }
    return [];
  }

  async syncTimeframe(timeframe) {
    if (this.isSyncing[timeframe]) return;
    this.isSyncing[timeframe] = true;

    try {
      const stocks = await this.getTrackedStocks();
      if (!stocks.length) return;

      const table = timeframe === '15m' ? 'stocks_15min' : (timeframe === '1h' ? 'stocks_hourly' : 'stocks_daily');
      const lookback = timeframe === '15m' ? 30 : (timeframe === '1h' ? 90 : 365);

      for (const stock of stocks) {
        try {
          // ROAST FIX: Persistent Caching. check memory -> check DB -> search Upstox
          let instrumentKey = this.instrumentCache.get(stock.symbol) || stock.instrument_key;
          
          if (!instrumentKey) {
            const segment = (stock.sector === 'INDEX' || stock.symbol.includes('NIFTY')) ? 'INDEX' : 'EQ';
            const searchSymbol = stock.symbol === 'NIFTY' ? 'Nifty 50' : (stock.symbol === 'BANKNIFTY' ? 'Nifty Bank' : stock.symbol);
            
            const instruments = await upstoxApi.searchInstrument(searchSymbol, 'NSE', segment, 1);
            if (!instruments.length || !instruments[0].instrument_key) {
              console.warn(`[UpstoxSync] Could not resolve ${stock.symbol} on segment ${segment}. Skipping.`);
              continue;
            }
            instrumentKey = instruments[0].instrument_key;
            
            // Persist found key to DB to avoid searching next time
            this.instrumentCache.set(stock.symbol, instrumentKey);
            await client.command({
              query: `ALTER TABLE stocks_summary UPDATE instrument_key = {ik:String} WHERE symbol = {s:String}`,
              query_params: { ik: instrumentKey, s: stock.symbol }
            });
            console.log(`[UpstoxSync] ⚡ Persisted new key for ${stock.symbol}: ${instrumentKey}`);
          } else {
            this.instrumentCache.set(stock.symbol, instrumentKey);
          }

          const rawCandles = await upstoxApi.fetchCandles(instrumentKey, timeframe, lookback);
          if (!rawCandles.length) continue;

          // ROAST FIX: Resample 1m data if needed
          const processedCandles = this.resampleCandles(rawCandles, timeframe);
          if (!processedCandles.length) continue;

          // ... max(date) logic ...
          const latestRes = await client.query({
            query: `SELECT max(date) as latest FROM ${table} WHERE symbol = {s:String}`,
            query_params: { s: stock.symbol },
            format: 'JSONEachRow'
          });
          const latest = (await latestRes.json())[0]?.latest;
          const latestDate = latest ? new Date(latest) : null;

          const rows = processedCandles.map(c => {
            const n = upstoxApi.normalizeCandle(c);
            return {
              date: n.date, open: n.open, high: n.high, low: n.low, close: n.close, volume: n.volume,
              symbol: stock.symbol, timeframe, sector: stock.sector || ''
            };
          }).filter(r => !latestDate || new Date(r.date) > latestDate);

          if (rows.length > 0) {
            await client.insert({ table, values: rows, format: 'JSONEachRow' });
            console.log(`[UpstoxSync] ${stock.symbol} ${timeframe}: +${rows.length} rows.`);
          }
        } catch (e) {
          console.warn(`[UpstoxSync] Error syncing ${stock.symbol}:`, e.message);
        }
        await new Promise(r => setTimeout(r, 250)); // Increased Throttling (250ms) to respect Upstox Rate Limits
      }
    } finally {
      this.isSyncing[timeframe] = false;
    }
  }

  async syncFnoATM() {
    if (process.env.UPSTOX_FNO_SYNC_ENABLED !== 'true') return;
    const rawIndices = (process.env.UPSTOX_FNO_SEED_SYMBOLS || 'NIFTY,BANKNIFTY').split(',');
    
    // Official Upstox v2 search terms for indices
    const indexMap = {
      'NIFTY': 'Nifty 50',
      'BANKNIFTY': 'Nifty Bank',
      'FINNIFTY': 'Nifty Fin Service'
    };

    for (const rawIndex of rawIndices) {
      try {
        const indexSearch = indexMap[rawIndex.toUpperCase()] || rawIndex;
        
        // ROAST FIX: Indices MUST be searched in the INDEX segment
        const instruments = await upstoxApi.searchInstrument(indexSearch, 'NSE', 'INDEX', 1);
        if (!instruments.length || !instruments[0].instrument_key) {
          console.warn(`[UpstoxSync] Could not resolve Index Key for ${rawIndex}. Skipping.`);
          continue;
        }

        const instrumentKey = instruments[0].instrument_key;
        const candles = await upstoxApi.fetchCandles(instrumentKey, '1h', 1);
        if (!candles.length) continue;
        const ltp = Number(candles[0][4]);

        const res = await client.query({
          query: `
            SELECT instrument_key, trading_symbol, underlying_symbol, expiry, strike, option_type
            FROM fno_contracts
            WHERE underlying_symbol = {u:String} AND expiry >= today()
            ORDER BY expiry ASC, abs(strike - {ltp:Float64}) ASC
            LIMIT 10
          `,
          query_params: { u: index.toUpperCase(), ltp },
          format: 'JSONEachRow'
        });
        const contracts = await res.json();
        
        if (contracts.length > 0) {
          const nearestExpiry = contracts[0].expiry;
          const atmContracts = contracts.filter(c => c.expiry === nearestExpiry).slice(0, 4);
          
          for (const contract of atmContracts) {
             // ROAST FIX: Delegating specific contract sync to FnoService to avoid logic duplication
             await fnoService.fetchAndStoreOhlcv(contract, '1h');
             await fnoService.fetchAndStoreOhlcv(contract, '15m');
          }
        }
      } catch (err) {
        console.warn(`[UpstoxSync] FNO sync failed for ${index}:`, err.message);
      }
    }
  }
}

module.exports = new UpstoxSyncService();

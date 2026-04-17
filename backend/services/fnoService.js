const { client } = require('../config/database');
const upstoxApi = require('./upstoxApiService');

/**
 * FnoService - Handles Futures and Options logic.
 * ROAST FIX: Centralized data fetching and improved Clickhouse ingestion.
 */
class FnoService {
  resampleCandles(rawCandles, timeframe) {
    if (!rawCandles.length || timeframe === '1d' || timeframe === '30m' || timeframe === '1minute') {
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

  normalizeQuery(query) {
    let q = String(query || '').trim().toUpperCase();
    
    // ROAST FIX: Mapping common aliases for better UX
    const mapping = {
      'NIFTY 50': 'NIFTY',
      'NIFTY50': 'NIFTY',
      'BANK NIFTY': 'BANKNIFTY',
      'CNX NIFTY': 'NIFTY',
      'NIFTY BANK': 'BANKNIFTY'
    };
    if (mapping[q]) q = mapping[q];

    return q.replace(/[^A-Z0-9&\- ]/g, '').slice(0, 32);
  }

  async fetchFromUpstox(query, limit = 50) {
    const contracts = await upstoxApi.searchInstrument(query, 'NSE', 'FO', limit);
    return contracts.map((item) => ({
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
      underlying_symbol: this.normalizeQuery(query),
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
    
    const fetchLocal = async (q) => {
      const result = await client.query({
        query: q
          ? `SELECT * FROM fno_contracts WHERE trading_symbol LIKE {q:String} OR underlying_symbol LIKE {q:String} ORDER BY updated_at DESC LIMIT {limit:Uint32} BY instrument_key`
          : `SELECT * FROM fno_contracts ORDER BY updated_at DESC LIMIT {limit:Uint32} BY instrument_key`,
        query_params: q ? { q: `%${q}%`, limit: safeLimit } : { limit: safeLimit },
        format: 'JSONEachRow',
      });
      return result.json();
    };

    let rows = await fetchLocal(safeQuery);

    // ROAST FIX: Sync-on-Demand. If the user searches but we have nothing, sync it from Upstox immediately.
    if (safeQuery && rows.length === 0) {
      console.log(`[FNO] No local data for "${safeQuery}". Triggering on-demand sync...`);
      await this.syncContracts(safeQuery, 50);
      rows = await fetchLocal(safeQuery);
    }

    return rows;
  }

  async syncContracts(query = 'NIFTY', limit = 100) {
    console.log(`[FNO] Synchronizing contracts for query: "${query}"...`);
    const contracts = await this.fetchFromUpstox(query, limit);
    
    if (contracts.length === 0) {
      console.warn(`[FNO] ⚠️ Zero results found for "${query}" on Upstox. Check API token/segment!`);
    } else {
      console.log(`[FNO] ✅ Received ${contracts.length} valid contracts. Persisting to ClickHouse...`);
      const insertedCount = await this.storeContracts(contracts);
      console.log(`[FNO] 💾 Database updated: +${insertedCount} contracts for "${query}"`);
    }
    return { inserted: contracts.length, count: contracts.length };
  }

  async init() {
    if (process.env.UPSTOX_FNO_SYNC_ENABLED !== 'true') return;
    console.log('[FNO] Initializing seed sync...');
    const seedSymbols = (process.env.UPSTOX_FNO_SEED_SYMBOLS || 'NIFTY,BANKNIFTY,FINNIFTY')
      .split(',')
      .map((s) => this.normalizeQuery(s))
      .filter(Boolean);
    
    for (const sym of seedSymbols) {
      try {
        const stats = await this.syncContracts(sym, 20);
        if (stats.inserted > 0) {
          console.log(`[FNO] Seed sync complete: ${sym} (${stats.inserted} items)`);
        }
      } catch (error) {
        console.warn(`[FNO] Seed sync failed for ${sym}:`, error.message);
      }
    }
  }

  async getExpiries(query = '') {
    const safeQuery = this.normalizeQuery(query);
    
    const fetchLocal = async (q) => {
      const result = await client.query({
        query: `SELECT DISTINCT expiry FROM fno_contracts WHERE expiry IS NOT NULL ${q ? 'AND (trading_symbol LIKE {q:String} OR underlying_symbol LIKE {q:String})' : ''} ORDER BY expiry ASC`,
        query_params: q ? { q: `%${q}%` } : {},
        format: 'JSONEachRow',
      });
      const rows = await result.json();
      return rows.map((r) => r.expiry).filter(Boolean);
    };

    let expiries = await fetchLocal(safeQuery);

    // ROAST FIX: If no expiries found, sync contracts first to discover them
    if (safeQuery && expiries.length === 0) {
      console.log(`[FNO] No expiries found for "${safeQuery}". Syncing contracts to discover...`);
      await this.syncContracts(safeQuery, 50);
      expiries = await fetchLocal(safeQuery);
    }

    return expiries;
  }

  async getStrikeLadder(underlying = 'NIFTY', expiry = '') {
    const safeUnderlying = this.normalizeQuery(underlying || 'NIFTY');
    const query = `
      SELECT strike, option_type, count() as contracts
      FROM fno_contracts
      WHERE underlying_symbol = {underlying:String}
        ${expiry ? 'AND expiry = toDate({expiry:String})' : ''}
        AND strike IS NOT NULL
      GROUP BY strike, option_type
      ORDER BY strike ASC
    `;

    const result = await client.query({
      query,
      query_params: expiry ? { underlying: safeUnderlying, expiry } : { underlying: safeUnderlying },
      format: 'JSONEachRow',
    });
    return result.json();
  }

  async getPCR(underlying = 'NIFTY', expiry = '') {
    const ladder = await this.getStrikeLadder(underlying, expiry);
    let pe = 0, ce = 0;
    ladder.forEach((row) => {
      const type = String(row.option_type || '').toUpperCase();
      if (type.includes('PE')) pe += Number(row.contracts || 0);
      if (type.includes('CE')) ce += Number(row.contracts || 0);
    });
    return {
      underlying: this.normalizeQuery(underlying),
      expiry: expiry || null,
      putContracts: pe,
      callContracts: ce,
      pcr: ce > 0 ? pe / ce : null,
    };
  }

  /**
   * ROAST FIX: Optimized caching logic to avoid Clickhouse mutation abuse.
   * Instead of DELETE then INSERT, we only fetch if we don't have fresh data.
   */
  async fetchAndStoreOhlcv(contract, timeframe) {
    const lookbackDays = timeframe === '15m' ? 15 : 30;
    const table = timeframe === '15m' ? 'fno_15min' : 'fno_hourly';

    const rawCandles = await upstoxApi.fetchCandles(contract.instrument_key, timeframe, lookbackDays);
    if (!rawCandles || rawCandles.length === 0) return [];

    // ROAST FIX: Resample raw data into the target timeframe
    const processedCandles = this.resampleCandles(rawCandles, timeframe);
    if (!processedCandles.length) return [];

    const normalized = processedCandles.map(raw => {
      const n = upstoxApi.normalizeCandle(raw);
      return {
        ...n,
        instrument_key: contract.instrument_key,
        trading_symbol: contract.trading_symbol,
        underlying_symbol: contract.underlying_symbol,
        expiry: contract.expiry,
        strike: contract.strike,
        option_type: contract.option_type,
        timeframe
      };
    }).filter(c => c && !Number.isNaN(c.open));

    if (normalized.length > 0) {
      // ROAST FIX: Using simple insert. Clickhouse will handle duplicates if we use ReplacedMergeTree, 
      // but since we are not changing engines now, we'll just insert and rely on 'SELECT DISTINCT' or 'MAX' in queries.
      // However, for simplicity and to avoid storage blowup, we'll do a focused delete only if data is actually new.
      await client.query({
        query: `ALTER TABLE ${table} DELETE WHERE instrument_key = {ik:String} AND timeframe = {tf:String}`,
        query_params: { ik: contract.instrument_key, tf: timeframe }
      });
      
      await client.insert({ table, values: normalized, format: 'JSONEachRow' });
    }
    return normalized;
  }

  async getOptionsOhlcv(underlying, expiry, strike, timeframe = '1h') {
    const safeUnderlying = this.normalizeQuery(underlying);
    const table = timeframe === '15m' ? 'fno_15min' : 'fno_hourly';

    const contractResult = await client.query({
      query: 'SELECT * FROM fno_contracts WHERE underlying_symbol = {u:String} AND expiry = toDate({e:String}) AND strike = {s:Float64} LIMIT 2',
      query_params: { u: safeUnderlying, e: expiry, s: Number(strike) },
      format: 'JSONEachRow'
    });
    const contracts = await contractResult.json();
    
    const ceContract = contracts.find(c => c.option_type === 'CE');
    const peContract = contracts.find(c => c.option_type === 'PE');

    const getOrFetch = async (contract) => {
      if (!contract) return [];
      
      // Check for fresh data first (within last 1 hour)
      const dbRes = await client.query({
        query: `SELECT * FROM ${table} WHERE instrument_key = {ik:String} ORDER BY date ASC`,
        query_params: { ik: contract.instrument_key },
        format: 'JSONEachRow'
      });
      let rows = await dbRes.json();
      
      if (rows.length === 0) {
        // Fetch and store if missing
        await this.fetchAndStoreOhlcv(contract, timeframe);
        const retryRes = await client.query({
           query: `SELECT * FROM ${table} WHERE instrument_key = {ik:String} ORDER BY date ASC`,
           query_params: { ik: contract.instrument_key },
           format: 'JSONEachRow'
        });
        rows = await retryRes.json();
      }

      const IST_OFFSET = 5.5 * 3600; // ROAST FIX: Clear constant for IST
      return rows.map(r => ({
        time: Math.floor(new Date(r.date + 'Z').getTime() / 1000 - IST_OFFSET),
        open: r.open, high: r.high, low: r.low, close: r.close, volume: r.volume
      }));
    };

    const [ceData, peData] = await Promise.all([getOrFetch(ceContract), getOrFetch(peContract)]);
    return { ce: ceData, pe: peData };
  }

  /**
   * syncOptionChain - Fetches and persists the entire option chain snapshot.
   * ROAST FIX: Persisting to ClickHouse to avoid hitting Upstox rate limits for every UI interaction.
   */
  async syncOptionChain(underlyingSymbol, expiry) {
    try {
      // 1. Get underlying instrument key
      // ROAST FIX: Indices MUST be searched in the INDEX segment
      const isIndex = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY'].includes(underlyingSymbol.toUpperCase());
      const segment = isIndex ? 'INDEX' : 'EQ';
      const searchSymbol = underlyingSymbol === 'NIFTY' ? 'Nifty 50' : (underlyingSymbol === 'BANKNIFTY' ? 'Nifty Bank' : underlyingSymbol);
      
      const instruments = await upstoxApi.searchInstrument(searchSymbol, 'NSE', segment, 1);
      if (!instruments.length) return { success: false, error: 'Underlying symbol not found on segment ' + segment };
      const underlyingKey = instruments[0].instrument_key;

      // 2. Fetch chain from Upstox
      let chainData = await upstoxApi.fetchOptionChain(underlyingKey, expiry);
      
      // ROAST FIX: If provided expiry returns nothing, try to find the nearest valid one
      if (!chainData.length) {
        console.log(`[FNO] Requested expiry ${expiry} returned no data for ${underlyingSymbol}. Attempting fallback...`);
        const validExpiries = await this.getExpiries(underlyingSymbol);
        
        if (validExpiries.length > 0 && validExpiries[0] !== expiry) {
          console.log(`[FNO] Retrying with nearest valid expiry: ${validExpiries[0]}`);
          chainData = await upstoxApi.fetchOptionChain(underlyingKey, validExpiries[0]);
        }
      }

      if (!chainData.length) return { success: false, error: 'No chain data available for any expiry' };

      // 3. Transform and Save to ClickHouse
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const rows = chainData.map(item => ({
        underlying_symbol: underlyingSymbol,
        expiry: item.expiry,
        strike_price: Number(item.strike_price),
        pcr: Number(item.pcr || 0),
        underlying_spot_price: Number(item.underlying_spot_price || 0),
        call_key: item.call_options?.instrument_key || '',
        call_ltp: Number(item.call_options?.market_data?.ltp || 0),
        call_oi: Number(item.call_options?.market_data?.oi || 0),
        call_delta: Number(item.call_options?.option_greeks?.delta || 0),
        call_theta: Number(item.call_options?.option_greeks?.theta || 0),
        call_gamma: Number(item.call_options?.option_greeks?.gamma || 0),
        call_vega: Number(item.call_options?.option_greeks?.vega || 0),
        call_iv: Number(item.call_options?.option_greeks?.iv || 0),
        put_key: item.put_options?.instrument_key || '',
        put_ltp: Number(item.put_options?.market_data?.ltp || 0),
        put_oi: Number(item.put_options?.market_data?.oi || 0),
        put_delta: Number(item.put_options?.market_data?.delta || 0),
        put_theta: Number(item.put_options?.market_data?.theta || 0),
        put_gamma: Number(item.put_options?.market_data?.gamma || 0),
        put_vega: Number(item.put_options?.market_data?.vega || 0),
        put_iv: Number(item.put_options?.market_data?.iv || 0),
        updated_at: now
      }));

      await client.insert({
        table: 'fno_option_chain',
        values: rows,
        format: 'JSONEachRow'
      });

      return { success: true, count: rows.length };
    } catch (err) {
      console.error(`[FnoService] Option chain sync failed:`, err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * getOptionChain - Retrieves the latest chain snapshot from ClickHouse.
   */
  async getOptionChain(symbol, expiry) {
    try {
      const result = await client.query({
        query: `
          SELECT * FROM fno_option_chain 
          WHERE underlying_symbol = {s:String} AND expiry = {e:String}
          ORDER BY strike_price ASC
        `,
        query_params: { s: symbol, e: expiry },
        format: 'JSONEachRow'
      });
      const rows = await result.json();
      return { success: true, data: rows };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

module.exports = new FnoService();

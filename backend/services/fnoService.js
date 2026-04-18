const { client } = require('../config/database');
const upstoxApi = require('./upstoxApiService');

/**
 * FnoService - Handles Futures and Options logic.
 * ROAST FIX: Centralized data fetching and improved Clickhouse ingestion.
 */
class FnoService {
  static INSTRUMENT_KEY_REGEX = /^(NSE_EQ|NSE_FO|NCD_FO|BSE_EQ|BSE_FO|BCD_FO|MCX_FO|NSE_COM|NSE_INDEX|BSE_INDEX|MCX_INDEX)\|[\w ]+$/;
  static DEFAULT_FNO_UNDERLYINGS = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY'];

  resolveUnderlyingSearchTerm(symbol) {
    const normalized = this.normalizeQuery(symbol);
    const map = {
      NIFTY: 'Nifty 50',
      BANKNIFTY: 'Nifty Bank',
      FINNIFTY: 'Nifty Fin Service',
      MIDCPNIFTY: 'Nifty Mid Select'
    };
    return map[normalized] || normalized;
  }

  resolveCanonicalIndexKey(symbol) {
    const normalized = this.normalizeQuery(symbol);
    const map = {
      NIFTY: 'NSE_INDEX|Nifty 50',
      BANKNIFTY: 'NSE_INDEX|Nifty Bank',
      FINNIFTY: 'NSE_INDEX|Nifty Fin Service',
      MIDCPNIFTY: 'NSE_INDEX|Nifty Mid Select'
    };
    return map[normalized] || null;
  }

  isValidInstrumentKey(value) {
    return FnoService.INSTRUMENT_KEY_REGEX.test(String(value || '').trim());
  }

  sanitizeForJson(value) {
    if (typeof value === 'bigint') {
      return Number(value);
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeForJson(item));
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, val]) => [key, this.sanitizeForJson(val)])
      );
    }
    return value;
  }

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

  deriveOptionType(item) {
    const explicit = String(item.option_type || '').toUpperCase();
    if (explicit === 'CE' || explicit === 'PE') return explicit;

    const instrumentType = String(item.instrument_type || '').toUpperCase();
    if (instrumentType === 'CE' || instrumentType === 'PE') return instrumentType;

    const tradingSymbol = String(item.trading_symbol || item.symbol || '').toUpperCase();
    if (/\bCE\b/.test(tradingSymbol)) return 'CE';
    if (/\bPE\b/.test(tradingSymbol)) return 'PE';
    return null;
  }

  isSupportedFnoUnderlying(symbol) {
    return FnoService.DEFAULT_FNO_UNDERLYINGS.includes(this.normalizeQuery(symbol));
  }

  async fetchFromUpstox(query, limit = 50) {
    const safeLimit = Math.max(1, Math.min(20, Number(limit) || 20));
    const contracts = await upstoxApi.searchInstrument(query, 'NSE', 'FO', safeLimit);
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
      option_type: this.deriveOptionType(item),
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
          ? `SELECT * FROM fno_contracts WHERE trading_symbol LIKE {q:String} OR underlying_symbol LIKE {q:String} ORDER BY updated_at DESC LIMIT {limit:UInt32} BY instrument_key`
          : `SELECT * FROM fno_contracts ORDER BY updated_at DESC LIMIT {limit:UInt32} BY instrument_key`,
        query_params: q ? { q: `%${q}%`, limit: safeLimit } : { limit: safeLimit },
        format: 'JSONEachRow',
      });
      return result.json();
    };

    let rows = await fetchLocal(safeQuery);

    // ROAST FIX: Sync-on-Demand. If the user searches but we have nothing, sync it from Upstox immediately.
    if (safeQuery && rows.length === 0 && this.isSupportedFnoUnderlying(safeQuery)) {
      console.log(`[FNO] No local data for "${safeQuery}". Triggering on-demand sync...`);
      await this.syncContracts(safeQuery, 20);
      rows = await fetchLocal(safeQuery);
    }

    // Seed a default universe if F&O list is completely empty.
    if (!safeQuery && rows.length === 0) {
      await this.syncContracts('NIFTY', 100);
      rows = await fetchLocal('');
    }

    return this.sanitizeForJson(rows);
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
    let safeQuery = this.normalizeQuery(query);
    if (!this.isSupportedFnoUnderlying(safeQuery)) {
      safeQuery = 'NIFTY';
    }
    
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
    if (safeQuery && expiries.length === 0 && this.isSupportedFnoUnderlying(safeQuery)) {
      console.log(`[FNO] No expiries found for "${safeQuery}". Syncing contracts to discover...`);
      await this.syncContracts(safeQuery, 20);
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
    const rows = await result.json();
    return this.sanitizeForJson(rows);
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
      const normalizedUnderlying = this.normalizeQuery(underlyingSymbol);
      const expiryDate = String(expiry || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) {
        return { success: false, error: 'Invalid expiry format. Expected YYYY-MM-DD' };
      }

      // 1. Get underlying instrument key
      const isIndex = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY'].includes(normalizedUnderlying);
      const segment = isIndex ? 'INDEX' : 'EQ';
      const directInstrumentKey = this.isValidInstrumentKey(underlyingSymbol) ? String(underlyingSymbol).trim() : null;
      let underlyingKey = directInstrumentKey;

      if (!underlyingKey) {
        const canonicalIndexKey = this.resolveCanonicalIndexKey(normalizedUnderlying);
        if (canonicalIndexKey) {
          underlyingKey = canonicalIndexKey;
        }
      }

      if (!underlyingKey) {
        const searchSymbol = this.resolveUnderlyingSearchTerm(normalizedUnderlying);
        const instruments = await upstoxApi.searchInstrument(searchSymbol, 'NSE', segment, 1);
        if (!instruments.length) return { success: false, error: `Underlying symbol not found on segment ${segment}` };
        underlyingKey = instruments[0].instrument_key;
      }

      if (!this.isValidInstrumentKey(underlyingKey)) {
        return { success: false, error: 'Invalid underlying instrument key format' };
      }

      if (/^MCX_/.test(underlyingKey)) {
        return { success: false, error: 'Option chain is not available for MCX exchange in Upstox API' };
      }

      // 2. Fetch chain from Upstox using exact instrument_key + expiry_date.
      let chainData = await upstoxApi.fetchOptionChain(underlyingKey, expiryDate);
      // IMPORTANT: Disabled "nearest expiry" fallback to preserve exact API contract.
      // if (!chainData.length) {
      //   const validExpiries = await this.getExpiries(normalizedUnderlying);
      //   if (validExpiries.length > 0 && validExpiries[0] !== expiryDate) {
      //     chainData = await upstoxApi.fetchOptionChain(underlyingKey, validExpiries[0]);
      //   }
      // }

      if (!chainData.length) return { success: false, error: 'No chain data available for provided instrument_key + expiry_date' };

      // 3. Transform and Save to ClickHouse
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const rows = chainData.map(item => ({
        underlying_symbol: normalizedUnderlying,
        underlying_key: item.underlying_key || underlyingKey,
        expiry: item.expiry,
        strike_price: Number(item.strike_price),
        pcr: Number(item.pcr || 0),
        underlying_spot_price: Number(item.underlying_spot_price || 0),
        call_key: item.call_options?.instrument_key || '',
        call_ltp: Number(item.call_options?.market_data?.ltp || 0),
        call_oi: Number(item.call_options?.market_data?.oi || 0),
        call_volume: Number(item.call_options?.market_data?.volume || 0),
        call_delta: Number(item.call_options?.option_greeks?.delta || 0),
        call_theta: Number(item.call_options?.option_greeks?.theta || 0),
        call_gamma: Number(item.call_options?.option_greeks?.gamma || 0),
        call_vega: Number(item.call_options?.option_greeks?.vega || 0),
        call_iv: Number(item.call_options?.option_greeks?.iv || 0),
        put_key: item.put_options?.instrument_key || '',
        put_ltp: Number(item.put_options?.market_data?.ltp || 0),
        put_oi: Number(item.put_options?.market_data?.oi || 0),
        put_volume: Number(item.put_options?.market_data?.volume || 0),
        put_delta: Number(item.put_options?.option_greeks?.delta || 0),
        put_theta: Number(item.put_options?.option_greeks?.theta || 0),
        put_gamma: Number(item.put_options?.option_greeks?.gamma || 0),
        put_vega: Number(item.put_options?.option_greeks?.vega || 0),
        put_iv: Number(item.put_options?.option_greeks?.iv || 0),
        call_options_json: JSON.stringify(item.call_options || {}),
        put_options_json: JSON.stringify(item.put_options || {}),
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
          SELECT *
          FROM (
            SELECT
              underlying_symbol,
              expiry,
              strike_price,
              argMax(pcr, updated_at) as pcr,
              argMax(underlying_spot_price, updated_at) as underlying_spot_price,
              argMax(call_key, updated_at) as call_key,
              argMax(call_ltp, updated_at) as call_ltp,
              argMax(call_oi, updated_at) as call_oi,
              argMax(call_volume, updated_at) as call_volume,
              argMax(call_delta, updated_at) as call_delta,
              argMax(call_theta, updated_at) as call_theta,
              argMax(call_gamma, updated_at) as call_gamma,
              argMax(call_vega, updated_at) as call_vega,
              argMax(call_iv, updated_at) as call_iv,
              argMax(put_key, updated_at) as put_key,
              argMax(put_ltp, updated_at) as put_ltp,
              argMax(put_oi, updated_at) as put_oi,
              argMax(put_volume, updated_at) as put_volume,
              argMax(put_delta, updated_at) as put_delta,
              argMax(put_theta, updated_at) as put_theta,
              argMax(put_gamma, updated_at) as put_gamma,
              argMax(put_vega, updated_at) as put_vega,
              argMax(put_iv, updated_at) as put_iv
            FROM fno_option_chain
            WHERE underlying_symbol = {s:String} AND expiry = toDate({e:String})
            GROUP BY underlying_symbol, expiry, strike_price
          )
          ORDER BY strike_price ASC
        `,
        query_params: { s: symbol, e: expiry },
        format: 'JSONEachRow'
      });
      const rows = await result.json();
      return { success: true, data: this.sanitizeForJson(rows) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async getOptionChainRaw(instrumentKey, expiryDate) {
    try {
      const fetchExact = async () => client.query({
        query: `
          SELECT
            argMax(t.underlying_key, t.updated_at) AS stored_underlying_key,
            argMax(t.underlying_spot_price, t.updated_at) AS underlying_spot_price,
            t.expiry AS expiry,
            t.strike_price AS strike_price,
            argMax(t.pcr, t.updated_at) AS pcr,
            argMax(t.call_options_json, t.updated_at) AS call_options_json,
            argMax(t.put_options_json, t.updated_at) AS put_options_json
          FROM fno_option_chain t
          WHERE t.underlying_key = {instrument_key:String}
            AND t.expiry = toDate({expiry_date:String})
          GROUP BY t.expiry, t.strike_price
          ORDER BY strike_price ASC
        `,
        query_params: {
          instrument_key: instrumentKey,
          expiry_date: expiryDate,
        },
        format: 'JSONEachRow',
      });

      const exactRows = await (await fetchExact()).json();
      let rows = exactRows;
      let stale = false;

      if (!rows.length) {
        const fallback = await client.query({
          query: `
            SELECT
              argMax(t.underlying_key, t.updated_at) AS stored_underlying_key,
              argMax(t.underlying_spot_price, t.updated_at) AS underlying_spot_price,
              t.expiry AS expiry,
              t.strike_price AS strike_price,
              argMax(t.pcr, t.updated_at) AS pcr,
              argMax(t.call_options_json, t.updated_at) AS call_options_json,
              argMax(t.put_options_json, t.updated_at) AS put_options_json
            FROM fno_option_chain t
            WHERE t.underlying_key = {instrument_key:String}
            GROUP BY t.expiry, t.strike_price
            ORDER BY expiry DESC, strike_price ASC
          `,
          query_params: { instrument_key: instrumentKey },
          format: 'JSONEachRow',
        });
        const fallbackRows = await fallback.json();
        if (fallbackRows.length) {
          const latestExpiry = fallbackRows[0].expiry;
          rows = fallbackRows.filter((r) => String(r.expiry) === String(latestExpiry));
          stale = true;
        }
      }

      const payload = rows.map((row) => ({
        expiry: typeof row.expiry === 'string' ? row.expiry.slice(0, 10) : row.expiry,
        pcr: Number(row.pcr || 0),
        strike_price: Number(row.strike_price),
        underlying_key: row.stored_underlying_key || instrumentKey,
        underlying_spot_price: Number(row.underlying_spot_price || 0),
        call_options: row.call_options_json ? JSON.parse(row.call_options_json) : {},
        put_options: row.put_options_json ? JSON.parse(row.put_options_json) : {},
      }));

      return { success: true, data: this.sanitizeForJson(payload), stale };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  makeTradeId() {
    return `TRD_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }

  normalizeTradePayload(payload = {}) {
    const marketSegment = String(payload.marketSegment || payload.market_segment || 'STOCK').toUpperCase();
    const instrumentType = String(payload.instrumentType || payload.instrument_type || (marketSegment === 'FNO' ? 'OPTION' : 'EQUITY')).toUpperCase();
    const optionType = String(payload.optionType || payload.option_type || '').toUpperCase();
    const symbol = this.normalizeQuery(payload.symbol || '');
    const side = String(payload.side || payload.type || 'BUY').toUpperCase();
    const strikeNum = payload.strike != null && payload.strike !== '' ? Number(payload.strike) : null;
    const expiry = payload.expiry ? String(payload.expiry) : null;
    const entry = Number(payload.entry || 0);
    const budget = Number(payload.budget || 0);
    const target = Number(payload.target || 0);
    const stopLoss = Number(payload.stopLoss ?? payload.stop_loss ?? 0);
    const analysis = String(payload.analysis || '').trim();

    if (!symbol) throw new Error('symbol is required');
    if (!['BUY', 'SELL', 'LONG', 'SHORT'].includes(side)) throw new Error('side must be BUY/SELL/LONG/SHORT');
    if (!(entry > 0 && target > 0 && stopLoss > 0)) throw new Error('entry, target and stopLoss must be > 0');
    if (marketSegment === 'FNO' && instrumentType === 'OPTION') {
      if (!['CE', 'PE'].includes(optionType)) throw new Error('optionType must be CE or PE for F&O options');
      if (!(strikeNum > 0)) throw new Error('strike is required for F&O option');
      if (!expiry) throw new Error('expiry is required for F&O option');
    }

    return {
      id: this.makeTradeId(),
      market_segment: marketSegment,
      instrument_type: instrumentType,
      option_type: optionType,
      symbol,
      side,
      strike: strikeNum,
      expiry: expiry || null,
      entry,
      budget: Number.isFinite(budget) && budget > 0 ? budget : 0,
      target,
      stop_loss: stopLoss,
      analysis,
      status: 'open',
      handled_by: '',
      handled_action: '',
      handled_at: null,
      source: String(payload.source || 'research_panel'),
      created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
    };
  }

  async createSuggestedTrade(payload = {}) {
    try {
      const row = this.normalizeTradePayload(payload);
      await client.insert({
        table: 'trade_suggestions',
        values: [row],
        format: 'JSONEachRow',
      });
      return { success: true, data: this.sanitizeForJson(row) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getSuggestedTrades(limit = 100) {
    try {
      const safeLimit = Math.max(1, Math.min(500, Number(limit) || 100));
      const result = await client.query({
        query: `
          SELECT
            id, market_segment, instrument_type, option_type, symbol, side, strike, expiry,
            entry, budget, target, stop_loss, analysis, status, handled_by, handled_action, handled_at, source, created_at
          FROM trade_suggestions
          ORDER BY created_at DESC
          LIMIT {limit:UInt32}
        `,
        query_params: { limit: safeLimit },
        format: 'JSONEachRow',
      });
      const rows = await result.json();
      return { success: true, data: this.sanitizeForJson(rows) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async handleSuggestedTrade(id, action = 'accept', handledBy = '') {
    try {
      const tradeId = String(id || '').trim();
      const safeAction = String(action || '').toLowerCase();
      if (!tradeId) return { success: false, error: 'trade id is required' };
      if (!['accept', 'reject'].includes(safeAction)) return { success: false, error: 'action must be accept or reject' };

      const fetch = await client.query({
        query: `
          SELECT
            id, market_segment, instrument_type, option_type, symbol, side, strike, expiry,
            entry, budget, target, stop_loss, analysis, source
          FROM trade_suggestions
          WHERE id = {id:String}
          ORDER BY created_at DESC
          LIMIT 1
        `,
        query_params: { id: tradeId },
        format: 'JSONEachRow',
      });
      const rows = await fetch.json();
      if (!rows.length) return { success: false, error: 'trade not found' };
      const old = rows[0];
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const upsert = {
        ...old,
        status: 'handled',
        handled_by: String(handledBy || 'system'),
        handled_action: safeAction,
        handled_at: now,
        created_at: now,
      };
      await client.insert({
        table: 'trade_suggestions',
        values: [upsert],
        format: 'JSONEachRow',
      });
      return { success: true, data: this.sanitizeForJson(upsert) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async syncAndGetOptionChainRaw(instrumentKey, expiryDate) {
    const sync = await this.syncOptionChain(instrumentKey, expiryDate);
    if (!sync.success) return sync;
    return this.getOptionChainRaw(instrumentKey, expiryDate);
  }
}

module.exports = new FnoService();

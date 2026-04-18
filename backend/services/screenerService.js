const axios = require('axios');
const { client } = require('../config/database');

class ScreenerService {
  constructor() {
    this.apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    this.baseUrl = 'https://www.alphavantage.co/query';
    this.cacheExpiryMinutes = 10; // Cache data for 10 minutes
    this.syncInterval = null;
    this.isSyncing = false;
    this.batchSize = 25; // Lower pressure per batch
    this.batchDelay = 5000; // Faster incremental refresh
    this.initBackgroundSync();
  }

  async initBackgroundSync() {
    // Check database connection before starting sync
    try {
      await client.ping();
    } catch (error) {
      console.warn('[ScreenerService] Database not available. Skipping background sync initialization.');
      return;
    }

    console.log('[ScreenerService] Initializing background screener sync every 15 minutes...');

    // Initial sync
    await this.performBackgroundSync();

    // Set interval (15 minutes = 900000ms)
    this.syncInterval = setInterval(() => {
      this.performBackgroundSync();
    }, 15 * 60 * 1000);
  }

  async performBackgroundSync() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      console.log('[ScreenerService] Performing background screener sync...');

      // Run background scans sequentially to avoid overwhelming the system
      await this.scanMomentumBackground(100);
      await this.scanVolatilityBackground(100);
      await this.scanTrendBackground(100);

      console.log('[ScreenerService] Background screener sync completed');
    } catch (error) {
      console.error('[ScreenerService] Background sync failed:', error.message);
    } finally {
      this.isSyncing = false;
    }
  }

  async getScreenerStatus() {
    try {
      const result = await client.query({
        query: `
          SELECT
            screener_type,
            count(*) as total_records,
            max(updated_at) as last_updated,
            max(updated_at) >= now() - INTERVAL {cacheExpiryMinutes:UInt32} MINUTE as is_fresh
          FROM screener_results
          GROUP BY screener_type
        `,
        query_params: {
          cacheExpiryMinutes: this.cacheExpiryMinutes
        },
        format: 'JSONEachRow',
      });

      const status = await result.json();
      return {
        is_syncing: this.isSyncing,
        batch_size: this.batchSize,
        batch_delay_seconds: this.batchDelay / 1000,
        cache_expiry_minutes: this.cacheExpiryMinutes,
        screeners: status
      };
    } catch (error) {
      console.error('Error getting screener status:', error.message);
      return {
        is_syncing: this.isSyncing,
        batch_size: this.batchSize,
        batch_delay_seconds: this.batchDelay / 1000,
        cache_expiry_minutes: this.cacheExpiryMinutes,
        screeners: []
      };
    }
  }

  async getStockQuote(symbol) {
    // If API key is not configured, return mock data
    if (!this.apiKey || this.apiKey === 'YOUR_FREE_API_KEY_HERE') {
      return this.getMockQuote(symbol);
    }

    try {
      // Add .NS suffix for NSE stocks if not present
      const fullSymbol = symbol.includes('.NS') ? symbol : `${symbol}.NS`;

      const response = await axios.get(this.baseUrl, {
        params: {
          function: 'GLOBAL_QUOTE',
          symbol: fullSymbol,
          apikey: this.apiKey
        }
      });

      if (response.data['Global Quote']) {
        const quote = response.data['Global Quote'];
        return {
          symbol: quote['01. symbol'],
          price: parseFloat(quote['05. price']),
          change: parseFloat(quote['09. change']),
          changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
          volume: parseInt(quote['06. volume'])
        };
      }
      return this.getMockQuote(symbol);
    } catch (error) {
      console.error(`Error fetching quote for ${symbol}:`, error.message);
      return this.getMockQuote(symbol);
    }
  }

  getMockQuote(symbol) {
    // Generate realistic mock data
    const basePrices = {
      'RELIANCE': 2500, 'TCS': 3200, 'HDFCBANK': 1600, 'ICICIBANK': 950,
      'INFY': 1400, 'HINDUNILVR': 2400, 'ITC': 400, 'KOTAKBANK': 1800,
      'LT': 3500, 'AXISBANK': 1100, 'MARUTI': 12000, 'BAJFINANCE': 7200,
      'BHARTIARTL': 1400, 'HCLTECH': 1600, 'WIPRO': 400
    };

    const basePrice = basePrices[symbol] || 1000;
    const changePercent = (Math.random() - 0.5) * 10; // -5% to +5%
    const price = basePrice * (1 + changePercent / 100);
    const change = price - basePrice;

    return {
      symbol: `${symbol}.NS`,
      price: Math.round(price * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
      volume: Math.floor(Math.random() * 1000000) + 100000
    };
  }

  async getStockProfile(symbol) {
    try {
      const fullSymbol = symbol.includes('.NS') ? symbol : `${symbol}.NS`;

      const response = await axios.get(this.baseUrl, {
        params: {
          function: 'OVERVIEW',
          symbol: fullSymbol,
          apikey: this.apiKey
        }
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching profile for ${symbol}:`, error.message);
      return null;
    }
  }

  async getCachedScreenerData(screenerType, limit = 20) {
    try {
      const result = await client.query({
        query: `
          SELECT
            symbol,
            close,
            volume,
            score,
            trend_type,
            updated_at
          FROM screener_results
          WHERE screener_type = {screenerType:String}
            AND updated_at >= now() - INTERVAL {cacheExpiryMinutes:UInt32} MINUTE
          ORDER BY rank ASC
          LIMIT {limit:UInt32}
        `,
        query_params: {
          screenerType,
          cacheExpiryMinutes: this.cacheExpiryMinutes,
          limit: Math.min(5000, Math.max(5, Number(limit) || 20))
        },
        format: 'JSONEachRow',
      });

      const data = await result.json();
      return data.length > 0 ? data : null;
    } catch (error) {
      console.error(`Error fetching cached ${screenerType} data:`, error.message);
      return null;
    }
  }

  async getPartialScreenerData(screenerType, limit = 20) {
    try {
      // Get any recent data, even if not complete
      const result = await client.query({
        query: `
          SELECT
            symbol,
            close,
            volume,
            score,
            trend_type,
            updated_at
          FROM screener_results
          WHERE screener_type = {screenerType:String}
            AND updated_at >= now() - INTERVAL 30 MINUTE
          ORDER BY updated_at DESC, rank ASC
          LIMIT {limit:UInt32}
        `,
        query_params: {
          screenerType,
          limit: Math.min(5000, Math.max(5, Number(limit) || 20))
        },
        format: 'JSONEachRow',
      });

      const data = await result.json();
      return data.length > 0 ? data : null;
    } catch (error) {
      console.error(`Error fetching partial ${screenerType} data:`, error.message);
      return null;
    }
  }

  async storeScreenerData(screenerType, data) {
    try {
      if (!data || data.length === 0) return;

      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

      const rows = data.map((item, index) => ({
        id: `${screenerType}_${item.symbol}_${Date.now()}_${index}`,
        screener_type: screenerType,
        symbol: item.symbol,
        close: item.close || 0,
        volume: item.volume || 0,
        score: item.momentum_score || item.volatility_score || 0,
        trend_type: item.trend_type || '',
        rank: index + 1,
        created_at: now,
        updated_at: now
      }));

      await client.insert({
        table: 'screener_results',
        values: rows,
        format: 'JSONEachRow'
      });

      console.log(`Stored ${rows.length} ${screenerType} screener results`);
    } catch (error) {
      console.error(`Error storing ${screenerType} screener data:`, error.message);
    }
  }

  async getAllAvailableSymbols() {
    try {
      const result = await client.query({
        query: 'SELECT symbol FROM stocks_summary ORDER BY symbol',
        format: 'JSONEachRow',
      });
      const symbols = await result.json();

      if (symbols.length === 0) {
        console.log('No symbols found in database, populating with default stocks...');
        await this.populateDefaultStocks();
        // Retry after populating
        const retryResult = await client.query({
          query: 'SELECT symbol FROM stocks_summary ORDER BY symbol',
          format: 'JSONEachRow',
        });
        const retrySymbols = await retryResult.json();
        return retrySymbols.map(item => item.symbol);
      }

      return symbols.map(item => item.symbol);
    } catch (error) {
      console.error('Error fetching symbols from database:', error.message);
      // Fallback to hardcoded list if database is not available
      return [
        'RELIANCE', 'TCS', 'HDFCBANK', 'ICICIBANK', 'INFY', 'HINDUNILVR', 'ITC', 'KOTAKBANK',
        'LT', 'AXISBANK', 'MARUTI', 'BAJFINANCE', 'BHARTIARTL', 'WIPRO', 'HCLTECH', 'NTPC',
        'POWERGRID', 'ONGC', 'COALINDIA', 'GAIL', 'DRREDDY', 'SUNPHARMA', 'CIPLA', 'DIVISLAB',
        'ABB', 'TORNTPHARM', 'TORNTPOWER', 'TRENT', 'TTKPRESTIG', 'TVSMOTOR', 'UBL',
        'ULTRACEMCO', 'UNIONBANK', 'UNITDSPR', 'VEDL'
      ];
    }
  }

  async populateDefaultStocks() {
    try {
      const stocks = [
        'RELIANCE', 'TCS', 'HDFCBANK', 'ICICIBANK', 'INFY', 'HINDUNILVR', 'ITC', 'KOTAKBANK',
        'LT', 'AXISBANK', 'MARUTI', 'BAJFINANCE', 'BHARTIARTL', 'WIPRO', 'HCLTECH', 'NTPC',
        'POWERGRID', 'ONGC', 'COALINDIA', 'GAIL', 'DRREDDY', 'SUNPHARMA', 'CIPLA', 'DIVISLAB',
        'ABB', 'TORNTPHARM', 'TORNTPOWER', 'TRENT', 'TTKPRESTIG', 'TVSMOTOR', 'UBL',
        'ULTRACEMCO', 'UNIONBANK', 'UNITDSPR', 'VEDL', 'GRASIM', 'NESTLEIND', 'ASIANPAINT',
        'BAJAJ-AUTO', 'HEROMOTOCO', 'EICHERMOT', 'M&M', 'TATAMOTORS', 'MARICO', 'DABUR',
        'GODREJCP', 'BRITANNIA', 'COLPAL', 'PIDILITIND', 'BERGEPAINT', 'SHREECEM', 'AMBUJACEM',
        'JKCEMENT', 'RAMCOCEM', 'ACC', 'DALBHARAT', 'NMDC', 'COCHINSHIP', 'GMRINFRA',
        'ADANIPORTS', 'JSWSTEEL', 'TATASTEEL', 'SAIL', 'HINDALCO', 'NALCO', 'VEDANTA',
        'TATAPOWER', 'NTPC', 'POWERGRID', 'ADANIGREEN', 'RENEWIND', 'SUZLON', 'ZYDUSLIFE',
        'BIOCON', 'LUPIN', 'AUROPHARMA', 'GLENMARK', 'IPCALAB', 'AJANTPHARM', 'APOLLOHOSP',
        'FORTIS', 'MAXHEALTH', 'NH', 'RAIN', 'LALPATHLAB', 'METROPOLIS', 'KIMS', 'ASTERDM',
        'INDIGO', 'JETAIRWAYS', 'SPICEJET', 'IRCTC', 'MAKEMYTRIP', 'YATRA', 'EASEMYTRIP',
        'NAUKRI', 'INFOEDGE', 'JUSTDIAL', 'TEAMLEASE', 'QUESS', 'KPITTECH', 'COFORGE',
        'LTTS', 'MPHASIS', 'PERSISTENT', 'TATAELXSI', 'SONATSOFTW', 'CYIENT', 'AFFLE',
        'NAVINFLUOR', 'FLUOROCHEM', 'PIIND', 'ATUL', 'DEEPAKNTR', 'TATACHEM', 'SRF',
        'ALKYLAMINE', 'FINEORG', 'SUMICHEM', 'BASF', 'CHAMBLFERT', 'COROMANDEL', 'GNFC',
        'GSFC', 'NFL', 'RALLIS', 'SHARDACROP', 'UPL', 'PIIND', 'BAYERCROP', 'ITC', 'VSTIND',
        'GOLDENTOBC', 'ITC', 'JUBILANT', 'BALRAMCHIN', 'KPRMILL', 'WELSPUNIND', 'VARDHMAN',
        'PAGEIND', 'GARFIBRES', 'SRF', 'RELAXO', 'BAJAJELEC', 'WHIRLPOOL', 'TTKPRESTIG',
        'PREMIERPOL', 'AMBER', 'STYLAMIND', 'GREENPLY', 'CENTURYPLY', 'KITEX', 'TCIEXP',
        'GESHIP', 'GLOBALVECT', 'VRLLOG', 'ALLCARGO', 'MAHLOG', 'CONCOR', 'DELHIVERY',
        'BLUEDART', 'TCS', 'INFY', 'WIPRO', 'HCLTECH', 'TECHM', 'COFORGE', 'LTTS', 'MPHASIS'
      ];

      const values = stocks.map(symbol => ({
        symbol,
        sector: 'NSE'
      }));

      await client.insert({
        table: 'stocks_summary',
        values,
        format: 'JSONEachRow'
      });

      console.log(`✅ Populated stocks_summary with ${stocks.length} stocks`);
    } catch (error) {
      console.error('Error populating default stocks:', error.message);
    }
  }

  async scanMomentum(limit = 20) {
    // Check for complete cached data first
    const cachedData = await this.getCachedScreenerData('momentum', limit);
    if (cachedData) {
      console.log('Returning cached momentum screener data');
      return cachedData;
    }

    // Return partial data immediately if available
    const partialData = await this.getPartialScreenerData('momentum', limit);
    if (partialData) {
      console.log('Returning partial momentum screener data');
      // Start background refresh
      this.scanMomentumBackground(limit);
      return partialData;
    }

    // Start fresh scan in background and return immediately to avoid API timeout
    this.scanMomentumBackground(limit).catch((error) => {
      console.error('Background momentum scan failed:', error.message);
    });
    return [];
  }

  async scanMomentumBackground(limit = 20) {
    console.log('Starting background momentum screener scan');

    // Get all available symbols from database
    const allSymbols = await this.getAllAvailableSymbols();
    console.log(`Scanning ${allSymbols.length} symbols for momentum in batches of ${this.batchSize}`);

    const results = [];

    // Process symbols in batches of 50 with 20-second delays
    for (let i = 0; i < allSymbols.length; i += this.batchSize) {
      const batch = allSymbols.slice(i, i + this.batchSize);
      console.log(`Processing momentum batch ${Math.floor(i/this.batchSize) + 1}/${Math.ceil(allSymbols.length/this.batchSize)} (${batch.length} symbols)`);

      const batchPromises = batch.map(async (symbol) => {
        const quote = await this.getStockQuote(symbol);
        if (quote && quote.price > 0) {
          return {
            symbol: symbol,
            close: quote.price,
            momentum_score: quote.changePercent,
            volume: quote.volume
          };
        }
        return null;
      });

      const batchResults = await Promise.all(batchPromises);
      const validResults = batchResults.filter(result => result !== null);
      results.push(...validResults);

      console.log(`Batch completed: ${validResults.length}/${batch.length} valid results`);

      const shouldStoreIntermediate = i === 0 || (i + this.batchSize >= allSymbols.length);
      if (results.length > 0 && shouldStoreIntermediate) {
        const intermediateResults = results
          .sort((a, b) => b.momentum_score - a.momentum_score)
          .slice(0, Math.max(limit, 100)); // Store more for better ranking

        await this.storeScreenerData('momentum', intermediateResults);
        console.log(`Stored ${intermediateResults.length} intermediate momentum results`);
      }

      // Delay between batches (except for last batch)
      if (i + this.batchSize < allSymbols.length) {
        console.log(`Waiting ${this.batchDelay/1000}s before next batch...`);
        await new Promise(resolve => setTimeout(resolve, this.batchDelay));
      }
    }

    // Final sort and store complete results
    const sortedResults = results
      .sort((a, b) => b.momentum_score - a.momentum_score)
      .slice(0, limit);

    console.log(`Momentum scan completed: ${sortedResults.length} final results`);
    await this.storeScreenerData('momentum', sortedResults);

    return sortedResults;
  }

  async scanVolatility(limit = 20) {
    // Check for complete cached data first
    const cachedData = await this.getCachedScreenerData('volatility', limit);
    if (cachedData) {
      console.log('Returning cached volatility screener data');
      return cachedData;
    }

    // Return partial data immediately if available
    const partialData = await this.getPartialScreenerData('volatility', limit);
    if (partialData) {
      console.log('Returning partial volatility screener data');
      // Start background refresh
      this.scanVolatilityBackground(limit);
      return partialData;
    }

    // Start fresh scan in background and return immediately to avoid API timeout
    this.scanVolatilityBackground(limit).catch((error) => {
      console.error('Background volatility scan failed:', error.message);
    });
    return [];
  }

  async scanVolatilityBackground(limit = 20) {
    console.log('Starting background volatility screener scan');

    // Get all available symbols from database
    const allSymbols = await this.getAllAvailableSymbols();
    console.log(`Scanning ${allSymbols.length} symbols for volatility in batches of ${this.batchSize}`);

    const results = [];

    // Process symbols in batches of 50 with 20-second delays
    for (let i = 0; i < allSymbols.length; i += this.batchSize) {
      const batch = allSymbols.slice(i, i + this.batchSize);
      console.log(`Processing volatility batch ${Math.floor(i/this.batchSize) + 1}/${Math.ceil(allSymbols.length/this.batchSize)} (${batch.length} symbols)`);

      const batchPromises = batch.map(async (symbol) => {
        const quote = await this.getStockQuote(symbol);
        if (quote && quote.price > 0) {
          // Use absolute change percent as volatility proxy
          const volatilityScore = Math.abs(quote.changePercent);
          return {
            symbol: symbol,
            close: quote.price,
            volatility_score: volatilityScore,
            volume: quote.volume
          };
        }
        return null;
      });

      const batchResults = await Promise.all(batchPromises);
      const validResults = batchResults.filter(result => result !== null);
      results.push(...validResults);

      console.log(`Batch completed: ${validResults.length}/${batch.length} valid results`);

      const shouldStoreIntermediate = i === 0 || (i + this.batchSize >= allSymbols.length);
      if (results.length > 0 && shouldStoreIntermediate) {
        const intermediateResults = results
          .sort((a, b) => b.volatility_score - a.volatility_score)
          .slice(0, Math.max(limit, 100));

        await this.storeScreenerData('volatility', intermediateResults);
        console.log(`Stored ${intermediateResults.length} intermediate volatility results`);
      }

      // Delay between batches (except for last batch)
      if (i + this.batchSize < allSymbols.length) {
        console.log(`Waiting ${this.batchDelay/1000}s before next batch...`);
        await new Promise(resolve => setTimeout(resolve, this.batchDelay));
      }
    }

    // Final sort and store complete results
    const sortedResults = results
      .sort((a, b) => b.volatility_score - a.volatility_score)
      .slice(0, limit);

    console.log(`Volatility scan completed: ${sortedResults.length} final results`);
    await this.storeScreenerData('volatility', sortedResults);

    return sortedResults;
  }

  async scanTrend(limit = 20) {
    // Check for complete cached data first
    const cachedData = await this.getCachedScreenerData('trend', limit);
    if (cachedData) {
      console.log('Returning cached trend screener data');
      return cachedData;
    }

    // Return partial data immediately if available
    const partialData = await this.getPartialScreenerData('trend', limit);
    if (partialData) {
      console.log('Returning partial trend screener data');
      // Start background refresh
      this.scanTrendBackground(limit);
      return partialData;
    }

    // Start fresh scan in background and return immediately to avoid API timeout
    this.scanTrendBackground(limit).catch((error) => {
      console.error('Background trend scan failed:', error.message);
    });
    return [];
  }

  async scanTrendBackground(limit = 20) {
    console.log('Starting background trend screener scan');

    // Get all available symbols from database
    const allSymbols = await this.getAllAvailableSymbols();
    console.log(`Scanning ${allSymbols.length} symbols for trend in batches of ${this.batchSize}`);

    const results = [];

    // Process symbols in batches of 50 with 20-second delays
    for (let i = 0; i < allSymbols.length; i += this.batchSize) {
      const batch = allSymbols.slice(i, i + this.batchSize);
      console.log(`Processing trend batch ${Math.floor(i/this.batchSize) + 1}/${Math.ceil(allSymbols.length/this.batchSize)} (${batch.length} symbols)`);

      const batchPromises = batch.map(async (symbol) => {
        const quote = await this.getStockQuote(symbol);
        if (quote && quote.price > 0) {
          const trendType = quote.changePercent > 0 ? 'bullish' : 'bearish';

          return {
            symbol: symbol,
            close: quote.price,
            trend_type: trendType,
            volume: quote.volume,
            changePercent: quote.changePercent
          };
        }
        return null;
      });

      const batchResults = await Promise.all(batchPromises);
      const validResults = batchResults.filter(result => result !== null);
      results.push(...validResults);

      console.log(`Batch completed: ${validResults.length}/${batch.length} valid results`);

      const shouldStoreIntermediate = i === 0 || (i + this.batchSize >= allSymbols.length);
      if (results.length > 0 && shouldStoreIntermediate) {
        const intermediateResults = results
          .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
          .slice(0, Math.max(limit, 100));

        await this.storeScreenerData('trend', intermediateResults);
        console.log(`Stored ${intermediateResults.length} intermediate trend results`);
      }

      // Delay between batches (except for last batch)
      if (i + this.batchSize < allSymbols.length) {
        console.log(`Waiting ${this.batchDelay/1000}s before next batch...`);
        await new Promise(resolve => setTimeout(resolve, this.batchDelay));
      }
    }

    // Final sort and store complete results
    const sortedResults = results
      .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
      .slice(0, limit);

    console.log(`Trend scan completed: ${sortedResults.length} final results`);
    await this.storeScreenerData('trend', sortedResults);

    return sortedResults;
  }
}

module.exports = new ScreenerService();

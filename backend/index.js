require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { testConnection, client } = require('./config/database');
const upstoxSyncService = require('./services/upstoxSyncService');
const marketService = require('./services/marketService');
const fnoService = require('./services/fnoService');
const indexOhlcService = require('./services/indexOhlcService');

// Import routes
const stockRoutes = require('./routes/stocks');
const authRoutes = require('./routes/auth');
const watchlistRoutes = require('./routes/watchlist');
const fnoRoutes = require('./routes/fno');
const screenerRoutes = require('./routes/screeners');
const strategyRoutes = require('./routes/strategies');
const alertRoutes = require('./routes/alerts');
const systemRoutes = require('./routes/system');
const liveRoutes = require('./routes/live');
const marketRoutes = require('./routes/market');

const app = express();

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Allow localhost on any port during development
    if (origin.match(/^http:\/\/localhost:\d+$/)) {
      return callback(null, true);
    }

    // Allow the explicitly configured origin
    if (process.env.CORS_ORIGIN && origin === process.env.CORS_ORIGIN) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// API routes
app.use('/api/stocks', stockRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/fno', fnoRoutes);
app.use('/api/screeners', screenerRoutes);
app.use('/api/strategies', strategyRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/live', liveRoutes);
app.use('/api/market', marketRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

const PORT = process.env.PORT || 11000;

// Start server
async function setupDatabase() {
  try {
    console.log('Setting up database tables...');

    // Create tables
    const createQueries = [
      `CREATE TABLE IF NOT EXISTS stocks_summary (symbol String, sector String, instrument_key String DEFAULT '') ENGINE = MergeTree() ORDER BY symbol`,
      `CREATE TABLE IF NOT EXISTS stocks_15min (date DateTime, open Float64, high Float64, low Float64, close Float64, volume UInt64, symbol String, timeframe String, sector String) ENGINE = MergeTree() ORDER BY (symbol, date)`,
      `CREATE TABLE IF NOT EXISTS stocks_hourly (date DateTime, open Float64, high Float64, low Float64, close Float64, volume UInt64, symbol String, timeframe String, sector String) ENGINE = MergeTree() ORDER BY (symbol, date)`,
      `CREATE TABLE IF NOT EXISTS stocks_daily (date DateTime, open Float64, high Float64, low Float64, close Float64, volume UInt64, symbol String, timeframe String, sector String) ENGINE = MergeTree() ORDER BY (symbol, date)`,
      `CREATE TABLE IF NOT EXISTS news (id String, title String, summary String, timestamp DateTime, source String, url String, sentiment String) ENGINE = MergeTree() ORDER BY timestamp`,
      `CREATE TABLE IF NOT EXISTS users (id String, username String, password_hash String, role String DEFAULT 'analyst', created_at DateTime DEFAULT now()) ENGINE = MergeTree() ORDER BY username`,
      `CREATE TABLE IF NOT EXISTS watchlists (user_id String, symbol String, created_at DateTime DEFAULT now()) ENGINE = MergeTree() ORDER BY (user_id, symbol)`,
      `CREATE TABLE IF NOT EXISTS fno_contracts (
        instrument_key String,
        trading_symbol String,
        name String,
        segment String,
        exchange String,
        instrument_type String,
        lot_size UInt32,
        tick_size Float64,
        expiry Nullable(Date),
        strike Nullable(Float64),
        option_type Nullable(String),
        underlying_symbol String,
        updated_at DateTime
      ) ENGINE = ReplacingMergeTree(updated_at) ORDER BY (instrument_key, trading_symbol)`
      ,
      `CREATE TABLE IF NOT EXISTS alerts (
        id String,
        user_id String,
        symbol String,
        condition_type String,
        threshold Float64,
        timeframe String,
        is_active UInt8,
        created_at DateTime
      ) ENGINE = MergeTree() ORDER BY (user_id, created_at, id)`,
      `CREATE TABLE IF NOT EXISTS market_holidays (
        date Date,
        description String,
        type String,
        closed_exchanges String,
        open_exchanges String,
        updated_at DateTime
      ) ENGINE = ReplacingMergeTree(updated_at) ORDER BY (date, type)`,
      `CREATE TABLE IF NOT EXISTS market_sessions (
        trading_date Date,
        exchange String,
        start_time DateTime,
        end_time DateTime,
        updated_at DateTime
      ) ENGINE = ReplacingMergeTree(updated_at) ORDER BY (trading_date, exchange)`,
      `CREATE TABLE IF NOT EXISTS index_ohlc (
        underlying_symbol String,
        instrument_key String,
        bar_time DateTime,
        unit String,
        interval UInt16,
        open Float64,
        high Float64,
        low Float64,
        close Float64,
        volume UInt64,
        open_interest Int64,
        ingested_at DateTime DEFAULT now()
      ) ENGINE = ReplacingMergeTree(ingested_at) ORDER BY (underlying_symbol, unit, interval, bar_time)`,
      `CREATE TABLE IF NOT EXISTS fno_option_chain (
        underlying_symbol String,
        underlying_key String DEFAULT '',
        expiry Date,
        strike_price Float64,
        pcr Float64,
        underlying_spot_price Float64,
        call_key String,
        call_ltp Float64,
        call_oi UInt64,
        call_volume UInt64,
        call_delta Float64,
        call_theta Float64,
        call_gamma Float64,
        call_vega Float64,
        call_iv Float64,
        put_key String,
        put_ltp Float64,
        put_oi UInt64,
        put_volume UInt64,
        put_delta Float64,
        put_theta Float64,
        put_gamma Float64,
        put_vega Float64,
        put_iv Float64,
        call_options_json String DEFAULT '',
        put_options_json String DEFAULT '',
        rate_type String DEFAULT 'REAL',
        updated_at DateTime
      ) ENGINE = ReplacingMergeTree(updated_at) ORDER BY (underlying_symbol, expiry, strike_price)`,
      `CREATE TABLE IF NOT EXISTS market_quote_ohlc (
        instrument_key String,
        interval String,
        last_price Float64,
        prev_open Float64,
        prev_high Float64,
        prev_low Float64,
        prev_close Float64,
        prev_volume UInt64,
        prev_ts UInt64,
        live_open Float64,
        live_high Float64,
        live_low Float64,
        live_close Float64,
        live_volume UInt64,
        live_ts UInt64,
        raw_json String,
        ingested_at DateTime
      ) ENGINE = ReplacingMergeTree(ingested_at) ORDER BY (instrument_key, interval)`
    ];

    for (const query of createQueries) {
      try {
        await client.command({ query });
      } catch (error) {
        console.log(`Table creation failed: ${error.message}`);
      }
    }

    // Populate stocks_summary if empty
    try {
      const countResult = await client.query({
        query: 'SELECT count() as count FROM stocks_summary',
        format: 'JSONEachRow'
      });
      const countData = await countResult.json();
      const stockCount = countData[0]?.count || 0;

      if (stockCount === 0) {
        console.log('Populating stocks_summary table...');
        const stocks = [
          'RELIANCE', 'TCS', 'HDFCBANK', 'ICICIBANK', 'INFY', 'HINDUNILVR', 'ITC', 'KOTAKBANK',
          'LT', 'AXISBANK', 'MARUTI', 'BAJFINANCE', 'BHARTIARTL', 'WIPRO', 'HCLTECH', 'NTPC',
          'POWERGRID', 'ONGC', 'COALINDIA', 'GAIL', 'DRREDDY', 'SUNPHARMA', 'CIPLA', 'DIVISLAB',
          'ABB', 'TMCV', 'TORNTPHARM', 'TORNTPOWER', 'TRENT', 'TTKPRESTIG', 'TVSMOTOR', 'UBL',
          'ULTRACEMCO', 'UNIONBANK', 'UNITDSPR', 'UNITECH', 'VALIANTORG', 'VBL', 'VEDL'
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

        console.log(`✅ Inserted ${stocks.length} stocks into stocks_summary`);
      } else {
        console.log(`Stocks_summary already has ${stockCount} stocks`);
      }
    } catch (error) {
      console.log(`Stock population check failed: ${error.message}`);
    }

    // Populate F&O option-chain demo rows if empty.
    try {
      const fnoCountResult = await client.query({
        query: 'SELECT count() as count FROM fno_option_chain',
        format: 'JSONEachRow'
      });
      const fnoCountData = await fnoCountResult.json();
      const fnoCount = fnoCountData[0]?.count || 0;

      if (fnoCount === 0) {
        const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
        const expiry = '2026-04-30';
        const spot = 22435.5;
        const demoChain = [
          { strike: 22200, ceLtp: 289.8, ceOi: 124500, ceVol: 44600, peLtp: 63.1, peOi: 115400, peVol: 30100 },
          { strike: 22300, ceLtp: 236.2, ceOi: 141200, ceVol: 53200, peLtp: 78.4, peOi: 133900, peVol: 35600 },
          { strike: 22400, ceLtp: 186.7, ceOi: 178400, ceVol: 71200, peLtp: 102.9, peOi: 169500, peVol: 48900 },
          { strike: 22500, ceLtp: 142.3, ceOi: 201700, ceVol: 80100, peLtp: 134.6, peOi: 194800, peVol: 55700 },
          { strike: 22600, ceLtp: 106.4, ceOi: 167900, ceVol: 63300, peLtp: 172.8, peOi: 182400, peVol: 51100 },
          { strike: 22700, ceLtp: 77.6, ceOi: 139300, ceVol: 50200, peLtp: 218.2, peOi: 154700, peVol: 42800 }
        ].map((row) => ({
          underlying_symbol: 'NIFTY',
          expiry,
          strike_price: row.strike,
          pcr: 0.96,
          underlying_spot_price: spot,
          call_key: `NSE_FO|NIFTY${expiry.replace(/-/g, '')}${row.strike}CE`,
          call_ltp: row.ceLtp,
          call_oi: row.ceOi,
          call_volume: row.ceVol,
          call_delta: 0.45,
          call_theta: -8.5,
          call_gamma: 0.0009,
          call_vega: 12.1,
          call_iv: 14.8,
          put_key: `NSE_FO|NIFTY${expiry.replace(/-/g, '')}${row.strike}PE`,
          put_ltp: row.peLtp,
          put_oi: row.peOi,
          put_volume: row.peVol,
          put_delta: -0.46,
          put_theta: -8.1,
          put_gamma: 0.0009,
          put_vega: 12.4,
          put_iv: 15.1,
          rate_type: 'REAL',
          updated_at: now
        }));

        await client.insert({
          table: 'fno_option_chain',
          values: demoChain,
          format: 'JSONEachRow'
        });

        console.log(`✅ Inserted ${demoChain.length} demo F&O option-chain rows into fno_option_chain`);
      }
    } catch (error) {
      console.log(`F&O demo population check failed: ${error.message}`);
    }

    // Execute migrations/alters for existing tables
    const migrationQueries = [
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS role String DEFAULT \'analyst\'',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at DateTime DEFAULT now()',
      'ALTER TABLE stocks_summary ADD COLUMN IF NOT EXISTS sector String DEFAULT \'\'',
      'ALTER TABLE stocks_summary ADD COLUMN IF NOT EXISTS instrument_key String DEFAULT \'\'',
      'ALTER TABLE fno_option_chain ADD COLUMN IF NOT EXISTS underlying_key String DEFAULT \'\'',
      'ALTER TABLE fno_option_chain ADD COLUMN IF NOT EXISTS call_volume UInt64 DEFAULT 0',
      'ALTER TABLE fno_option_chain ADD COLUMN IF NOT EXISTS put_volume UInt64 DEFAULT 0',
      'ALTER TABLE fno_option_chain ADD COLUMN IF NOT EXISTS call_options_json String DEFAULT \'\'',
      'ALTER TABLE fno_option_chain ADD COLUMN IF NOT EXISTS put_options_json String DEFAULT \'\'',
      'ALTER TABLE fno_option_chain ADD COLUMN IF NOT EXISTS rate_type String DEFAULT \'REAL\''
    ];

    for (const q of migrationQueries) {
      try {
        await client.command({ query: q });
      } catch (err) {
        // Silently continue if column already exists or other minor error
        console.debug(`[Migration] Warning: ${err.message}`);
      }
    }

    console.log('✅ Database setup and migrations complete');
  } catch (error) {
    console.error('Database setup failed:', error);
  }
}

const startServer = async () => {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.warn('⚠️  Database connection failed, but server will start anyway');
    }

    // Try to setup tables anyway (in case connection recovers)
    try {
      await setupDatabase();
    } catch (error) {
      console.log('Table setup failed:', error.message);
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 API Base URL: ${process.env.API_BASE_URL || `http://localhost:${PORT}`}`);
    });

    upstoxSyncService.init().catch((error) => {
      console.error('[UpstoxSync] Failed to initialize:', error.message);
    });

    marketService.init().catch((error) => {
      console.error('[MarketService] Failed to initialize:', error.message);
    });

    fnoService.init().catch((error) => {
      console.error('[FNO] Failed to initialize:', error.message);
    });

    indexOhlcService.maybeBackfillOnStartup();

    const hasUpstox = Boolean(process.env.UPSTOX_ACCESS_TOKEN || process.env.UPSTOX_API_KEY);
    if (hasUpstox && process.env.INDEX_OHLC_SYNC !== 'false') {
      setTimeout(() => {
        indexOhlcService.syncAllRecent().catch((e) => console.warn('[IndexOhlc] startup sync:', e.message));
      }, 10000);
      setInterval(() => {
        indexOhlcService.syncAllRecent().catch((e) => console.warn('[IndexOhlc] hourly sync:', e.message));
      }, 60 * 60 * 1000);
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();  
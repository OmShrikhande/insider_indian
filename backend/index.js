require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { testConnection, client } = require('./config/database');
const upstoxSyncService = require('./services/upstoxSyncService');
const marketService = require('./services/marketService');
const fnoService = require('./services/fnoService');

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
      `CREATE TABLE IF NOT EXISTS stocks_summary (symbol String, sector String) ENGINE = MergeTree() ORDER BY symbol`,
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
      ) ENGINE = ReplacingMergeTree(updated_at) ORDER BY (trading_date, exchange)`
    ];

    for (const query of createQueries) {
      try {
        await client.exec({ query });
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

    console.log('✅ Database tables setup complete');
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
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();  
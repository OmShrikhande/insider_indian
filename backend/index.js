require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { testConnection } = require('./config/database');
const upstoxSyncService = require('./services/upstoxSyncService');
const marketService = require('./services/marketService');

// Import routes
const stockRoutes = require('./routes/stocks');

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
      `CREATE TABLE IF NOT EXISTS news (id String, title String, summary String, timestamp DateTime, source String, url String, sentiment String) ENGINE = MergeTree() ORDER BY timestamp`
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
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();  
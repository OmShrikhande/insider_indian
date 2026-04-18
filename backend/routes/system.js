const express = require('express');
const { protect, requireAdmin } = require('../middleware/authMiddleware');
const upstoxSyncService = require('../services/upstoxSyncService');

const router = express.Router();

router.get('/sources', (req, res) => {
  res.json({
    success: true,
    data: {
      stocks: {
        historical: 'Upstox Historical Candle API -> synced into ClickHouse tables',
        tables: ['stocks_15min', 'stocks_hourly', 'stocks_daily'],
      },
      fno: {
        instruments: 'Upstox Instruments Search API (NSE_FO) -> synced into fno_contracts',
        tables: ['fno_contracts'],
      },
      marketQuote: {
        liveOhlc: 'Upstox v3 GET /market-quote/ohlc -> persisted in market_quote_ohlc, served via GET /api/market/quote-ohlc',
        tables: ['market_quote_ohlc'],
      },
    },
  });
});

router.post('/sync/stocks', protect, requireAdmin, async (req, res) => {
  try {
    await upstoxSyncService.runAllTimeframes();
    res.json({ success: true, message: 'Stock sync started/completed for all configured timeframes' });
  } catch (error) {
    console.error('Manual stock sync error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to run stock sync' });
  }
});

module.exports = router;

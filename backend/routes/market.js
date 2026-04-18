const express = require('express');
const marketQuoteOhlcService = require('../services/marketQuoteOhlcService');

const router = express.Router();

/**
 * GET /api/market/quote-ohlc?instrument_key=NSE_INDEX|Nifty%2050&interval=I30
 * Fetches from Upstox (when token present), stores in ClickHouse, returns latest snapshot.
 */
router.get('/quote-ohlc', async (req, res) => {
  try {
    const instrumentKey = String(req.query.instrument_key || '').trim();
    const interval = String(req.query.interval || 'I30').trim();
    if (!instrumentKey) {
      return res.status(400).json({ success: false, error: 'instrument_key is required' });
    }

    const result = await marketQuoteOhlcService.fetchStoreAndReturn(instrumentKey, interval);
    if (!result.success) {
      return res.status(500).json(result);
    }
    return res.json({
      success: true,
      stale: Boolean(result.stale),
      source: result.source || 'db',
      data: result.data,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

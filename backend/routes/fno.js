const express = require('express');
const fnoService = require('../services/fnoService');
const indexOhlcService = require('../services/indexOhlcService');
const fnoOrbStrategyService = require('../services/fnoOrbStrategyService');
const { protect, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/contracts', async (req, res) => {
  try {
    const { q = '', limit = 100 } = req.query;
    const data = await fnoService.getContracts(q, limit);
    res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error('FNO contracts fetch error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch FNO contracts' });
  }
});

router.post('/sync', protect, requireAdmin, async (req, res) => {
  try {
    if (process.env.UPSTOX_FNO_SYNC_ENABLED !== 'true') {
      return res.status(403).json({ success: false, error: 'FNO sync is disabled' });
    }
    const { q = 'NIFTY', limit = 100 } = req.body || {};
    const result = await fnoService.syncContracts(q, limit);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('FNO sync error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to sync FNO contracts' });
  }
});

router.get('/expiries', async (req, res) => {
  try {
    const { q = '' } = req.query;
    const data = await fnoService.getExpiries(q);
    res.json({ success: true, data });
  } catch (error) {
    console.error('FNO expiries fetch error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch FNO expiries' });
  }
});

router.get('/strike-ladder', async (req, res) => {
  try {
    const { underlying = 'NIFTY', expiry = '' } = req.query;
    const data = await fnoService.getStrikeLadder(underlying, expiry);
    res.json({ success: true, data });
  } catch (error) {
    console.error('FNO strike ladder error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch strike ladder' });
  }
});

router.get('/pcr', async (req, res) => {
  try {
    const { underlying = 'NIFTY', expiry = '' } = req.query;
    const data = await fnoService.getPCR(underlying, expiry);
    res.json({ success: true, data });
  } catch (error) {
    console.error('FNO PCR error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch PCR' });
  }
});

router.post('/sync/admin', protect, requireAdmin, async (req, res) => {
  try {
    const { q = 'NIFTY', limit = 100 } = req.body || {};
    const result = await fnoService.syncContracts(q, limit);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('FNO admin sync error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to sync FNO contracts' });
  }
});

router.get('/trades', async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const result = await fnoService.getSuggestedTrades(limit);
    if (!result.success) return res.status(500).json(result);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/trades', async (req, res) => {
  try {
    const result = await fnoService.createSuggestedTrade(req.body || {});
    if (!result.success) return res.status(400).json(result);
    return res.status(201).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/trades/:id/action', async (req, res) => {
  try {
    const { id } = req.params;
    const { action = '', handledBy = '' } = req.body || {};
    const result = await fnoService.handleSuggestedTrade(id, action, handledBy);
    if (!result.success) return res.status(400).json(result);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Index underlying OHLC (NIFTY / BANKNIFTY / FINNIFTY) from ClickHouse (synced via Upstox v3).
 * Query: timeframe=1m|1h|1d, limit
 */
router.get('/index-ohlc', async (req, res) => {
  try {
    const { underlying = 'NIFTY', timeframe = '1h', limit = 5000 } = req.query;
    const data = await indexOhlcService.getOhlc(String(underlying), String(timeframe), Number(limit));
    res.json({ success: true, underlying: String(underlying).toUpperCase(), timeframe, count: data.length, data });
  } catch (error) {
    console.error('Index OHLC error:', error.message);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/index-ohlc/sync', protect, requireAdmin, async (req, res) => {
  try {
    const { underlying, months } = req.body || {};
    if (underlying) {
      const m = Math.min(36, Math.max(1, Number(months) || 24));
      const r = await indexOhlcService.backfillUnderlying(String(underlying), m, 600);
      return res.json({ success: true, result: r });
    }
    const r = await indexOhlcService.syncAllRecent();
    return res.json({ success: true, result: r });
  } catch (error) {
    console.error('Index OHLC sync error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/ohlcv', async (req, res) => {
  try {
    const { underlying, expiry, strike, timeframe = '1h' } = req.query;
    if (!underlying || !expiry || !strike) {
        return res.status(400).json({ success: false, error: 'Missing required parameters: underlying, expiry, strike' });
    }
    const data = await fnoService.getOptionsOhlcv(underlying, expiry, strike, timeframe);
    res.json({ success: true, data });
  } catch (error) {
    console.error('FNO OHLCV fetch error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch FNO OHLCV data' });
  }
});

router.get('/orb-signal', async (req, res) => {
  try {
    const { underlying = 'NIFTY', expiry = '' } = req.query;
    const result = await fnoOrbStrategyService.analyze({
      underlying: String(underlying || 'NIFTY'),
      expiry: String(expiry || ''),
    });
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Raw Option Chain API:
// GET /api/fno/option-chain?instrument_key=NSE_INDEX|Nifty 50&expiry_date=2026-04-28
// Returns the same nested shape as Upstox /v2/option/chain response.
router.get('/option-chain', async (req, res) => {
  const { instrument_key: instrumentKey = '', expiry_date: expiryDate = '' } = req.query;
  if (!instrumentKey || !expiryDate) {
    return res.status(400).json({
      success: false,
      error: 'Missing required query params: instrument_key and expiry_date',
    });
  }

  try {
    const result = await fnoService.getOptionChainRaw(String(instrumentKey), String(expiryDate));

    if (!result.success) {
      const msg = String(result.error || '');
      const noChain =
        msg.includes('No chain data') ||
        msg.includes('No chain data available');
      if (noChain) {
        return res.status(200).json({
          status: 'success',
          data: [],
          stale: false,
          message: result.error,
        });
      }
      return res.status(500).json(result);
    }

    return res.json({
      status: 'success',
      data: result.data,
      stale: Boolean(result.stale),
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Get Option Chain
router.get('/option-chain/:symbol/:expiry', async (req, res) => {
  const { symbol, expiry } = req.params;
  try {
    const result = await fnoService.getOptionChain(symbol.toUpperCase(), expiry);

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

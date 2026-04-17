const express = require('express');
const fnoService = require('../services/fnoService');
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

// Get Option Chain
router.get('/option-chain/:symbol/:expiry', async (req, res) => {
  const { symbol, expiry } = req.params;
  try {
    let result = await fnoService.getOptionChain(symbol.toUpperCase(), expiry);
    
    // If no data, try to sync once
    if (!result.success || !result.data || result.data.length === 0) {
      console.log(`[FNO Route] No stored chain for ${symbol} @ ${expiry}. Syncing...`);
      await fnoService.syncOptionChain(symbol.toUpperCase(), expiry);
      result = await fnoService.getOptionChain(symbol.toUpperCase(), expiry);
    }

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

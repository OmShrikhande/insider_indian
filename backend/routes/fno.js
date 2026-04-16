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

module.exports = router;

const express = require('express');
const fnoService = require('../services/fnoService');
const { protect } = require('../middleware/authMiddleware');

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

router.post('/sync', protect, async (req, res) => {
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

module.exports = router;

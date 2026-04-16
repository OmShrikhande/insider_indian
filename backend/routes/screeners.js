const express = require('express');
const screenerService = require('../services/screenerService');

const router = express.Router();

router.get('/momentum', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const data = await screenerService.scanMomentum(limit);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Momentum screener error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to run momentum screener' });
  }
});

router.get('/volatility', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const data = await screenerService.scanVolatility(limit);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Volatility screener error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to run volatility screener' });
  }
});

router.get('/trend', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const data = await screenerService.scanTrend(limit);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Trend screener error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to run trend screener' });
  }
});

module.exports = router;

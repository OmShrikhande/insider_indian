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

// Get screener statistics
router.get('/stats', async (req, res) => {
  try {
    const { client } = require('../config/database');
    const result = await client.query({
      query: `
        SELECT
          screener_type,
          count(*) as total_records,
          max(updated_at) as last_updated,
          min(updated_at) as first_created
        FROM screener_results
        GROUP BY screener_type
      `,
      format: 'JSONEachRow',
    });

    const stats = await result.json();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Screener stats error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to get screener statistics' });
  }
});

// Manual refresh of screener data
router.post('/refresh', async (req, res) => {
  try {
    const { type } = req.body; // 'all', 'momentum', 'volatility', 'trend'

    if (type === 'all' || !type) {
      await Promise.all([
        screenerService.scanMomentum(100),
        screenerService.scanVolatility(100),
        screenerService.scanTrend(100)
      ]);
    } else if (['momentum', 'volatility', 'trend'].includes(type)) {
      if (type === 'momentum') await screenerService.scanMomentum(100);
      if (type === 'volatility') await screenerService.scanVolatility(100);
      if (type === 'trend') await screenerService.scanTrend(100);
    } else {
      return res.status(400).json({ success: false, error: 'Invalid screener type' });
    }

    res.json({ success: true, message: `Screener ${type || 'all'} refreshed successfully` });
  } catch (error) {
    console.error('Screener refresh error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to refresh screener data' });
  }
});

// Clear screener cache
router.delete('/cache', async (req, res) => {
  try {
    const { type } = req.query; // optional: 'momentum', 'volatility', 'trend'

    const { client } = require('../config/database');
    let query = 'DELETE FROM screener_results WHERE 1=1';

    if (type && ['momentum', 'volatility', 'trend'].includes(type)) {
      query += ` AND screener_type = '${type}'`;
    }

    await client.exec({ query });

    res.json({ success: true, message: `Cache cleared for ${type || 'all'} screeners` });
  } catch (error) {
    console.error('Cache clear error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to clear screener cache' });
  }
});

// Get available stocks
router.get('/stocks', async (req, res) => {
  try {
    const symbols = await screenerService.getAllAvailableSymbols();
    res.json({ success: true, data: symbols, count: symbols.length });
  } catch (error) {
    console.error('Get stocks error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to get available stocks' });
  }
});

// Get screener status and progress
router.get('/status', async (req, res) => {
  try {
    const status = await screenerService.getScreenerStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    console.error('Get status error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to get screener status' });
  }
});

module.exports = router;

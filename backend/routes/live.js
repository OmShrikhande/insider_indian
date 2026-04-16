const express = require('express');
const liveDataService = require('../services/liveDataService');

const router = express.Router();

router.get('/ltp', async (req, res) => {
  try {
    const { instrumentKey } = req.query;
    if (!instrumentKey) {
      return res.status(400).json({ success: false, error: 'instrumentKey is required' });
    }
    const data = await liveDataService.getLtp(instrumentKey);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Live LTP error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch live LTP' });
  }
});

module.exports = router;

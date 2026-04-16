const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const watchlistService = require('../services/watchlistService');

const router = express.Router();

router.get('/', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const symbols = await watchlistService.getWatchlist(userId);
    res.json({ success: true, data: symbols });
  } catch (error) {
    console.error('Watchlist fetch error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.post('/toggle', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { symbol } = req.body;
    const result = await watchlistService.toggleWatchlist(userId, symbol);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Watchlist toggle error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;

const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { client } = require('../config/database');

const router = express.Router();

router.get('/', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await client.query({
      query: `SELECT symbol FROM watchlists WHERE user_id = '${userId}'`,
      format: 'JSONEachRow'
    });
    const rows = await result.json();
    res.json({ success: true, data: rows.map(r => r.symbol) });
  } catch (error) {
    console.error('Watchlist fetch error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.post('/toggle', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { symbol } = req.body;
    
    // Check if it exists
    const existing = await client.query({
      query: `SELECT symbol FROM watchlists WHERE user_id = '${userId}' AND symbol = '${symbol}' LIMIT 1`,
      format: 'JSONEachRow'
    });
    const existingData = await existing.json();

    if (existingData.length > 0) {
      // It exists -> Remove
      await client.exec({
        query: `ALTER TABLE watchlists DELETE WHERE user_id = '${userId}' AND symbol = '${symbol}'`
      });
      res.json({ success: true, action: 'removed', symbol });
    } else {
      // Does not exist -> Add
      await client.insert({
        table: 'watchlists',
        values: [{ user_id: userId, symbol, created_at: new Date().toISOString().replace('T', ' ').slice(0, 19) }],
        format: 'JSONEachRow'
      });
      res.json({ success: true, action: 'added', symbol });
    }
  } catch (error) {
    console.error('Watchlist toggle error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;

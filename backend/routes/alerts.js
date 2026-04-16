const express = require('express');
const { client } = require('../config/database');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', protect, async (req, res) => {
  try {
    const result = await client.query({
      query: `
        SELECT id, user_id, symbol, condition_type, threshold, timeframe, is_active, created_at
        FROM alerts
        WHERE user_id = {userId:String}
        ORDER BY created_at DESC
      `,
      query_params: { userId: req.user.id },
      format: 'JSONEachRow',
    });
    const data = await result.json();
    res.json({ success: true, data });
  } catch (error) {
    console.error('Alerts list error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch alerts' });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const { symbol, conditionType, threshold, timeframe = '1h' } = req.body || {};
    if (!symbol || !conditionType || threshold == null) {
      return res.status(400).json({ success: false, error: 'symbol, conditionType, threshold are required' });
    }

    const id = `${req.user.id}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    await client.insert({
      table: 'alerts',
      values: [{
        id,
        user_id: req.user.id,
        symbol: String(symbol).toUpperCase(),
        condition_type: String(conditionType),
        threshold: Number(threshold),
        timeframe: String(timeframe),
        is_active: 1,
        created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
      }],
      format: 'JSONEachRow',
    });
    res.status(201).json({ success: true, data: { id } });
  } catch (error) {
    console.error('Create alert error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to create alert' });
  }
});

router.post('/:id/toggle', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body || {};
    await client.exec({
      query: `
        ALTER TABLE alerts
        UPDATE is_active = {isActive:UInt8}
        WHERE id = {id:String}
          AND user_id = {userId:String}
      `,
      query_params: {
        isActive: isActive ? 1 : 0,
        id,
        userId: req.user.id,
      },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Toggle alert error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to toggle alert' });
  }
});

module.exports = router;

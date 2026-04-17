const express = require('express');
const liveDataService = require('../services/liveDataService');
const stockService = require('../services/stockService');
const fnoService = require('../services/fnoService');

const router = express.Router();

const startSse = (res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
};

const writeSseEvent = (res, event, payload) => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

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

router.get('/stream/stocks', async (req, res) => {
  const { symbol = 'ABB', timeframe = '1h', limit = 3000 } = req.query;
  startSse(res);

  const pushSnapshot = async () => {
    try {
      const data = await stockService.getStockData(symbol, timeframe, Number(limit) || 3000);
      writeSseEvent(res, 'stock_snapshot', {
        success: true,
        symbol: String(symbol).toUpperCase(),
        timeframe,
        data,
        ts: Date.now()
      });
    } catch (error) {
      writeSseEvent(res, 'error', { success: false, error: error.message });
    }
  };

  await pushSnapshot();
  const timer = setInterval(pushSnapshot, 5000);
  req.on('close', () => clearInterval(timer));
});

router.get('/stream/fno-ohlcv', async (req, res) => {
  const { underlying, expiry, strike, timeframe = '1h' } = req.query;
  if (!underlying || !expiry || !strike) {
    return res.status(400).json({ success: false, error: 'underlying, expiry and strike are required' });
  }

  startSse(res);

  const pushSnapshot = async () => {
    try {
      const data = await fnoService.getOptionsOhlcv(underlying, expiry, strike, timeframe);
      writeSseEvent(res, 'fno_snapshot', {
        success: true,
        underlying: String(underlying).toUpperCase(),
        expiry,
        strike: Number(strike),
        timeframe,
        data,
        ts: Date.now()
      });
    } catch (error) {
      writeSseEvent(res, 'error', { success: false, error: error.message });
    }
  };

  await pushSnapshot();
  const timer = setInterval(pushSnapshot, 5000);
  req.on('close', () => clearInterval(timer));
});

module.exports = router;

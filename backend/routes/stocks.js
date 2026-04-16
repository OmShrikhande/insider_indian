const express = require('express');
const stockService = require('../services/stockService');
const newsService = require('../services/newsService');
const tradeService = require('../services/tradeService');
const marketService = require('../services/marketService');
const {
  validateSymbol,
  validateTimeframe,
  validateLimit,
  validateDateRange,
} = require('../middleware/validation');

const router = express.Router();

/**
 * GET /api/stocks/:symbol
 * Get stock data for a specific symbol
 * Query parameters:
 * - timeframe: 'hourly' or 'daily' (default: 'hourly')
 * - limit: number of records to return (default: 100)
 */
router.get('/:symbol', validateSymbol, validateTimeframe, validateLimit, async (req, res) => {
  try {
    const { symbol } = req.params;
    const { timeframe, limit } = req.query;

    const data = await stockService.getStockData(symbol, timeframe, limit);

    res.json({
      success: true,
      data: data,
      symbol: symbol.toUpperCase(),
      timeframe,
      count: data.length,
    });

  } catch (error) {
    console.error('Error in /api/stocks/:symbol:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/stocks/:symbol/range
 * Get stock data for a specific symbol within a date range
 * Query parameters:
 * - timeframe: 'hourly' or 'daily' (default: 'hourly')
 * - startDate: start date in YYYY-MM-DD format
 * - endDate: end date in YYYY-MM-DD format
 */
router.get('/:symbol/range', validateSymbol, validateTimeframe, validateDateRange, async (req, res) => {
  try {
    const { symbol } = req.params;
    const { timeframe, startDate, endDate } = req.query;

    const data = await stockService.getStockDataByDateRange(symbol, timeframe, startDate, endDate);

    res.json({
      success: true,
      data: data,
      symbol: symbol.toUpperCase(),
      timeframe,
      startDate,
      endDate,
      count: data.length,
    });

  } catch (error) {
    console.error('Error in /api/stocks/:symbol/range:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/stocks/symbols
 * Get list of available symbols
 * Query parameters:
 * - timeframe: 'hourly' or 'daily' (default: 'hourly')
 */
router.get('/symbols', validateTimeframe, async (req, res) => {
  try {
    const { timeframe = 'hourly' } = req.query;

    const symbols = await stockService.getAvailableSymbols(timeframe);

    res.json({
      success: true,
      data: symbols,
      timeframe,
      count: symbols.length,
    });

  } catch (error) {
    console.error('Error in /api/stocks/symbols:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/stocks/symbols/metadata
 * Get symbols metadata with data ranges and statistics
 * Query parameters:
 * - timeframe: 'hourly' or 'daily' (default: 'hourly')
 */
router.get('/symbols/metadata', validateTimeframe, async (req, res) => {
  try {
    const { timeframe = 'hourly' } = req.query;

    const metadata = await stockService.getSymbolsMetadata(timeframe);

    res.json({
      success: true,
      data: metadata,
    });

  } catch (error) {
    console.error('Error in /api/stocks/symbols/metadata:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/stocks/search
 * Search symbols from stocks_summary
 */
router.get('/search/all', async (req, res) => {
  try {
    const { q = '' } = req.query;
    const results = await stockService.searchSymbols(q);
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/news
 * Get latest market news
 */
router.get('/news/latest', async (req, res) => {
  try {
    const { q = '', sort = 'desc' } = req.query;
    const news = await newsService.getNewsFromDB(q, sort);
    res.json({ success: true, data: news });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/trades/futuristic
 * Get futuristic trade suggestions
 */
router.get('/trades/futuristic', async (req, res) => {
  try {
    const trades = await tradeService.getFuturisticTrades();
    res.json({ success: true, data: trades });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/market/status
 * Get current market status (open/closed) and timings
 */
router.get('/market/status', async (req, res) => {
  try {
    const status = await marketService.getMarketStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/market/holidays
 * Get market holidays
 */
router.get('/market/holidays', async (req, res) => {
  try {
    const holidays = await marketService.getHolidays();
    res.json({ success: true, data: holidays });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/market/timings
 * Get market timings for a specific date
 * Query parameters:
 * - date: date in YYYY-MM-DD format (default: today)
 */
router.get('/market/timings', async (req, res) => {
  try {
    const { date } = req.query;
    const timings = await marketService.getTimings(date);
    res.json({ success: true, data: timings, date: date || new Date().toISOString().split('T')[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
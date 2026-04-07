/**
 * Validation middleware for stock API endpoints
 */

const validateSymbol = (req, res, next) => {
  const { symbol } = req.params;

  if (!symbol || typeof symbol !== 'string' || symbol.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid symbol. Symbol must be a non-empty string.',
    });
  }

  // Convert to uppercase for consistency
  req.params.symbol = symbol.toUpperCase();
  next();
};

const validateTimeframe = (req, res, next) => {
  const timeframe = req.query.timeframe || 'hourly';

  if (!['hourly', 'daily'].includes(timeframe)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid timeframe. Must be "hourly" or "daily".',
    });
  }

  req.query.timeframe = timeframe;
  next();
};

const validateLimit = (req, res, next) => {
  const limit = req.query.limit || 100;
  const limitNum = parseInt(limit);

  if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
    return res.status(400).json({
      success: false,
      error: 'Invalid limit. Must be a number between 1 and 1000.',
    });
  }

  req.query.limit = limitNum;
  next();
};

const validateDateRange = (req, res, next) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({
      success: false,
      error: 'startDate and endDate are required for date range queries.',
    });
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid date format. Use YYYY-MM-DD format.',
    });
  }

  // Validate date logic
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return res.status(400).json({
      success: false,
      error: 'Invalid date values.',
    });
  }

  if (start > end) {
    return res.status(400).json({
      success: false,
      error: 'startDate cannot be after endDate.',
    });
  }

  next();
};

module.exports = {
  validateSymbol,
  validateTimeframe,
  validateLimit,
  validateDateRange,
};
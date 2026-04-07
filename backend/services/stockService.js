const { client } = require('../config/database');

class StockService {
  /**
   * Get stock data by symbol and timeframe
   * @param {string} symbol - Stock symbol (e.g., 'AAPL')
   * @param {string} timeframe - Timeframe (e.g., 'hourly', 'daily')
   * @param {number} limit - Number of records to return (default: 100)
   * @returns {Promise<Array>} Array of stock data
   */
  async getStockData(symbol, timeframe = 'hourly', limit = 100) {
    try {
      // Determine which table to query based on timeframe
      const tableName = timeframe === 'daily' ? 'stocks_daily' : 'stocks_hourly';

      // Validate inputs
      if (!symbol || typeof symbol !== 'string') {
        throw new Error('Invalid symbol provided');
      }

      if (!['hourly', 'daily'].includes(timeframe)) {
        throw new Error('Invalid timeframe. Must be "hourly" or "daily"');
      }

      const query = `
        SELECT
          timestamp,
          open,
          high,
          low,
          close,
          volume,
          symbol,
          timeframe,
          sector
        FROM ${tableName}
        WHERE symbol = {symbol:String}
        ORDER BY timestamp DESC
        LIMIT {limit:UInt32}
      `;

      const result = await client.query({
        query,
        query_params: {
          symbol: symbol.toUpperCase(),
          limit: limit,
        },
        format: 'JSONEachRow',
      });

      const data = await result.json();

      // Transform data for frontend (lightweight-charts format)
      return data.map(row => ({
        time: Math.floor(new Date(row.timestamp).getTime() / 1000), // Convert to Unix timestamp
        open: parseFloat(row.open),
        high: parseFloat(row.high),
        low: parseFloat(row.low),
        close: parseFloat(row.close),
        volume: parseInt(row.volume) || 0,
      })).reverse(); // Reverse to chronological order

    } catch (error) {
      console.error('Error fetching stock data:', error);
      throw new Error(`Failed to fetch stock data: ${error.message}`);
    }
  }

  /**
   * Get available symbols
   * @param {string} timeframe - Timeframe to get symbols for
   * @returns {Promise<Array>} Array of available symbols
   */
  async getAvailableSymbols(timeframe = 'hourly') {
    try {
      const tableName = timeframe === 'daily' ? 'stocks_daily' : 'stocks_hourly';

      const query = `
        SELECT DISTINCT
          symbol,
          sector
        FROM ${tableName}
        ORDER BY symbol
      `;

      const result = await client.query({
        query,
        format: 'JSONEachRow',
      });

      const data = await result.json();
      return data;

    } catch (error) {
      console.error('Error fetching symbols:', error);
      throw new Error(`Failed to fetch symbols: ${error.message}`);
    }
  }

  /**
   * Get symbols metadata with data ranges
   * @param {string} timeframe - Timeframe to get metadata for
   * @returns {Promise<Object>} Metadata about symbols and their data ranges
   */
  async getSymbolsMetadata(timeframe = 'hourly') {
    try {
      const tableName = timeframe === 'daily' ? 'stocks_daily' : 'stocks_hourly';

      // Query to get symbol metadata with data ranges
      const query = `
        SELECT
          symbol,
          sector,
          COUNT(*) as total_records,
          MIN(dat) as start_date,
          MAX(dat) as end_date,
          MIN(timestamp) as earliest_timestamp,
          MAX(timestamp) as latest_timestamp
        FROM ${tableName}
        GROUP BY symbol, sector
        ORDER BY symbol
      `;

      const result = await client.query({
        query,
        format: 'JSONEachRow',
      });

      const data = await result.json();

      // Get total count of symbols
      const totalSymbols = data.length;

      // Get sector distribution
      const sectorStats = data.reduce((acc, item) => {
        const sector = item.sector || 'Unknown';
        acc[sector] = (acc[sector] || 0) + 1;
        return acc;
      }, {});

      return {
        timeframe,
        total_symbols: totalSymbols,
        sector_distribution: sectorStats,
        symbols: data.map(item => ({
          symbol: item.symbol,
          sector: item.sector,
          total_records: parseInt(item.total_records),
          data_range: {
            start_date: item.start_date,
            end_date: item.end_date,
            earliest_timestamp: item.earliest_timestamp,
            latest_timestamp: item.latest_timestamp,
          },
        })),
      };

    } catch (error) {
      console.error('Error fetching symbols metadata:', error);
      throw new Error(`Failed to fetch symbols metadata: ${error.message}`);
    }
  }

  /**
   * Get stock data with date range
   * @param {string} symbol - Stock symbol
   * @param {string} timeframe - Timeframe
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<Array>} Array of stock data
   */
  async getStockDataByDateRange(symbol, timeframe = 'hourly', startDate, endDate) {
    try {
      const tableName = timeframe === 'daily' ? 'stocks_daily' : 'stocks_hourly';

      const query = `
        SELECT
          timestamp,
          open,
          high,
          low,
          close,
          volume,
          symbol,
          timeframe,
          sector
        FROM ${tableName}
        WHERE symbol = {symbol:String}
        AND dat >= {startDate:String}
        AND dat <= {endDate:String}
        ORDER BY timestamp ASC
      `;

      const result = await client.query({
        query,
        query_params: {
          symbol: symbol.toUpperCase(),
          startDate,
          endDate,
        },
        format: 'JSONEachRow',
      });

      const data = await result.json();

      return data.map(row => ({
        time: Math.floor(new Date(row.timestamp).getTime() / 1000),
        open: parseFloat(row.open),
        high: parseFloat(row.high),
        low: parseFloat(row.low),
        close: parseFloat(row.close),
        volume: parseInt(row.volume) || 0,
      }));

    } catch (error) {
      console.error('Error fetching stock data by date range:', error);
      throw new Error(`Failed to fetch stock data: ${error.message}`);
    }
  }
}

module.exports = new StockService();
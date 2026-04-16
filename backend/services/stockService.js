const { client } = require('../config/database');
const marketService = require('./marketService');

class StockService {
  parseDateUTC(value) {
    if (value instanceof Date) return value;
    if (typeof value === 'string' && !value.endsWith('Z')) {
      return new Date(`${value}Z`);
    }
    return new Date(value);
  }

  toISTDateParts(date) {
    const ist = new Date(this.parseDateUTC(date).getTime() + (5.5 * 60 * 60 * 1000));
    return {
      day: ist.getUTCDay(),
      hour: ist.getUTCHours(),
      minute: ist.getUTCMinutes(),
      date: ist.toISOString().slice(0, 10),
    };
  }

  isMarketSessionTime(date) {
    const { hour, minute } = this.toISTDateParts(date);
    const totalMinutes = hour * 60 + minute;
    return totalMinutes >= (9 * 60) && totalMinutes <= (15 * 60 + 30);
  }

  async applyTradingFilters(data, timeframe) {
    const holidays = await marketService.getHolidays();
    const holidaySet = new Set(
      holidays
        .filter((h) => (h.closedExchanges || []).includes('NSE') || h.type === 'TRADING_HOLIDAY')
        .map((h) => h.date)
    );

    const intraday = timeframe !== '1d';
    return data.filter((row) => {
      const date = this.parseDateUTC(row.date);
      const ist = this.toISTDateParts(date);
      if (ist.day === 0 || ist.day === 6) return false;
      if (holidaySet.has(ist.date)) return false;
      if (intraday && !this.isMarketSessionTime(date)) return false;
      return true;
    });
  }
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
      let tableName = 'stocks_hourly';
      switch (timeframe) {
        case '1m': tableName = 'stocks_1min'; break;
        case '5m': tableName = 'stocks_5min'; break;
        case '15m': tableName = 'stocks_15min'; break;
        case '1h': tableName = 'stocks_hourly'; break;
        case '1d': tableName = 'stocks_daily'; break;
        default: tableName = 'stocks_hourly';
      }

      // Validate inputs
      if (!symbol || typeof symbol !== 'string') {
        throw new Error('Invalid symbol provided');
      }

      const validTimeframes = ['1m', '5m', '15m', '1h', '1d'];
      const queryTimeframe = validTimeframes.includes(timeframe) ? timeframe : '1h';

      // Get data ordered by date DESC to get most recent first, then filter out weekends
      const query = `
        SELECT
          date,
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
        ORDER BY date DESC
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

      let data = await result.json();

      data = await this.applyTradingFilters(data, queryTimeframe);

      // Remove duplicates by timestamp, keeping the last occurrence
      const seen = new Set();
      data = data.filter(row => {
        const timestamp = Math.floor(this.parseDateUTC(row.date).getTime() / 1000);
        if (seen.has(timestamp)) {
          return false;
        }
        seen.add(timestamp);
        return true;
      });

      // Reverse back to chronological order and transform for frontend
      return data.reverse().map(row => ({
        // Using the 'date' column which contains full ISO DateTime string
        time: Math.floor(this.parseDateUTC(row.date).getTime() / 1000),
        open: parseFloat(row.open),
        high: parseFloat(row.high),
        low: parseFloat(row.low),
        close: parseFloat(row.close),
        volume: parseInt(row.volume) || 0,
      }));

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
          MIN(date) as start_date,
          MAX(date) as end_date,
          MIN(date) as earliest_timestamp,
          MAX(date) as latest_timestamp
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
          date,
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
        AND date >= {startDate:String}
        AND date <= {endDate:String}
        ORDER BY date ASC
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

      let data = await result.json();

      data = await this.applyTradingFilters(data, timeframe);

      // Remove duplicates by timestamp, keeping the last occurrence
      const seen = new Set();
      data = data.filter(row => {
        const timestamp = Math.floor(this.parseDateUTC(row.date).getTime() / 1000);
        if (seen.has(timestamp)) {
          return false;
        }
        seen.add(timestamp);
        return true;
      });

      return data.map(row => ({
        time: Math.floor(this.parseDateUTC(row.date).getTime() / 1000),
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

  /**
   * Search symbols from stocks_summary
   * @param {string} query - Search query
   * @returns {Promise<Array>} Array of matching symbols
   */
  async searchSymbols(query = '') {
    try {
      const sqlQuery = `
        SELECT
          symbol,
          in_daily,
          in_hourly
        FROM stocks_summary
        WHERE symbol LIKE {query:String}
        LIMIT 20
      `;

      const result = await client.query({
        query: sqlQuery,
        query_params: {
          query: `%${query.toUpperCase()}%`,
        },
        format: 'JSONEachRow',
      });

      return await result.json();
    } catch (error) {
      console.error('Error searching symbols:', error);
      throw new Error(`Failed to search symbols: ${error.message}`);
    }
  }
}

module.exports = new StockService();
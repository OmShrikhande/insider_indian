const { client } = require('../config/database');

class ScreenerService {
  async scanMomentum(limit = 20) {
    const result = await client.query({
      query: `
        SELECT
          symbol,
          anyLast(close) AS latest_close,
          ((anyLast(close) - anyLast(open)) / nullIf(anyLast(open), 0)) * 100 AS day_move_pct,
          sum(volume) AS total_volume
        FROM stocks_15min
        WHERE date >= now() - INTERVAL 1 DAY
        GROUP BY symbol
        ORDER BY day_move_pct DESC
        LIMIT {limit:UInt32}
      `,
      query_params: { limit: Math.min(100, Math.max(5, Number(limit) || 20)) },
      format: 'JSONEachRow',
    });
    return result.json();
  }

  async scanVolatility(limit = 20) {
    const result = await client.query({
      query: `
        SELECT
          symbol,
          avg((high - low) / nullIf(close, 0) * 100) AS avg_range_pct,
          max(high) AS max_high,
          min(low) AS min_low
        FROM stocks_15min
        WHERE date >= now() - INTERVAL 3 DAY
        GROUP BY symbol
        ORDER BY avg_range_pct DESC
        LIMIT {limit:UInt32}
      `,
      query_params: { limit: Math.min(100, Math.max(5, Number(limit) || 20)) },
      format: 'JSONEachRow',
    });
    return result.json();
  }

  async scanTrend(limit = 20) {
    const result = await client.query({
      query: `
        WITH latest AS (
          SELECT symbol, argMax(close, date) AS latest_close
          FROM stocks_hourly
          GROUP BY symbol
        ),
        hist AS (
          SELECT symbol, avg(close) AS avg_close_20
          FROM (
            SELECT symbol, close, date
            FROM stocks_hourly
            ORDER BY date DESC
            LIMIT 20000
          )
          GROUP BY symbol
        )
        SELECT
          l.symbol,
          l.latest_close,
          h.avg_close_20,
          (l.latest_close - h.avg_close_20) / nullIf(h.avg_close_20, 0) * 100 AS trend_strength_pct
        FROM latest l
        INNER JOIN hist h ON l.symbol = h.symbol
        ORDER BY trend_strength_pct DESC
        LIMIT {limit:UInt32}
      `,
      query_params: { limit: Math.min(100, Math.max(5, Number(limit) || 20)) },
      format: 'JSONEachRow',
    });
    return result.json();
  }
}

module.exports = new ScreenerService();

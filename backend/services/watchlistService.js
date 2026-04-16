const { client } = require('../config/database');

class WatchlistService {
  async getWatchlist(userId) {
    const result = await client.query({
      query: `
        SELECT symbol
        FROM watchlists
        WHERE user_id = {userId:String}
        ORDER BY created_at DESC
      `,
      query_params: { userId },
      format: 'JSONEachRow',
    });
    const rows = await result.json();
    return rows.map((r) => r.symbol);
  }

  async toggleWatchlist(userId, symbol) {
    const normalized = String(symbol || '').toUpperCase().trim();
    if (!normalized) {
      throw new Error('Symbol is required');
    }

    const existing = await client.query({
      query: `
        SELECT symbol
        FROM watchlists
        WHERE user_id = {userId:String}
          AND symbol = {symbol:String}
        LIMIT 1
      `,
      query_params: { userId, symbol: normalized },
      format: 'JSONEachRow',
    });
    const existingData = await existing.json();

    if (existingData.length > 0) {
      await client.exec({
        query: `
          ALTER TABLE watchlists
          DELETE WHERE user_id = {userId:String}
            AND symbol = {symbol:String}
        `,
        query_params: { userId, symbol: normalized },
      });
      return { action: 'removed', symbol: normalized };
    }

    await client.insert({
      table: 'watchlists',
      values: [{
        user_id: userId,
        symbol: normalized,
        created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
      }],
      format: 'JSONEachRow',
    });
    return { action: 'added', symbol: normalized };
  }
}

module.exports = new WatchlistService();

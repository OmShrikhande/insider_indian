const { client, testConnection } = require('../config/database');

class NewsService {
  constructor() {
    this.syncInterval = null;
    this.isSyncing = false;
    // Start background sync every 90 minutes
    this.initBackgroundSync();
  }

  async initBackgroundSync() {
    // Check database connection before starting sync
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.warn('[NewsService] Database not available. Skipping news sync initialization.');
      return;
    }

    console.log('[NewsService] Initializing 90-minute background sync...');
    // Initial fetch
    await this.fetchAndStoreNews();

    // Set interval (90 mins = 5400000ms)
    this.syncInterval = setInterval(() => {
      this.fetchAndStoreNews();
    }, 90 * 60 * 1000);
  }

  async fetchAndStoreNews() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    
    const apiKey = process.env.INDIAN_API_KEY;
    if (!apiKey || apiKey === 'YOUR_INDIAN_API_IN_KEY_HERE') {
      console.warn('[NewsService] INDIAN_API_KEY not configured, skip sync.');
      this.isSyncing = false;
      return;
    }

    try {
      console.log('[NewsService] Executing background news sync...');
      const url = 'https://stock.indianapi.in/news';
      
      const response = await fetch(url, {
        headers: { 'X-Api-Key': apiKey }
      });
      
      console.log(`[NewsService] API Status: ${response.status} ${response.statusText}`);
      const data = await response.json();

      let items = [];
      if (Array.isArray(data)) {
        items = data;
      } else if ((data.status === 'success' || data.success === true) && (data.news || data.data)) {
        items = data.news || data.data;
      }

      if (items.length > 0) {
        // Prepare for ClickHouse insert with stable IDs to allow deduplication
        const rows = items.map((item) => {
          // Generate a stable ID based on title and source to avoid duplicates
          const stableId = Buffer.from(item.title + (item.source || '')).toString('base64').slice(0, 32);
          
          return {
            id: stableId,
            title: item.title,
            summary: item.description || item.summary || '',
            timestamp: new Date(item.published_at || item.publishedAt || item.date || Date.now()).toISOString().replace('T', ' ').slice(0, 19),
            source: item.source || 'Indian Market Intel',
            url: item.url || '#',
            sentiment: this.detectSentiment(item.title + ' ' + (item.description || item.summary || ''))
          };
        });

        if (rows.length > 0) {
          await client.insert({
            table: 'news',
            values: rows,
            format: 'JSONEachRow'
          });
          console.log(`[NewsService] Background sync: Successfully stored ${rows.length} unique news items.`);
        }
      }
    } catch (error) {
      console.error('[NewsService] Sync failed:', error.message);
    } finally {
      this.isSyncing = false;
    }
  }

  async getNewsFromDB(search = '', sort = 'desc') {
    try {
      let query = 'SELECT * FROM news';
      const params = {};

      if (search) {
        query += ` WHERE lower(title) LIKE lower('%${search}%') OR lower(summary) LIKE lower('%${search}%')`;
      }

      query += ` ORDER BY timestamp ${sort === 'asc' ? 'ASC' : 'DESC'} LIMIT 50`;

      const result = await client.query({
        query,
        format: 'JSONEachRow'
      });

      return await result.json();
    } catch (error) {
      console.error('[NewsService] Database retrieval failed:', error);
      // Return mock data when database is unavailable
      console.log('[NewsService] Returning mock news data due to database unavailability');
      return this.getMockNews();
    }
  }

  // legacy method for compatibility if needed elsewhere
  async getLatestNews() {
    return this.getNewsFromDB();
  }

  detectSentiment(text) {
    text = text.toLowerCase();
    const bullishWords = ['surge', 'gain', 'rise', 'growth', 'bull', 'positive', 'breakout', 'success', 'strong', 'up', 'high'];
    const bearishWords = ['fall', 'dip', 'plunge', 'bear', 'negative', 'crash', 'weak', 'loss', 'decline', 'down', 'low'];

    let score = 0;
    bullishWords.forEach(word => { if (text.includes(word)) score++; });
    bearishWords.forEach(word => { if (text.includes(word)) score--; });

    if (score > 0) return 'bullish';
    if (score < 0) return 'bearish';
    return 'neutral';
  }

  getMockNews() {
    return [
      {
        id: 'n1',
        title: 'Quantum Computing Breakthrough Impacts Tech Sector',
        summary: 'A major breakthrough in quantum qubit stability is driving tech stocks higher as investors anticipate faster encryption and modeling.',
        timestamp: new Date().toISOString(),
        source: 'Cyber Financial',
        sentiment: 'bullish'
      }
    ];
  }
}

module.exports = new NewsService();


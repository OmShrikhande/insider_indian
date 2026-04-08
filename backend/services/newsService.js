class NewsService {
  async getLatestNews() {
    // Mock news data with a "futuristic" and "pro" feel
    return [
      {
        id: 'n1',
        title: 'Quantum Computing Breakthrough Impacts Tech Sector',
        summary: 'A major breakthrough in quantum qubit stability is driving tech stocks higher as investors anticipate faster encryption and modeling.',
        timestamp: new Date().toISOString(),
        source: 'Cyber Financial',
        sentiment: 'bullish'
      },
      {
        id: 'n2',
        title: 'Market Volatility Increases as Lunar Mining Regulations Loom',
        summary: 'Uncertainty over space-resource rights is causing fluctuations in industrial and energy stocks.',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        source: 'Deep Space Trade',
        sentiment: 'neutral'
      },
      {
        id: 'n3',
        title: 'Central Banks Adopt Blockchain for Settlement',
        summary: 'Wait times for international transfers expected to hit sub-second levels by 2030.',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        source: 'The Ledger',
        sentiment: 'bullish'
      },
      {
        id: 'n4',
        title: 'Energy Crisis in Mars Colonies Stabilizes',
        summary: 'Fusion reactor uptime reaches 99.9%, relieving pressure on terrestrial energy exports.',
        timestamp: new Date(Date.now() - 10800000).toISOString(),
        source: 'Galactic News',
        sentiment: 'bullish'
      }
    ];
  }
}

module.exports = new NewsService();

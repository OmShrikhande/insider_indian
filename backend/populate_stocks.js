const { client } = require('./config/database');

async function populateStocksSummary() {
  try {
    console.log('Populating stocks_summary table...');

    // Common Indian stocks
    const stocks = [
      'RELIANCE', 'TCS', 'HDFCBANK', 'ICICIBANK', 'INFY', 'HINDUNILVR', 'ITC', 'KOTAKBANK',
      'LT', 'AXISBANK', 'MARUTI', 'BAJFINANCE', 'BHARTIARTL', 'WIPRO', 'HCLTECH', 'NTPC',
      'POWERGRID', 'ONGC', 'COALINDIA', 'GAIL', 'DRREDDY', 'SUNPHARMA', 'CIPLA', 'DIVISLAB',
      'ABB', 'TMCV', 'TORNTPHARM', 'TORNTPOWER', 'TRENT', 'TTKPRESTIG', 'TVSMOTOR', 'UBL',
      'ULTRACEMCO', 'UNIONBANK', 'UNITDSPR', 'UNITECH', 'VALIANTORG', 'VBL', 'VEDL'
    ];

    const values = stocks.map(symbol => ({
      symbol,
      sector: 'NSE'
    }));

    await client.insert({
      table: 'stocks_summary',
      values,
      format: 'JSONEachRow'
    });

    console.log(`✅ Inserted ${stocks.length} stocks into stocks_summary`);

  } catch (error) {
    console.error('Error populating stocks:', error);
  }
}

populateStocksSummary();
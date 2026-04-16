const { client } = require('./config/database');

async function setupTables() {
  try {
    console.log('Setting up ClickHouse tables...');

    // Create stocks_summary table
    await client.exec({
      query: `
        CREATE TABLE IF NOT EXISTS stocks_summary (
          symbol String,
          sector String
        ) ENGINE = MergeTree()
        ORDER BY symbol
      `
    });
    console.log('✅ Created stocks_summary table');

    // Create stocks_15min table
    await client.exec({
      query: `
        CREATE TABLE IF NOT EXISTS stocks_15min (
          date DateTime,
          open Float64,
          high Float64,
          low Float64,
          close Float64,
          volume UInt64,
          symbol String,
          timeframe String,
          sector String
        ) ENGINE = MergeTree()
        ORDER BY (symbol, date)
      `
    });
    console.log('✅ Created stocks_15min table');

    // Create stocks_hourly table
    await client.exec({
      query: `
        CREATE TABLE IF NOT EXISTS stocks_hourly (
          date DateTime,
          open Float64,
          high Float64,
          low Float64,
          close Float64,
          volume UInt64,
          symbol String,
          timeframe String,
          sector String
        ) ENGINE = MergeTree()
        ORDER BY (symbol, date)
      `
    });
    console.log('✅ Created stocks_hourly table');

    // Create stocks_daily table
    await client.exec({
      query: `
        CREATE TABLE IF NOT EXISTS stocks_daily (
          date DateTime,
          open Float64,
          high Float64,
          low Float64,
          close Float64,
          volume UInt64,
          symbol String,
          timeframe String,
          sector String
        ) ENGINE = MergeTree()
        ORDER BY (symbol, date)
      `
    });
    console.log('✅ Created stocks_daily table');

    // Create news table
    await client.exec({
      query: `
        CREATE TABLE IF NOT EXISTS news (
          id String,
          title String,
          summary String,
          timestamp DateTime,
          source String,
          url String,
          sentiment String
        ) ENGINE = MergeTree()
        ORDER BY timestamp
      `
    });
    console.log('✅ Created news table');

    console.log('All tables created successfully!');

  } catch (error) {
    console.error('Error setting up tables:', error);
  }
}

setupTables();
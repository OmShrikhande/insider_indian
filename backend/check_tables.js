const { client } = require('./config/database');

async function createTableIfNotExists(tableName, createQuery) {
  try {
    await client.exec({ query: createQuery });
    console.log(`✅ Created ${tableName} table`);
  } catch (error) {
    console.log(`⚠️  ${tableName} table creation failed:`, error.message);
  }
}

(async () => {
  try {
    console.log('Checking and creating database tables...');

    // Create stocks_summary table
    await createTableIfNotExists('stocks_summary', `
      CREATE TABLE IF NOT EXISTS stocks_summary (
        symbol String,
        sector String
      ) ENGINE = MergeTree()
      ORDER BY symbol
    `);

    // Create stocks_15min table
    await createTableIfNotExists('stocks_15min', `
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
    `);

    // Create stocks_hourly table
    await createTableIfNotExists('stocks_hourly', `
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
    `);

    // Create stocks_daily table
    await createTableIfNotExists('stocks_daily', `
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
    `);

    // Create news table
    await createTableIfNotExists('news', `
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
    `);

    // Create fno_15min table
    await createTableIfNotExists('fno_15min', `
      CREATE TABLE IF NOT EXISTS fno_15min (
        date DateTime,
        open Float64,
        high Float64,
        low Float64,
        close Float64,
        volume UInt64,
        instrument_key String,
        trading_symbol String,
        underlying_symbol String,
        expiry Date,
        strike Float64,
        option_type String,
        timeframe String
      ) ENGINE = MergeTree()
      ORDER BY (instrument_key, date)
    `);

    // Create fno_hourly table
    await createTableIfNotExists('fno_hourly', `
      CREATE TABLE IF NOT EXISTS fno_hourly (
        date DateTime,
        open Float64,
        high Float64,
        low Float64,
        close Float64,
        volume UInt64,
        instrument_key String,
        trading_symbol String,
        underlying_symbol String,
        expiry Date,
        strike Float64,
        option_type String,
        timeframe String
      ) ENGINE = MergeTree()
      ORDER BY (instrument_key, date)
    `);

    // Show all tables
    const result = await client.query({
      query: 'SHOW TABLES',
      format: 'JSONEachRow',
    });
    const tables = await result.json();
    console.log('\nTables in database:');
    tables.forEach(table => console.log('- ' + table.name));

    // Check schema of stocks_15min if it exists
    if (tables.some(t => t.name === 'stocks_15min')) {
      console.log('\nSchema of stocks_15min:');
      const schemaResult = await client.query({
        query: 'DESCRIBE stocks_15min',
        format: 'JSONEachRow',
      });
      const schema = await schemaResult.json();
      schema.forEach(col => console.log(`  ${col.name}: ${col.type}`));
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
})();
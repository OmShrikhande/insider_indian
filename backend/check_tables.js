const { client } = require('./config/database');

(async () => {
  try {
    console.log('Checking database tables...');

    // Show all tables
    const result = await client.query({
      query: 'SHOW TABLES',
      format: 'JSONEachRow',
    });
    const tables = await result.json();
    console.log('Tables in database:');
    tables.forEach(table => console.log('- ' + table.name));

    // Check schema of stocks_hourly if it exists
    if (tables.some(t => t.name === 'stocks_hourly')) {
      console.log('\nSchema of stocks_hourly:');
      const schemaResult = await client.query({
        query: 'DESCRIBE stocks_hourly',
        format: 'JSONEachRow',
      });
      const schema = await schemaResult.json();
      schema.forEach(col => console.log(`  ${col.name}: ${col.type}`));
    }

    // Check if stocks_summary exists
    if (tables.some(t => t.name === 'stocks_summary')) {
      console.log('\nSchema of stocks_summary:');
      const schemaResult = await client.query({
        query: 'DESCRIBE stocks_summary',
        format: 'JSONEachRow',
      });
      const schema = await schemaResult.json();
      schema.forEach(col => console.log(`  ${col.name}: ${col.type}`));
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
})();
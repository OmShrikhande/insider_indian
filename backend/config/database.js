const { createClient } = require('@clickhouse/client');
require('dotenv').config();

const clickhouseConfig = {
  url: `http://${process.env.CLICKHOUSE_HOST || 'localhost'}:${process.env.CLICKHOUSE_PORT || 8123}`,
  username: process.env.CLICKHOUSE_USERNAME || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
  database: process.env.CLICKHOUSE_DATABASE || 'stocks',
};

const client = createClient(clickhouseConfig);

// Test connection
const testConnection = async () => {
  try {
    const result = await client.query({
      query: 'SELECT 1 as test',
      format: 'JSONEachRow',
    });
    const data = await result.json();
    console.log('✅ ClickHouse connection successful');
    return true;
  } catch (error) {
    console.error('❌ ClickHouse connection failed:', error.message);
    return false;
  }
};

module.exports = {
  client,
  testConnection,
  config: clickhouseConfig,
};
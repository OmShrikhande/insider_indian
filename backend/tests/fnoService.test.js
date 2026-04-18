const test = require('node:test');
const assert = require('node:assert/strict');
const fnoService = require('../services/fnoService');

test('normalizeTradePayload validates FNO option payload', () => {
  const row = fnoService.normalizeTradePayload({
    marketSegment: 'FNO',
    instrumentType: 'OPTION',
    optionType: 'CE',
    symbol: 'NIFTY',
    strike: 24500,
    expiry: '2026-04-30',
    side: 'BUY',
    entry: 120,
    target: 180,
    stopLoss: 90,
    analysis: 'Momentum breakout',
  });
  assert.equal(row.market_segment, 'FNO');
  assert.equal(row.option_type, 'CE');
  assert.equal(row.symbol, 'NIFTY');
});

test('normalizeTradePayload rejects missing required fields', () => {
  assert.throws(() => {
    fnoService.normalizeTradePayload({
      marketSegment: 'FNO',
      instrumentType: 'OPTION',
      symbol: 'NIFTY',
      side: 'BUY',
      entry: 100,
      target: 120,
      stopLoss: 90,
    });
  });
});

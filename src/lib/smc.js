/**
 * Smart Money Concepts (SMC) Detection Utility
 * Detects BOS, CHoCH, and Order Blocks with Volume confirmation
 */

export const detectSMC = (data, symbol = 'UNKNOWN') => {
  if (data.length < 50) return { bos: [], choch: [], obs: [], suggestions: [] };

  const bos = [];
  const choch = [];
  const obs = [];
  const suggestions = [];

  let lastHigh = data[0].high;
  let lastLow = data[0].low;
  let trend = 'unknown'; // 'bull' | 'bear'

  for (let i = 20; i < data.length; i++) {
    const c = data[i];
    const prev = data[i - 1];

    // --- BOS (Break of Structure): Price continues in the current trend ---
    if (trend === 'bull' && c.close > lastHigh) {
      bos.push({ time: c.time, type: 'BOS', color: '#39ff14', price: lastHigh });
      lastHigh = c.high;
    } else if (trend === 'bear' && c.close < lastLow) {
      bos.push({ time: c.time, type: 'BOS', color: '#ff003c', price: lastLow });
      lastLow = c.low;
    }

    // --- CHoCH (Change of Character): First sign of trend reversal ---
    if (trend === 'bull' && c.close < lastLow) {
      choch.push({ time: c.time, type: 'CHoCH', color: '#ff003c', price: lastLow });
      trend = 'bear';
      lastLow = c.low;
    } else if (trend === 'bear' && c.close > lastHigh) {
      choch.push({ time: c.time, type: 'CHoCH', color: '#39ff14', price: lastHigh });
      trend = 'bull';
      lastHigh = c.high;
    }

    // Initial trend detection
    if (trend === 'unknown') {
      if (c.close > data[i - 10].high) trend = 'bull';
      if (c.close < data[i - 10].low) trend = 'bear';
    }

    // Update swing highs/lows
    if (c.high > lastHigh) lastHigh = c.high;
    if (c.low < lastLow) lastLow = c.low;
  }

  // --- Order Blocks (OB) ---
  // Bullish OB: last bearish candle before a strong bullish impulse with breakout.
  // Bearish OB: last bullish candle before a strong bearish impulse with breakdown.
  for (let i = 30; i < data.length - 6; i++) {
    const c = data[i];
    const lookback = data.slice(i - 20, i);
    const avgBody = lookback.reduce((acc, d) => acc + Math.abs(d.close - d.open), 0) / Math.max(1, lookback.length);
    const bodySize = Math.abs(c.close - c.open);
    const impulseUp = data[i + 4].close - data[i + 1].open;
    const impulseDown = data[i + 1].open - data[i + 4].close;
    const brokeRecentHigh = data[i + 4].close > Math.max(...lookback.map((d) => d.high));
    const brokeRecentLow = data[i + 4].close < Math.min(...lookback.map((d) => d.low));
    const volumeBurst =
      Number(data[i + 1].volume || 0) + Number(data[i + 2].volume || 0) >
      Number(c.volume || 0) * 1.5;

    if (c.close < c.open && impulseUp > avgBody * 2.5 && brokeRecentHigh && volumeBurst && bodySize > avgBody * 0.5) {
      obs.push({ 
        time: c.time, 
        type: 'Bullish OB', 
        price: c.low, 
        high: c.high,
        low: c.low,
        sentiment: 'bull' 
      });
    } else if (c.close > c.open && impulseDown > avgBody * 2.5 && brokeRecentLow && volumeBurst && bodySize > avgBody * 0.5) {
      obs.push({ 
        time: c.time, 
        type: 'Bearish OB', 
        price: c.high, 
        high: c.high,
        low: c.low,
        sentiment: 'bear' 
      });
    }
  }

  // --- Trade Suggestions ---
  const latestPrice = data[data.length - 1].close;
  const activeOB = obs.filter(ob =>
    ob.sentiment === 'bull' ? latestPrice > ob.price : latestPrice < ob.price
  );

  activeOB.forEach(ob => {
    const entry = ob.sentiment === 'bull' ? ob.high : ob.low;
    const target = ob.sentiment === 'bull' ? ob.high * 1.05 : ob.low * 0.95;
    const stopLoss = ob.sentiment === 'bull' ? ob.low : ob.high;

    suggestions.push({
      symbol,
      type: ob.sentiment === 'bull' ? 'LONG' : 'SHORT',
      entry,
      target,
      stopLoss,
      time: ob.time,
      ob: {
        high: ob.high,
        low: ob.low,
        sentiment: ob.sentiment,
      },
      range: {
        min: Math.min(entry, target, stopLoss),
        max: Math.max(entry, target, stopLoss),
        entry,
        target,
        stopLoss
      },
      reason: `${ob.type} detected with structure shift. High volume confirmation.`
    });
  });

  return { bos, choch, obs, suggestions };
};

export const detectChainSMC = (chainRows = [], symbol = 'NIFTY', expiry = '') => {
  if (!Array.isArray(chainRows) || chainRows.length < 3) return [];

  const toNum = (v) => Number(v || 0);
  const rows = chainRows
    .map((row) => {
      const strike = toNum(row.strike_price);
      const callDelta = toNum(row.call_delta);
      const putDelta = Math.abs(toNum(row.put_delta));
      const callIv = toNum(row.call_iv);
      const putIv = toNum(row.put_iv);
      const callOi = toNum(row.call_oi);
      const putOi = toNum(row.put_oi);
      const callVolume = toNum(row.call_volume);
      const putVolume = toNum(row.put_volume);
      const callLtp = toNum(row.call_ltp);
      const putLtp = toNum(row.put_ltp);
      const thetaSkew = toNum(row.call_theta) - Math.abs(toNum(row.put_theta));

      return {
        strike,
        callDelta,
        putDelta,
        callIv,
        putIv,
        callOi,
        putOi,
        callVolume,
        putVolume,
        callLtp,
        putLtp,
        thetaSkew,
        callPressure: (callOi + callVolume) * Math.max(0.1, callDelta),
        putPressure: (putOi + putVolume) * Math.max(0.1, putDelta),
      };
    })
    .filter((r) => r.strike > 0)
    .sort((a, b) => a.strike - b.strike);

  if (!rows.length) return [];

  const strongestCall = [...rows].sort((a, b) => b.callPressure - a.callPressure)[0];
  const strongestPut = [...rows].sort((a, b) => b.putPressure - a.putPressure)[0];
  const atmRow = rows[Math.floor(rows.length / 2)];

  const trades = [];
  if (strongestCall) {
    trades.push({
      symbol: `${symbol}${expiry ? ` ${expiry}` : ''}`,
      type: 'LONG',
      entry: strongestCall.callLtp || strongestCall.strike * 0.01,
      target: (strongestCall.callLtp || strongestCall.strike * 0.01) * 1.15,
      stopLoss: (strongestCall.callLtp || strongestCall.strike * 0.01) * 0.88,
      time: Math.floor(Date.now() / 1000),
      reason: `Chain bullish bias near strike ${strongestCall.strike}: CE pressure > PE, delta support ${strongestCall.callDelta.toFixed(2)}.`,
      confidence: Math.min(95, 60 + Math.round(strongestCall.callDelta * 20)),
      source: 'CHAIN_ALPHA',
    });
  }

  if (strongestPut) {
    trades.push({
      symbol: `${symbol}${expiry ? ` ${expiry}` : ''}`,
      type: 'SHORT',
      entry: strongestPut.putLtp || strongestPut.strike * 0.01,
      target: (strongestPut.putLtp || strongestPut.strike * 0.01) * 1.15,
      stopLoss: (strongestPut.putLtp || strongestPut.strike * 0.01) * 0.88,
      time: Math.floor(Date.now() / 1000),
      reason: `Chain bearish bias near strike ${strongestPut.strike}: PE pressure > CE, put-delta ${strongestPut.putDelta.toFixed(2)}.`,
      confidence: Math.min(95, 60 + Math.round(strongestPut.putDelta * 20)),
      source: 'CHAIN_ALPHA',
    });
  }

  if (atmRow) {
    const skew = atmRow.callIv - atmRow.putIv;
    trades.push({
      symbol: `${symbol}${expiry ? ` ${expiry}` : ''}`,
      type: skew >= 0 ? 'LONG' : 'SHORT',
      entry: skew >= 0 ? atmRow.callLtp : atmRow.putLtp,
      target: (skew >= 0 ? atmRow.callLtp : atmRow.putLtp) * 1.1,
      stopLoss: (skew >= 0 ? atmRow.callLtp : atmRow.putLtp) * 0.9,
      time: Math.floor(Date.now() / 1000),
      reason: `ATM IV skew at ${atmRow.strike}: ${skew >= 0 ? 'calls' : 'puts'} priced richer; theta skew ${atmRow.thetaSkew.toFixed(2)}.`,
      confidence: 70,
      source: 'CHAIN_SKEW',
    });
  }

  return trades.slice(0, 4);
};

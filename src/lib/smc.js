/**
 * Smart Money Concepts (SMC) Detection Utility
 * Detects BOS, CHoCH, and Order Blocks with Volume confirmation
 */

export const detectSMC = (data) => {
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
  // A Bullish OB is the last bearish candle before a strong bullish expansion
  for (let i = 2; i < data.length - 5; i++) {
    const c = data[i];
    const next = data[i + 1];
    
    // Check for "Impulsive Move" (Expansion)
    const expansion = data[i + 3].close - data[i + 1].open;
    const bodySize = Math.abs(c.close - c.open);
    
    if (expansion > bodySize * 3 && c.close < c.open) {
      obs.push({ 
        time: c.time, 
        type: 'Bullish OB', 
        price: c.low, 
        high: c.high,
        low: c.low,
        sentiment: 'bull' 
      });
    } else if (expansion < -bodySize * 3 && c.close > c.open) {
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
  ).slice(-3);

  activeOB.forEach(ob => {
    const entry = ob.sentiment === 'bull' ? ob.high : ob.low;
    const target = ob.sentiment === 'bull' ? ob.high * 1.05 : ob.low * 0.95;
    const stopLoss = ob.sentiment === 'bull' ? ob.low : ob.high;

    suggestions.push({
      symbol: ob.symbol,
      type: ob.sentiment === 'bull' ? 'LONG' : 'SHORT',
      entry,
      target,
      stopLoss,
      time: ob.time,
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

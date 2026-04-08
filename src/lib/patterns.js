/**
 * ProTrader Pattern Detection Library
 * Candlestick & chart patterns with accurate mathematical detection
 */

const bodySize = (c) => Math.abs(c.close - c.open);
const upperWick = (c) => c.high - Math.max(c.open, c.close);
const lowerWick = (c) => Math.min(c.open, c.close) - c.low;
const range = (c) => c.high - c.low;
const isBull = (c) => c.close > c.open;
const isBear = (c) => c.close < c.open;

// Dynamic threshold: 20% of avg range of last 20 candles
const avgRange = (data, idx, period = 20) => {
  const slice = data.slice(Math.max(0, idx - period), idx);
  return slice.length ? slice.reduce((a, c) => a + range(c), 0) / slice.length : range(data[idx]);
};

// ─── Single-candle patterns ───────────────────────────────────────────────────

export const isHammer = (c, avgR) => {
  const body = bodySize(c);
  const ll = lowerWick(c);
  const ul = upperWick(c);
  const r = range(c);
  return r > 0 && ll >= 2 * body && ul <= 0.3 * body && body > 0.05 * avgR;
};

export const isInvertedHammer = (c, avgR) => {
  const body = bodySize(c);
  const ll = lowerWick(c);
  const ul = upperWick(c);
  return ul >= 2 * body && ll <= 0.3 * body && body > 0.05 * avgR;
};

export const isShootingStar = (c, avgR) => isInvertedHammer(c, avgR) && isBear(c);

export const isHangingMan = (c, avgR) => isHammer(c, avgR) && isBear(c);

export const isDoji = (c, avgR) => {
  const body = bodySize(c);
  const r = range(c);
  return r > 0 && body / r < 0.1 && r > 0.1 * avgR;
};

export const isDragonflyDoji = (c, avgR) => {
  return isDoji(c, avgR) && lowerWick(c) >= 2 * upperWick(c) && lowerWick(c) > 0.5 * range(c);
};

export const isGravestoneDoji = (c, avgR) => {
  return isDoji(c, avgR) && upperWick(c) >= 2 * lowerWick(c) && upperWick(c) > 0.5 * range(c);
};

export const isSpinningTop = (c, avgR) => {
  const body = bodySize(c);
  const ul = upperWick(c);
  const ll = lowerWick(c);
  const r = range(c);
  return r > 0 && body / r < 0.35 && ul > 0.2 * r && ll > 0.2 * r && body > 0.05 * avgR;
};

export const isMarubozuBull = (c, avgR) => {
  return isBull(c) && upperWick(c) < 0.02 * range(c) && lowerWick(c) < 0.02 * range(c) && bodySize(c) > 0.7 * avgR;
};

export const isMarubozuBear = (c, avgR) => {
  return isBear(c) && upperWick(c) < 0.02 * range(c) && lowerWick(c) < 0.02 * range(c) && bodySize(c) > 0.7 * avgR;
};

export const isPinBarBull = (c, avgR) => isHammer(c, avgR);
export const isPinBarBear = (c, avgR) => isShootingStar(c, avgR);

// ─── Two-candle patterns ──────────────────────────────────────────────────────

export const isBullishEngulfing = (prev, curr, avgR) => {
  return isBear(prev) && isBull(curr) &&
    curr.open <= prev.close && curr.close >= prev.open &&
    bodySize(curr) > bodySize(prev) &&
    bodySize(curr) > 0.3 * avgR;
};

export const isBearishEngulfing = (prev, curr, avgR) => {
  return isBull(prev) && isBear(curr) &&
    curr.open >= prev.close && curr.close <= prev.open &&
    bodySize(curr) > bodySize(prev) &&
    bodySize(curr) > 0.3 * avgR;
};

export const isBullishHarami = (prev, curr, avgR) => {
  return isBear(prev) && isBull(curr) &&
    curr.open > prev.close && curr.close < prev.open &&
    bodySize(curr) < bodySize(prev) * 0.6;
};

export const isBearishHarami = (prev, curr, avgR) => {
  return isBull(prev) && isBear(curr) &&
    curr.open < prev.close && curr.close > prev.open &&
    bodySize(curr) < bodySize(prev) * 0.6;
};

export const isDarkCloudCover = (prev, curr, avgR) => {
  const midPrev = (prev.open + prev.close) / 2;
  return isBull(prev) && isBear(curr) &&
    curr.open > prev.high &&
    curr.close < midPrev &&
    bodySize(prev) > 0.4 * avgR &&
    bodySize(curr) > 0.4 * avgR;
};

export const isPiercingLine = (prev, curr, avgR) => {
  const midPrev = (prev.open + prev.close) / 2;
  return isBear(prev) && isBull(curr) &&
    curr.open < prev.low &&
    curr.close > midPrev &&
    bodySize(prev) > 0.4 * avgR &&
    bodySize(curr) > 0.4 * avgR;
};

export const isInsideBar = (prev, curr) => {
  return curr.high < prev.high && curr.low > prev.low;
};

export const isTweezerTop = (prev, curr) => {
  return Math.abs(prev.high - curr.high) < 0.001 * prev.high && isBull(prev) && isBear(curr);
};

export const isTweezerBottom = (prev, curr) => {
  return Math.abs(prev.low - curr.low) < 0.001 * prev.low && isBear(prev) && isBull(curr);
};

// ─── Three-candle patterns ────────────────────────────────────────────────────

export const isMorningStar = (c1, c2, c3, avgR) => {
  const c2Body = bodySize(c2);
  return isBear(c1) && isBull(c3) &&
    c2Body < bodySize(c1) * 0.3 &&
    c2.high < c1.close &&
    c3.close > (c1.open + c1.close) / 2 &&
    bodySize(c1) > 0.4 * avgR &&
    bodySize(c3) > 0.4 * avgR;
};

export const isEveningStar = (c1, c2, c3, avgR) => {
  const c2Body = bodySize(c2);
  return isBull(c1) && isBear(c3) &&
    c2Body < bodySize(c1) * 0.3 &&
    c2.low > c1.close &&
    c3.close < (c1.open + c1.close) / 2 &&
    bodySize(c1) > 0.4 * avgR &&
    bodySize(c3) > 0.4 * avgR;
};

export const isThreeWhiteSoldiers = (c1, c2, c3, avgR) => {
  return isBull(c1) && isBull(c2) && isBull(c3) &&
    c2.open > c1.open && c2.close > c1.close &&
    c3.open > c2.open && c3.close > c2.close &&
    bodySize(c1) > 0.4 * avgR && bodySize(c2) > 0.4 * avgR && bodySize(c3) > 0.4 * avgR &&
    upperWick(c1) < 0.3 * bodySize(c1) &&
    upperWick(c2) < 0.3 * bodySize(c2) &&
    upperWick(c3) < 0.3 * bodySize(c3);
};

export const isThreeBlackCrows = (c1, c2, c3, avgR) => {
  return isBear(c1) && isBear(c2) && isBear(c3) &&
    c2.open < c1.open && c2.close < c1.close &&
    c3.open < c2.open && c3.close < c2.close &&
    bodySize(c1) > 0.4 * avgR && bodySize(c2) > 0.4 * avgR && bodySize(c3) > 0.4 * avgR &&
    lowerWick(c1) < 0.3 * bodySize(c1) &&
    lowerWick(c2) < 0.3 * bodySize(c2) &&
    lowerWick(c3) < 0.3 * bodySize(c3);
};

// ─── Order Blocks ─────────────────────────────────────────────────────────────

/**
 * Detect Bullish Order Block:
 * Last bearish candle before a strong bullish impulse move (3+ candles that move significantly higher)
 */
export const detectBullishOB = (data, idx, lookahead = 5, threshold = 1.5) => {
  if (idx >= data.length - lookahead) return false;
  if (!isBear(data[idx])) return false;
  const refBody = bodySize(data[idx]);
  if (refBody < 0.1 * avgRange(data, idx)) return false;

  // Check if the next candles form a strong bullish impulse
  let totalMove = 0;
  for (let i = 1; i <= lookahead; i++) {
    if (idx + i >= data.length) break;
    totalMove = data[idx + i].close - data[idx].close;
  }
  return totalMove > threshold * avgRange(data, idx);
};

/**
 * Detect Bearish Order Block:
 * Last bullish candle before a strong bearish impulse move
 */
export const detectBearishOB = (data, idx, lookahead = 5, threshold = 1.5) => {
  if (idx >= data.length - lookahead) return false;
  if (!isBull(data[idx])) return false;
  const refBody = bodySize(data[idx]);
  if (refBody < 0.1 * avgRange(data, idx)) return false;

  let totalMove = 0;
  for (let i = 1; i <= lookahead; i++) {
    if (idx + i >= data.length) break;
    totalMove = data[idx + i].close - data[idx].close;
  }
  return totalMove < -threshold * avgRange(data, idx);
};

// ─── Master Pattern Scanner ───────────────────────────────────────────────────

/**
 * Scan all data for enabled patterns and return markers
 * @param {Array} data - OHLCV array
 * @param {Object} activePatterns - { patternId: boolean }
 * @returns {Array} lightweight-charts marker objects
 */
export const scanPatterns = (data, activePatterns) => {
  const markers = [];

  const add = (time, pos, shape, color, text, id) => {
    if (!activePatterns[id]) return;
    markers.push({ time, position: pos, shape, color, text, size: 1 });
  };

  for (let i = 3; i < data.length - 3; i++) {
    const c = data[i];
    const prev = data[i - 1];
    const prev2 = data[i - 2];
    const next = data[i + 1];
    const avgR = avgRange(data, i);
    const t = c.time;

    // Single-candle
    if (isHammer(c, avgR))           add(t, 'belowBar', 'arrowUp',    '#39ff14', 'Hammer',          'hammer');
    if (isInvertedHammer(c, avgR))   add(t, 'aboveBar', 'arrowDown',  '#26a69a', 'Inv. Hammer',     'invertedHammer');
    if (isShootingStar(c, avgR))     add(t, 'aboveBar', 'arrowDown',  '#ff003c', 'Shoot★',          'shootingStar');
    if (isHangingMan(c, avgR))       add(t, 'aboveBar', 'arrowDown',  '#ff6f00', 'Hang Man',        'hangingMan');
    if (isDragonflyDoji(c, avgR))    add(t, 'belowBar', 'circle',     '#00f2ff', 'Dragon Doji',     'dragonflyDoji');
    if (isGravestoneDoji(c, avgR))   add(t, 'aboveBar', 'circle',     '#ff003c', 'Stone Doji',      'gravestoneDoji');
    if (isDoji(c, avgR))             add(t, 'belowBar', 'circle',     '#848e9c', 'Doji',            'doji');
    if (isSpinningTop(c, avgR))      add(t, 'belowBar', 'circle',     '#5d606b', 'Spin Top',        'spinningTop');
    if (isMarubozuBull(c, avgR))     add(t, 'belowBar', 'arrowUp',    '#39ff14', 'Marubozu↑',       'marubozuBull');
    if (isMarubozuBear(c, avgR))     add(t, 'aboveBar', 'arrowDown',  '#ff003c', 'Marubozu↓',       'marubozuBear');

    // Two-candle (i > 0)
    if (isBullishEngulfing(prev, c, avgR))  add(t, 'belowBar', 'arrowUp',   '#39ff14', 'Bull Engulf',   'bullishEngulfing');
    if (isBearishEngulfing(prev, c, avgR))  add(t, 'aboveBar', 'arrowDown', '#ff003c', 'Bear Engulf',   'bearishEngulfing');
    if (isBullishHarami(prev, c, avgR))     add(t, 'belowBar', 'arrowUp',   '#00f2ff', 'Bull Harami',   'bullishHarami');
    if (isBearishHarami(prev, c, avgR))     add(t, 'aboveBar', 'arrowDown', '#ff9800', 'Bear Harami',   'bearishHarami');
    if (isDarkCloudCover(prev, c, avgR))    add(t, 'aboveBar', 'arrowDown', '#ff003c', 'Dark Cloud',    'darkCloud');
    if (isPiercingLine(prev, c, avgR))      add(t, 'belowBar', 'arrowUp',   '#39ff14', 'Piercing',      'piercingLine');
    if (isInsideBar(prev, c))               add(t, 'belowBar', 'circle',    '#00bcd4', 'Inside Bar',    'insideBar');
    if (isTweezerBottom(prev, c))           add(t, 'belowBar', 'arrowUp',   '#4caf50', 'Tweezer Bot',   'tweezerBottom');
    if (isTweezerTop(prev, c))              add(t, 'aboveBar', 'arrowDown', '#ef5350', 'Tweezer Top',   'tweezerTop');

    // Three-candle (i > 1)
    if (i > 1) {
      if (isMorningStar(prev2, prev, c, avgR))      add(t, 'belowBar', 'arrowUp',   '#39ff14', 'Morning★',       'morningStar');
      if (isEveningStar(prev2, prev, c, avgR))      add(t, 'aboveBar', 'arrowDown', '#ff003c', 'Evening★',       'eveningStar');
      if (isThreeWhiteSoldiers(prev2, prev, c, avgR)) add(t, 'belowBar', 'arrowUp', '#39ff14', '3 Soldiers',     'threeWhiteSoldiers');
      if (isThreeBlackCrows(prev2, prev, c, avgR))  add(t, 'aboveBar', 'arrowDown', '#ff003c', '3 Crows',        'threeBlackCrows');
    }

    // Order Blocks
    if (detectBullishOB(data, i))   add(t, 'belowBar', 'arrowUp',   '#00f2ff', 'Bull OB',  'bullishOB');
    if (detectBearishOB(data, i))   add(t, 'aboveBar', 'arrowDown', '#ffa726', 'Bear OB',  'bearishOB');
  }

  // Sort by time (required by lightweight-charts)
  return markers.sort((a, b) => a.time - b.time);
};

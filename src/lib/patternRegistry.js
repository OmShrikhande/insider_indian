export const PATTERN_CATEGORIES = ['All', 'Bullish', 'Bearish', 'Neutral', 'Order Blocks'];

export const PATTERNS = [
  // Bullish Single
  { id: 'hammer',            name: 'Hammer',               category: 'Bullish',       bias: 'bull', description: 'Long lower wick, small body near top. Reversal signal.' },
  { id: 'invertedHammer',    name: 'Inverted Hammer',      category: 'Bullish',       bias: 'bull', description: 'Long upper wick, small body. Potential reversal.' },
  { id: 'pinBarBull',        name: 'Pin Bar (Bull)',        category: 'Bullish',       bias: 'bull', description: 'Long lower wick rejection. Strong reversal signal.' },
  { id: 'dragonflyDoji',     name: 'Dragonfly Doji',       category: 'Bullish',       bias: 'bull', description: 'Open = Close at high, long lower wick.' },
  { id: 'marubozuBull',      name: 'Marubozu Bull',        category: 'Bullish',       bias: 'bull', description: 'Full body, no wicks. Strong bullish momentum.' },
  { id: 'bullishEngulfing',  name: 'Bullish Engulfing',    category: 'Bullish',       bias: 'bull', description: 'Bullish candle completely engulfs prior bearish candle.' },
  { id: 'bullishHarami',     name: 'Bullish Harami',       category: 'Bullish',       bias: 'bull', description: 'Small bullish candle inside large bearish candle.' },
  { id: 'piercingLine',      name: 'Piercing Line',        category: 'Bullish',       bias: 'bull', description: 'Bullish candle opens below low, closes above midpoint.' },
  { id: 'morningStar',       name: 'Morning Star',         category: 'Bullish',       bias: 'bull', description: 'Three-candle bottoming reversal pattern.' },
  { id: 'threeWhiteSoldiers', name: 'Three White Soldiers', category: 'Bullish',      bias: 'bull', description: 'Three consecutive strong bullish candles.' },
  { id: 'tweezerBottom',     name: 'Tweezer Bottom',       category: 'Bullish',       bias: 'bull', description: 'Two candles share same low. Reversal signal.' },

  // Bearish Single
  { id: 'shootingStar',      name: 'Shooting Star',        category: 'Bearish',       bias: 'bear', description: 'Long upper wick at top of trend. Bearish reversal.' },
  { id: 'hangingMan',        name: 'Hanging Man',          category: 'Bearish',       bias: 'bear', description: 'Hammer shape at top of uptrend. Bearish warning.' },
  { id: 'pinBarBear',        name: 'Pin Bar (Bear)',       category: 'Bearish',       bias: 'bear', description: 'Long upper wick rejection. Strong reversal signal.' },
  { id: 'gravestoneDoji',    name: 'Gravestone Doji',      category: 'Bearish',       bias: 'bear', description: 'Open = Close at low, long upper wick.' },
  { id: 'marubozuBear',      name: 'Marubozu Bear',        category: 'Bearish',       bias: 'bear', description: 'Full body, no wicks. Strong bearish momentum.' },
  { id: 'bearishEngulfing',  name: 'Bearish Engulfing',    category: 'Bearish',       bias: 'bear', description: 'Bearish candle completely engulfs prior bullish candle.' },
  { id: 'bearishHarami',     name: 'Bearish Harami',       category: 'Bearish',       bias: 'bear', description: 'Small bearish candle inside large bullish candle.' },
  { id: 'darkCloud',         name: 'Dark Cloud Cover',     category: 'Bearish',       bias: 'bear', description: 'Bearish candle opens above high, closes below midpoint.' },
  { id: 'eveningStar',       name: 'Evening Star',         category: 'Bearish',       bias: 'bear', description: 'Three-candle topping reversal pattern.' },
  { id: 'threeBlackCrows',   name: 'Three Black Crows',    category: 'Bearish',       bias: 'bear', description: 'Three consecutive strong bearish candles.' },
  { id: 'tweezerTop',        name: 'Tweezer Top',          category: 'Bearish',       bias: 'bear', description: 'Two candles share same high. Reversal signal.' },

  // Neutral
  { id: 'doji',              name: 'Doji',                 category: 'Neutral',       bias: 'neutral', description: 'Open ≈ Close. Indecision candle.' },
  { id: 'spinningTop',       name: 'Spinning Top',         category: 'Neutral',       bias: 'neutral', description: 'Small body with equal upper/lower wicks. Indecision.' },
  { id: 'insideBar',         name: 'Inside Bar',           category: 'Neutral',       bias: 'neutral', description: 'Candle range fully inside previous candle.' },

  // Order Blocks
  { id: 'bullishOB',         name: 'Bullish OB',           category: 'Order Blocks',  bias: 'bull', description: 'Last bearish candle before strong upward impulse.' },
  { id: 'bearishOB',         name: 'Bearish OB',           category: 'Order Blocks',  bias: 'bear', description: 'Last bullish candle before strong downward impulse.' },
];

export const DEFAULT_PATTERNS = Object.fromEntries(
  PATTERNS.map(p => [p.id, false])
);

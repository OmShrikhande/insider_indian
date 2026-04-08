/**
 * ProTrader Indicator Registry
 * Defines metadata for all 50+ indicators available in the dashboard
 */

export const INDICATOR_CATEGORIES = [
  'Moving Averages',
  'Momentum',
  'Volatility',
  'Trend',
  'Volume',
  'Advanced',
];

/**
 * pane: 'price' = overlaid on candles | 'sub' = separate sub-pane
 * type: 'line' | 'histogram' | 'multi' (multiple lines) | 'band' (upper/lower)
 */
export const INDICATORS = [
  // ─── Moving Averages ────────────────────────────────
  { id: 'sma20',   name: 'SMA 20',   category: 'Moving Averages', pane: 'price', type: 'line',  color: '#00f2ff', params: { period: 20 }, enabled: true },
  { id: 'sma50',   name: 'SMA 50',   category: 'Moving Averages', pane: 'price', type: 'line',  color: '#26a69a', params: { period: 50 }, enabled: false },
  { id: 'sma100',  name: 'SMA 100',  category: 'Moving Averages', pane: 'price', type: 'line',  color: '#80cbc4', params: { period: 100 }, enabled: false },
  { id: 'sma200',  name: 'SMA 200',  category: 'Moving Averages', pane: 'price', type: 'line',  color: '#4db6ac', params: { period: 200 }, enabled: false },
  { id: 'ema9',    name: 'EMA 9',    category: 'Moving Averages', pane: 'price', type: 'line',  color: '#ffeb3b', params: { period: 9 }, enabled: true },
  { id: 'ema21',   name: 'EMA 21',   category: 'Moving Averages', pane: 'price', type: 'line',  color: '#e91e63', params: { period: 21 }, enabled: true },
  { id: 'ema50',   name: 'EMA 50',   category: 'Moving Averages', pane: 'price', type: 'line',  color: '#ff9800', params: { period: 50 }, enabled: false },
  { id: 'ema200',  name: 'EMA 200',  category: 'Moving Averages', pane: 'price', type: 'line',  color: '#ff5722', params: { period: 200 }, enabled: false },
  { id: 'wma',     name: 'WMA 20',   category: 'Moving Averages', pane: 'price', type: 'line',  color: '#9c27b0', params: { period: 20 }, enabled: false },
  { id: 'hma',     name: 'HMA 20',   category: 'Moving Averages', pane: 'price', type: 'line',  color: '#ba68c8', params: { period: 20 }, enabled: false },
  { id: 'dema',    name: 'DEMA 20',  category: 'Moving Averages', pane: 'price', type: 'line',  color: '#ce93d8', params: { period: 20 }, enabled: false },
  { id: 'tema',    name: 'TEMA 20',  category: 'Moving Averages', pane: 'price', type: 'line',  color: '#ab47bc', params: { period: 20 }, enabled: false },
  { id: 'vwap',    name: 'VWAP',     category: 'Moving Averages', pane: 'price', type: 'line',  color: '#00bcd4', params: {}, enabled: false },
  { id: 'vwma',    name: 'VWMA 20',  category: 'Moving Averages', pane: 'price', type: 'line',  color: '#0097a7', params: { period: 20 }, enabled: false },
  { id: 'alma',    name: 'ALMA 9',   category: 'Moving Averages', pane: 'price', type: 'line',  color: '#006064', params: { period: 9 }, enabled: false },

  // ─── Momentum ───────────────────────────────────────
  { id: 'rsi',     name: 'RSI 14',   category: 'Momentum', pane: 'sub', type: 'line',      color: '#ffa726', params: { period: 14 }, enabled: true },
  { id: 'macd',    name: 'MACD',     category: 'Momentum', pane: 'sub', type: 'macd',      color: '#26a69a', params: { fast: 12, slow: 26, signal: 9 }, enabled: false },
  { id: 'stoch',   name: 'Stochastic', category: 'Momentum', pane: 'sub', type: 'multi',   color: '#00bcd4', params: { k: 14, d: 3, smooth: 3 }, enabled: false },
  { id: 'stochrsi', name: 'StochRSI', category: 'Momentum', pane: 'sub', type: 'line',     color: '#e040fb', params: { period: 14 }, enabled: false },
  { id: 'cci',     name: 'CCI 20',   category: 'Momentum', pane: 'sub', type: 'line',      color: '#f06292', params: { period: 20 }, enabled: false },
  { id: 'roc',     name: 'ROC 12',   category: 'Momentum', pane: 'sub', type: 'histogram', color: '#4caf50', params: { period: 12 }, enabled: false },
  { id: 'momentum', name: 'Momentum 10', category: 'Momentum', pane: 'sub', type: 'line',  color: '#8bc34a', params: { period: 10 }, enabled: false },
  { id: 'willr',   name: 'Williams %R', category: 'Momentum', pane: 'sub', type: 'line',   color: '#cddc39', params: { period: 14 }, enabled: false },
  { id: 'ao',      name: 'Awesome Oscillator', category: 'Momentum', pane: 'sub', type: 'histogram', color: '#8bc34a', params: {}, enabled: false },
  { id: 'uo',      name: 'Ultimate Oscillator', category: 'Momentum', pane: 'sub', type: 'line', color: '#ff7043', params: {}, enabled: false },
  { id: 'tsi',     name: 'TSI',      category: 'Momentum', pane: 'sub', type: 'line',      color: '#ff8a65', params: { long: 25, short: 13 }, enabled: false },

  // ─── Volatility ─────────────────────────────────────
  { id: 'bb',      name: 'Bollinger Bands', category: 'Volatility', pane: 'price', type: 'band', color: '#546e7a', params: { period: 20, mult: 2 }, enabled: false },
  { id: 'atr',     name: 'ATR 14',   category: 'Volatility', pane: 'sub', type: 'line',   color: '#78909c', params: { period: 14 }, enabled: false },
  { id: 'kc',      name: 'Keltner Channels', category: 'Volatility', pane: 'price', type: 'band', color: '#4527a0', params: { period: 20, mult: 2 }, enabled: false },
  { id: 'dc',      name: 'Donchian Channels', category: 'Volatility', pane: 'price', type: 'band', color: '#283593', params: { period: 20 }, enabled: false },
  { id: 'stddev',  name: 'Std Dev 20', category: 'Volatility', pane: 'sub', type: 'line', color: '#5c6bc0', params: { period: 20 }, enabled: false },

  // ─── Trend ──────────────────────────────────────────
  { id: 'psar',    name: 'Parabolic SAR', category: 'Trend', pane: 'price', type: 'dots',   color: '#b0bec5', params: { step: 0.02, max: 0.2 }, enabled: false },
  { id: 'adx',     name: 'ADX 14',   category: 'Trend', pane: 'sub', type: 'line',         color: '#f9a825', params: { period: 14 }, enabled: false },
  { id: 'aroon',   name: 'Aroon 25', category: 'Trend', pane: 'sub', type: 'multi',        color: '#f57f17', params: { period: 25 }, enabled: false },
  { id: 'supertrend', name: 'Supertrend', category: 'Trend', pane: 'price', type: 'line',  color: '#b71c1c', params: { period: 10, mult: 3 }, enabled: false },
  { id: 'vortex',  name: 'Vortex 14', category: 'Trend', pane: 'sub', type: 'multi',       color: '#1b5e20', params: { period: 14 }, enabled: false },
  { id: 'ichimoku', name: 'Ichimoku', category: 'Trend', pane: 'price', type: 'ichimoku',  color: '#37474f', params: { tenkan: 9, kijun: 26, senkou: 52 }, enabled: false },

  // ─── Volume ─────────────────────────────────────────
  { id: 'volume',  name: 'Volume',   category: 'Volume', pane: 'sub', type: 'histogram',   color: '#26a69a', params: {}, enabled: true },
  { id: 'obv',     name: 'OBV',      category: 'Volume', pane: 'sub', type: 'line',        color: '#00897b', params: {}, enabled: false },
  { id: 'cmf',     name: 'CMF 20',   category: 'Volume', pane: 'sub', type: 'line',        color: '#00acc1', params: { period: 20 }, enabled: false },
  { id: 'mfi',     name: 'MFI 14',   category: 'Volume', pane: 'sub', type: 'line',        color: '#039be5', params: { period: 14 }, enabled: false },
  { id: 'adl',     name: 'ADL',      category: 'Volume', pane: 'sub', type: 'line',        color: '#1e88e5', params: {}, enabled: false },
  { id: 'efi',     name: 'Elder Force Index', category: 'Volume', pane: 'sub', type: 'histogram', color: '#3949ab', params: { period: 13 }, enabled: false },
  { id: 'vwma_vol', name: 'VWMA 20', category: 'Volume', pane: 'price', type: 'line',      color: '#00b0ff', params: { period: 20 }, enabled: false },

  // ─── Advanced ───────────────────────────────────────
  { id: 'dpo',     name: 'DPO 20',   category: 'Advanced', pane: 'sub', type: 'line',      color: '#d500f9', params: { period: 20 }, enabled: false },
  { id: 'ppo',     name: 'PPO',      category: 'Advanced', pane: 'sub', type: 'multi',     color: '#aa00ff', params: { fast: 12, slow: 26, signal: 9 }, enabled: false },
  { id: 'trix',    name: 'TRIX 15',  category: 'Advanced', pane: 'sub', type: 'line',      color: '#6200ea', params: { period: 15 }, enabled: false },
  { id: 'massindex', name: 'Mass Index', category: 'Advanced', pane: 'sub', type: 'line',  color: '#304ffe', params: {}, enabled: false },
  { id: 'coppock', name: 'Coppock Curve', category: 'Advanced', pane: 'sub', type: 'line', color: '#00b0ff', params: {}, enabled: false },
  { id: 'kst',     name: 'KST',      category: 'Advanced', pane: 'sub', type: 'line',      color: '#00e5ff', params: {}, enabled: false },
  { id: 'elderray', name: 'Elder Ray', category: 'Advanced', pane: 'sub', type: 'multi',   color: '#1de9b6', params: { period: 13 }, enabled: false },
];

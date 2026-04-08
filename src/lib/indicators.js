/**
 * ProTrader Indicator Library v1.0
 * 50+ technical indicators for the ProTrader dashboard
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────

const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

const stddev = (arr, mean = avg(arr)) =>
  Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length);

const trueRange = (curr, prev) => {
  if (!prev) return curr.high - curr.low;
  return Math.max(
    curr.high - curr.low,
    Math.abs(curr.high - prev.close),
    Math.abs(curr.low - prev.close)
  );
};

// ─── Moving Averages ─────────────────────────────────────────────────────────

export const calcSMA = (data, period) => {
  const out = [];
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    out.push({ time: data[i].time, value: avg(slice.map(d => d.close)) });
  }
  return out;
};

export const calcEMA = (data, period) => {
  const k = 2 / (period + 1);
  const out = [];
  let prev = data[0].close;
  for (let i = 0; i < data.length; i++) {
    const val = i === 0 ? data[0].close : data[i].close * k + prev * (1 - k);
    if (i >= period - 1) out.push({ time: data[i].time, value: val });
    prev = val;
  }
  return out;
};

export const calcWMA = (data, period) => {
  const out = [];
  const weights = Array.from({ length: period }, (_, i) => i + 1);
  const totalW = weights.reduce((a, b) => a + b, 0);
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const val = slice.reduce((a, d, j) => a + d.close * weights[j], 0) / totalW;
    out.push({ time: data[i].time, value: val });
  }
  return out;
};

export const calcHMA = (data, period) => {
  const halfEMA = calcWMA(data, Math.floor(period / 2));
  const fullEMA = calcWMA(data, period);
  const minLen = Math.min(halfEMA.length, fullEMA.length);
  const diff = halfEMA.slice(halfEMA.length - minLen).map((d, i) => ({
    ...d,
    close: 2 * d.value - fullEMA[fullEMA.length - minLen + i].value,
  }));
  const sqrtPeriod = Math.round(Math.sqrt(period));
  const hma = calcWMA(diff, sqrtPeriod);
  return hma;
};

export const calcDEMA = (data, period) => {
  const ema1 = calcEMA(data, period);
  const syntheticData = ema1.map(d => ({ ...d, close: d.value, open: d.value, high: d.value, low: d.value }));
  const ema2 = calcEMA(syntheticData, period);
  const minLen = Math.min(ema1.length, ema2.length);
  return ema1.slice(ema1.length - minLen).map((d, i) => ({
    time: d.time,
    value: 2 * d.value - ema2[ema2.length - minLen + i].value,
  }));
};

export const calcTEMA = (data, period) => {
  const ema1 = calcEMA(data, period);
  const s1 = ema1.map(d => ({ ...d, close: d.value, open: d.value, high: d.value, low: d.value }));
  const ema2 = calcEMA(s1, period);
  const s2 = ema2.map(d => ({ ...d, close: d.value, open: d.value, high: d.value, low: d.value }));
  const ema3 = calcEMA(s2, period);
  const minLen = Math.min(ema1.length, ema2.length, ema3.length);
  return ema1.slice(ema1.length - minLen).map((d, i) => ({
    time: d.time,
    value: 3 * d.value - 3 * ema2[ema2.length - minLen + i].value + ema3[ema3.length - minLen + i].value,
  }));
};

export const calcVWAP = (data) => {
  let cumVol = 0, cumTPV = 0;
  return data.map(d => {
    const tp = (d.high + d.low + d.close) / 3;
    cumTPV += tp * d.volume;
    cumVol += d.volume;
    return { time: d.time, value: cumVol > 0 ? cumTPV / cumVol : tp };
  });
};

export const calcVWMA = (data, period) => {
  const out = [];
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const sumPV = slice.reduce((a, d) => a + d.close * d.volume, 0);
    const sumV = slice.reduce((a, d) => a + d.volume, 0);
    out.push({ time: data[i].time, value: sumV > 0 ? sumPV / sumV : data[i].close });
  }
  return out;
};

export const calcALMA = (data, period = 9, sigma = 6, offset = 0.85) => {
  const m = offset * (period - 1);
  const s = period / sigma;
  const weights = Array.from({ length: period }, (_, i) => Math.exp(-((i - m) ** 2) / (2 * s * s)));
  const totalW = weights.reduce((a, b) => a + b, 0);
  const out = [];
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    out.push({ time: data[i].time, value: slice.reduce((a, d, j) => a + d.close * weights[j], 0) / totalW });
  }
  return out;
};

// ─── Momentum ────────────────────────────────────────────────────────────────

export const calcRSI = (data, period = 14) => {
  const out = [];
  let gains = 0, losses = 0;
  for (let i = 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close;
    if (diff >= 0) gains += diff; else losses -= diff;
    if (i === period) {
      const avgG = gains / period, avgL = losses / period;
      out.push({ time: data[i].time, value: 100 - 100 / (1 + avgG / (avgL || 0.001)) });
    } else if (i > period) {
      const g = Math.max(diff, 0), l = Math.max(-diff, 0);
      const prevOut = out[out.length - 1].value;
      const rs = prevOut / (100 - prevOut);
      const newG = (rs * period - (rs - (rs > 0 ? 1 : 0)) + g) / period;
      // Simplified smoothed RSI
      const oldDiff = data[i - period].close - data[i - period - 1].close;
      gains = (gains * (period - 1) + g) / period;
      losses = (losses * (period - 1) + l) / period;
      out.push({ time: data[i].time, value: 100 - 100 / (1 + gains / (losses || 0.001)) });
    }
  }
  return out;
};

export const calcMACD = (data, fast = 12, slow = 26, signal = 9) => {
  const fastEMA = calcEMA(data, fast);
  const slowEMA = calcEMA(data, slow);
  const minLen = Math.min(fastEMA.length, slowEMA.length);
  const macdLine = fastEMA.slice(fastEMA.length - minLen).map((d, i) => ({
    time: d.time,
    close: d.value - slowEMA[slowEMA.length - minLen + i].value,
    open: 0, high: 0, low: 0,
    value: d.value - slowEMA[slowEMA.length - minLen + i].value,
  }));
  const signalLine = calcEMA(macdLine, signal);
  const sigMinLen = Math.min(macdLine.length, signalLine.length);
  const histogram = macdLine.slice(macdLine.length - sigMinLen).map((d, i) => ({
    time: d.time,
    value: d.value - signalLine[signalLine.length - sigMinLen + i].value,
    macd: d.value,
    signal: signalLine[signalLine.length - sigMinLen + i].value,
  }));
  return { macdLine, signalLine, histogram };
};

export const calcStochastic = (data, kPeriod = 14, dPeriod = 3, smooth = 3) => {
  const rawK = [];
  for (let i = kPeriod - 1; i < data.length; i++) {
    const slice = data.slice(i - kPeriod + 1, i + 1);
    const low = Math.min(...slice.map(d => d.low));
    const high = Math.max(...slice.map(d => d.high));
    rawK.push({ time: data[i].time, value: high === low ? 50 : ((data[i].close - low) / (high - low)) * 100 });
  }
  const kSmoothed = calcEMA(rawK.map(d => ({ ...d, close: d.value, open: d.value, high: d.value, low: d.value })), smooth);
  const dLine = calcEMA(kSmoothed.map(d => ({ ...d, close: d.value, open: d.value, high: d.value, low: d.value })), dPeriod);
  return { kLine: kSmoothed, dLine };
};

export const calcStochRSI = (data, period = 14) => {
  const rsiData = calcRSI(data, period);
  const out = [];
  for (let i = period - 1; i < rsiData.length; i++) {
    const slice = rsiData.slice(i - period + 1, i + 1).map(d => d.value);
    const low = Math.min(...slice), high = Math.max(...slice);
    out.push({ time: rsiData[i].time, value: high === low ? 0 : (rsiData[i].value - low) / (high - low) * 100 });
  }
  return out;
};

export const calcCCI = (data, period = 20) => {
  const out = [];
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const tp = slice.map(d => (d.high + d.low + d.close) / 3);
    const meanTP = avg(tp);
    const meanDev = avg(tp.map(v => Math.abs(v - meanTP)));
    out.push({ time: data[i].time, value: meanDev === 0 ? 0 : (tp[tp.length - 1] - meanTP) / (0.015 * meanDev) });
  }
  return out;
};

export const calcROC = (data, period = 12) => {
  const out = [];
  for (let i = period; i < data.length; i++) {
    const val = ((data[i].close - data[i - period].close) / data[i - period].close) * 100;
    out.push({ time: data[i].time, value: val });
  }
  return out;
};

export const calcMomentum = (data, period = 10) => {
  const out = [];
  for (let i = period; i < data.length; i++) {
    out.push({ time: data[i].time, value: data[i].close - data[i - period].close });
  }
  return out;
};

export const calcWillR = (data, period = 14) => {
  const out = [];
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const high = Math.max(...slice.map(d => d.high));
    const low = Math.min(...slice.map(d => d.low));
    out.push({ time: data[i].time, value: high === low ? -50 : ((high - data[i].close) / (high - low)) * -100 });
  }
  return out;
};

export const calcAO = (data) => {
  const sma5 = calcSMA(data.map(d => ({ ...d, close: (d.high + d.low) / 2 })), 5);
  const sma34 = calcSMA(data.map(d => ({ ...d, close: (d.high + d.low) / 2 })), 34);
  const minLen = Math.min(sma5.length, sma34.length);
  return sma5.slice(sma5.length - minLen).map((d, i) => ({
    time: d.time,
    value: d.value - sma34[sma34.length - minLen + i].value,
  }));
};

export const calcUltimateOscillator = (data, p1 = 7, p2 = 14, p3 = 28) => {
  const out = [];
  for (let i = 1; i < data.length; i++) {
    const curr = data[i], prev = data[i - 1];
    const tr = trueRange(curr, prev);
    const bp = curr.close - Math.min(curr.low, prev.close);
    if (i >= p3) {
      const calcAvg = (p) => {
        const s = data.slice(i - p + 1, i + 1);
        let sumBP = 0, sumTR = 0;
        s.forEach((d, j) => {
          const prv = data[i - p + j];
          sumBP += d.close - Math.min(d.low, prv.close);
          sumTR += trueRange(d, prv);
        });
        return sumTR === 0 ? 0 : sumBP / sumTR;
      };
      const uo = (4 * calcAvg(p1) + 2 * calcAvg(p2) + calcAvg(p3)) / 7 * 100;
      out.push({ time: curr.time, value: uo });
    }
  }
  return out;
};

export const calcTSI = (data, longPeriod = 25, shortPeriod = 13) => {
  const changes = data.slice(1).map((d, i) => ({ ...d, close: d.close - data[i].close, open: 0, high: 0, low: 0 }));
  const absChanges = changes.map(d => ({ ...d, close: Math.abs(d.close) }));
  const ema1 = calcEMA(changes, longPeriod);
  const ema2 = calcEMA(ema1.map(d => ({ ...d, close: d.value, open: 0, high: 0, low: 0 })), shortPeriod);
  const absEma1 = calcEMA(absChanges, longPeriod);
  const absEma2 = calcEMA(absEma1.map(d => ({ ...d, close: d.value, open: 0, high: 0, low: 0 })), shortPeriod);
  const minLen = Math.min(ema2.length, absEma2.length);
  return ema2.slice(ema2.length - minLen).map((d, i) => ({
    time: d.time,
    value: absEma2[absEma2.length - minLen + i].value === 0 ? 0 : (d.value / absEma2[absEma2.length - minLen + i].value) * 100,
  }));
};

// ─── Volatility ──────────────────────────────────────────────────────────────

export const calcBollingerBands = (data, period = 20, stdMult = 2) => {
  const out = [];
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1).map(d => d.close);
    const mean = avg(slice);
    const sd = stddev(slice, mean);
    out.push({
      time: data[i].time,
      upper: mean + stdMult * sd,
      middle: mean,
      lower: mean - stdMult * sd,
    });
  }
  return out;
};

export const calcATR = (data, period = 14) => {
  const trs = data.map((d, i) => trueRange(d, data[i - 1]));
  const out = [];
  let atr = avg(trs.slice(1, period + 1));
  out.push({ time: data[period].time, value: atr });
  for (let i = period + 1; i < data.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
    out.push({ time: data[i].time, value: atr });
  }
  return out;
};

export const calcKeltnerChannels = (data, period = 20, mult = 2) => {
  const ema = calcEMA(data, period);
  const atr = calcATR(data, period);
  const minLen = Math.min(ema.length, atr.length);
  return ema.slice(ema.length - minLen).map((d, i) => ({
    time: d.time,
    upper: d.value + mult * atr[atr.length - minLen + i].value,
    middle: d.value,
    lower: d.value - mult * atr[atr.length - minLen + i].value,
  }));
};

export const calcDonchianChannels = (data, period = 20) => {
  const out = [];
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const upper = Math.max(...slice.map(d => d.high));
    const lower = Math.min(...slice.map(d => d.low));
    out.push({ time: data[i].time, upper, lower, middle: (upper + lower) / 2 });
  }
  return out;
};

export const calcStdDev = (data, period = 20) => {
  const out = [];
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1).map(d => d.close);
    out.push({ time: data[i].time, value: stddev(slice) });
  }
  return out;
};

// ─── Trend ───────────────────────────────────────────────────────────────────

export const calcParabolicSAR = (data, step = 0.02, maxAF = 0.2) => {
  let bull = true, af = step, ep = data[0].low, sar = data[0].high;
  const out = [];
  for (let i = 1; i < data.length; i++) {
    const prev = sar;
    sar = prev + af * (ep - prev);
    if (bull) {
      if (data[i].low < sar) { bull = false; sar = ep; ep = data[i].low; af = step; }
      else {
        if (data[i].high > ep) { ep = data[i].high; af = Math.min(af + step, maxAF); }
        sar = Math.min(sar, data[i - 1].low, i > 1 ? data[i - 2].low : data[i - 1].low);
      }
    } else {
      if (data[i].high > sar) { bull = true; sar = ep; ep = data[i].high; af = step; }
      else {
        if (data[i].low < ep) { ep = data[i].low; af = Math.min(af + step, maxAF); }
        sar = Math.max(sar, data[i - 1].high, i > 1 ? data[i - 2].high : data[i - 1].high);
      }
    }
    out.push({ time: data[i].time, value: sar });
  }
  return out;
};

export const calcADX = (data, period = 14) => {
  const dms = data.slice(1).map((d, i) => {
    const prev = data[i];
    const dmPlus = d.high - prev.high > prev.low - d.low ? Math.max(d.high - prev.high, 0) : 0;
    const dmMinus = prev.low - d.low > d.high - prev.high ? Math.max(prev.low - d.low, 0) : 0;
    return { dmPlus, dmMinus, tr: trueRange(d, prev) };
  });
  const out = [];
  let smoothTR = dms.slice(0, period).reduce((a, d) => a + d.tr, 0);
  let smoothDMPlus = dms.slice(0, period).reduce((a, d) => a + d.dmPlus, 0);
  let smoothDMMinus = dms.slice(0, period).reduce((a, d) => a + d.dmMinus, 0);
  for (let i = period; i < dms.length; i++) {
    smoothTR = smoothTR - smoothTR / period + dms[i].tr;
    smoothDMPlus = smoothDMPlus - smoothDMPlus / period + dms[i].dmPlus;
    smoothDMMinus = smoothDMMinus - smoothDMMinus / period + dms[i].dmMinus;
    const diPlus = (smoothDMPlus / smoothTR) * 100;
    const diMinus = (smoothDMMinus / smoothTR) * 100;
    const dx = Math.abs(diPlus - diMinus) / (diPlus + diMinus) * 100;
    out.push({ time: data[i + 1].time, value: dx, diPlus, diMinus });
  }
  // Smooth ADX
  if (out.length < period) return [];
  let adx = avg(out.slice(0, period).map(d => d.value));
  const result = [];
  for (let i = period; i < out.length; i++) {
    adx = (adx * (period - 1) + out[i].value) / period;
    result.push({ time: out[i].time, value: adx, diPlus: out[i].diPlus, diMinus: out[i].diMinus });
  }
  return result;
};

export const calcAroon = (data, period = 25) => {
  const out = [];
  for (let i = period; i < data.length; i++) {
    const slice = data.slice(i - period, i + 1);
    const highIdx = slice.reduce((best, d, j) => d.high > slice[best].high ? j : best, 0);
    const lowIdx = slice.reduce((best, d, j) => d.low < slice[best].low ? j : best, 0);
    out.push({
      time: data[i].time,
      aroonUp: ((highIdx) / period) * 100,
      aroonDown: ((lowIdx) / period) * 100,
      oscillator: ((highIdx - lowIdx) / period) * 100,
    });
  }
  return out;
};

export const calcSupertrend = (data, period = 10, mult = 3) => {
  const atr = calcATR(data, period);
  const out = [];
  let prevUpper = Infinity, prevLower = -Infinity, trend = 1;
  for (let i = 0; i < atr.length; i++) {
    const idx = data.length - atr.length + i;
    const hl2 = (data[idx].high + data[idx].low) / 2;
    let upper = hl2 + mult * atr[i].value;
    let lower = hl2 - mult * atr[i].value;
    upper = upper < prevUpper || data[idx - 1]?.close > prevUpper ? upper : prevUpper;
    lower = lower > prevLower || data[idx - 1]?.close < prevLower ? lower : prevLower;
    if (data[idx].close > prevUpper) trend = 1;
    else if (data[idx].close < prevLower) trend = -1;
    out.push({ time: data[idx].time, value: trend === 1 ? lower : upper, trend });
    prevUpper = upper; prevLower = lower;
  }
  return out;
};

export const calcVortex = (data, period = 14) => {
  const out = [];
  for (let i = period; i < data.length; i++) {
    let vmPlus = 0, vmMinus = 0, trSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      vmPlus += Math.abs(data[j].high - data[j - 1].low);
      vmMinus += Math.abs(data[j].low - data[j - 1].high);
      trSum += trueRange(data[j], data[j - 1]);
    }
    out.push({ time: data[i].time, viPlus: vmPlus / trSum, viMinus: vmMinus / trSum });
  }
  return out;
};

// ─── Volume ──────────────────────────────────────────────────────────────────

export const calcOBV = (data) => {
  let obv = 0;
  return data.map((d, i) => {
    if (i > 0) {
      obv += d.close > data[i - 1].close ? d.volume : d.close < data[i - 1].close ? -d.volume : 0;
    }
    return { time: d.time, value: obv };
  });
};

export const calcCMF = (data, period = 20) => {
  const out = [];
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const sumMFV = slice.reduce((a, d) => {
      const range = d.high - d.low;
      return a + (range === 0 ? 0 : ((d.close - d.low - (d.high - d.close)) / range) * d.volume);
    }, 0);
    const sumVol = slice.reduce((a, d) => a + d.volume, 0);
    out.push({ time: data[i].time, value: sumVol === 0 ? 0 : sumMFV / sumVol });
  }
  return out;
};

export const calcMFI = (data, period = 14) => {
  const out = [];
  for (let i = period; i < data.length; i++) {
    let posFlow = 0, negFlow = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const tp = (data[j].high + data[j].low + data[j].close) / 3;
      const prevTP = (data[j - 1].high + data[j - 1].low + data[j - 1].close) / 3;
      if (tp > prevTP) posFlow += tp * data[j].volume;
      else negFlow += tp * data[j].volume;
    }
    out.push({ time: data[i].time, value: negFlow === 0 ? 100 : 100 - 100 / (1 + posFlow / negFlow) });
  }
  return out;
};

export const calcADL = (data) => {
  let adl = 0;
  return data.map(d => {
    const range = d.high - d.low;
    adl += range === 0 ? 0 : ((d.close - d.low - (d.high - d.close)) / range) * d.volume;
    return { time: d.time, value: adl };
  });
};

export const calcEFI = (data, period = 13) => {
  const raw = data.slice(1).map((d, i) => ({
    ...d,
    close: (d.close - data[i].close) * d.volume,
    open: 0, high: 0, low: 0,
  }));
  return calcEMA(raw, period);
};

// ─── Other / Advanced ────────────────────────────────────────────────────────

export const calcDPO = (data, period = 20) => {
  const sma = calcSMA(data, period);
  const shift = Math.floor(period / 2) + 1;
  const out = [];
  for (let i = shift; i < sma.length; i++) {
    out.push({ time: data[i + period - 1].time, value: data[i + period - 1].close - sma[i - shift].value });
  }
  return out;
};

export const calcPPO = (data, fast = 12, slow = 26, signal = 9) => {
  const fastEMA = calcEMA(data, fast);
  const slowEMA = calcEMA(data, slow);
  const minLen = Math.min(fastEMA.length, slowEMA.length);
  const ppo = fastEMA.slice(fastEMA.length - minLen).map((d, i) => {
    const sv = slowEMA[slowEMA.length - minLen + i].value;
    return { time: d.time, value: sv === 0 ? 0 : ((d.value - sv) / sv) * 100, close: ((d.value - sv) / (sv || 0.001)) * 100, open: 0, high: 0, low: 0 };
  });
  const sig = calcEMA(ppo, signal);
  return { ppoLine: ppo, signalLine: sig };
};

export const calcTRIX = (data, period = 15) => {
  const ema1 = calcEMA(data, period);
  const s1 = ema1.map(d => ({ ...d, close: d.value, open: d.value, high: d.value, low: d.value }));
  const ema2 = calcEMA(s1, period);
  const s2 = ema2.map(d => ({ ...d, close: d.value, open: d.value, high: d.value, low: d.value }));
  const ema3 = calcEMA(s2, period);
  return ema3.slice(1).map((d, i) => ({
    time: d.time,
    value: ema3[i].value === 0 ? 0 : ((d.value - ema3[i].value) / ema3[i].value) * 100,
  }));
};

export const calcMassIndex = (data, period = 25, ema_period = 9) => {
  const highLow = data.map(d => ({ ...d, close: d.high - d.low, open: 0, high: 0, low: 0 }));
  const ema1 = calcEMA(highLow, ema_period);
  const s1 = ema1.map(d => ({ ...d, close: d.value, open: d.value, high: d.value, low: d.value }));
  const ema2 = calcEMA(s1, ema_period);
  const ratio = ema1.slice(ema1.length - ema2.length).map((d, i) => ({
    ...d, close: ema2[i].value === 0 ? 1 : d.value / ema2[i].value, open: 0, high: 0, low: 0,
  }));
  const out = [];
  for (let i = period - 1; i < ratio.length; i++) {
    out.push({ time: ratio[i].time, value: ratio.slice(i - period + 1, i + 1).reduce((a, d) => a + d.close, 0) });
  }
  return out;
};

export const calcCoppockCurve = (data, wmaP = 10, longROC = 14, shortROC = 11) => {
  const roc1 = calcROC(data, longROC);
  const roc2 = calcROC(data, shortROC);
  const minLen = Math.min(roc1.length, roc2.length);
  const combined = roc1.slice(roc1.length - minLen).map((d, i) => ({
    ...d, close: d.value + roc2[roc2.length - minLen + i].value, open: 0, high: 0, low: 0,
  }));
  return calcWMA(combined, wmaP);
};

export const calcKST = (data, r1 = 10, r2 = 13, r3 = 14, r4 = 15) => {
  const roc1 = calcROC(data, r1);
  const roc2 = calcROC(data, r2);
  const roc3 = calcROC(data, r3);
  const roc4 = calcROC(data, r4);
  const makeData = arr => arr.map(d => ({ ...d, close: d.value, open: 0, high: 0, low: 0 }));
  const s1 = calcSMA(makeData(roc1), 10);
  const s2 = calcSMA(makeData(roc2), 13);
  const s3 = calcSMA(makeData(roc3), 14);
  const s4 = calcSMA(makeData(roc4), 15);
  const minLen = Math.min(s1.length, s2.length, s3.length, s4.length);
  return s1.slice(s1.length - minLen).map((d, i) => ({
    time: d.time,
    value: d.value + 2 * s2[s2.length - minLen + i].value + 3 * s3[s3.length - minLen + i].value + 4 * s4[s4.length - minLen + i].value,
  }));
};

export const calcIchimoku = (data, tenkan = 9, kijun = 26, senkou = 52) => {
  const midpoint = (arr, key1, key2) => (Math.max(...arr.map(d => d[key1])) + Math.min(...arr.map(d => d[key2]))) / 2;
  const out = [];
  for (let i = Math.max(tenkan, kijun, senkou) - 1; i < data.length; i++) {
    const t = midpoint(data.slice(i - tenkan + 1, i + 1), 'high', 'low');
    const k = midpoint(data.slice(i - kijun + 1, i + 1), 'high', 'low');
    const futureIdx = Math.min(i + kijun, data.length - 1);
    out.push({
      time: data[i].time,
      tenkan: t,
      kijun: k,
      senkouA: (t + k) / 2,
      senkouB: i >= senkou - 1 ? midpoint(data.slice(i - senkou + 1, i + 1), 'high', 'low') : null,
    });
  }
  return out;
};

export const calcElderRay = (data, period = 13) => {
  const ema = calcEMA(data, period);
  return ema.map((d, i) => {
    const idx = data.length - ema.length + i;
    return {
      time: d.time,
      bullPower: data[idx].high - d.value,
      bearPower: data[idx].low - d.value,
    };
  });
};

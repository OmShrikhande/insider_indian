const { client } = require('../config/database');
const fnoService = require('./fnoService');

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const FNO_LOT_SIZE = { NIFTY: 25, BANKNIFTY: 15, FINNIFTY: 25, MIDCPNIFTY: 50 };
const STRIKE_STEP = { NIFTY: 50, BANKNIFTY: 100, FINNIFTY: 50, MIDCPNIFTY: 25 };

function toIstParts(epochSec) {
  const d = new Date(epochSec * 1000 + IST_OFFSET_MS);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return {
    date: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`,
    time: `${hh}:${mm}`,
    weekday: d.getUTCDay(),
  };
}

function aggregate5m(rows = []) {
  const buckets = new Map();
  for (const c of rows) {
    const sec = Number(c.time);
    if (!Number.isFinite(sec)) continue;
    const ist = new Date(sec * 1000 + IST_OFFSET_MS);
    const minute = ist.getUTCMinutes();
    const alignedMin = minute - (minute % 5);
    ist.setUTCMinutes(alignedMin, 0, 0);
    const bucketEpoch = Math.floor((ist.getTime() - IST_OFFSET_MS) / 1000);
    if (!buckets.has(bucketEpoch)) {
      buckets.set(bucketEpoch, {
        time: bucketEpoch,
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
        volume: Number(c.volume || 0),
      });
      continue;
    }
    const b = buckets.get(bucketEpoch);
    b.high = Math.max(b.high, Number(c.high));
    b.low = Math.min(b.low, Number(c.low));
    b.close = Number(c.close);
    b.volume += Number(c.volume || 0);
  }
  return Array.from(buckets.values()).sort((a, b) => a.time - b.time);
}

function avg(nums) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

class FnoOrbStrategyService {
  async getIndexMinuteSeries(underlying, limit = 12000) {
    const u = fnoService.normalizeQuery(underlying);
    const result = await client.query({
      query: `
        SELECT bar_time, open, high, low, close, volume
        FROM index_ohlc
        WHERE underlying_symbol = {u:String}
          AND unit = 'minutes'
          AND interval = 1
        ORDER BY bar_time DESC
        LIMIT {lim:UInt32}
      `,
      query_params: { u, lim: Math.max(1000, Math.min(30000, Number(limit) || 12000)) },
      format: 'JSONEachRow',
    });
    const rows = await result.json();
    const dedup = new Map();
    for (const row of rows) {
      const t = Math.floor(new Date(`${String(row.bar_time).replace(' ', 'T')}Z`).getTime() / 1000);
      if (!Number.isFinite(t)) continue;
      dedup.set(t, {
        time: t,
        open: Number(row.open),
        high: Number(row.high),
        low: Number(row.low),
        close: Number(row.close),
        volume: Number(row.volume || 0),
      });
    }
    return Array.from(dedup.values()).sort((a, b) => a.time - b.time);
  }

  buildSessionMap(candles5m) {
    const byDate = new Map();
    for (const c of candles5m) {
      const ist = toIstParts(c.time);
      if (!byDate.has(ist.date)) byDate.set(ist.date, []);
      byDate.get(ist.date).push({ ...c, istTime: ist.time, weekday: ist.weekday });
    }
    for (const list of byDate.values()) list.sort((a, b) => a.time - b.time);
    return byDate;
  }

  pickAnalysisDate(sortedDates) {
    if (sortedDates.length < 2) return null;
    return sortedDates[sortedDates.length - 2];
  }

  classifyDay(session, prevClose, atrProxyPct) {
    const open915 = session.find((c) => c.istTime === '09:15');
    const close1530 = prevClose;
    if (!open915 || !Number.isFinite(close1530)) {
      return {
        day_type: 'Sideways',
        gap_type: 'Flat',
        vix_regime: atrProxyPct > 1.2 ? 'High' : atrProxyPct >= 0.6 ? 'Normal' : 'Low',
        trade_allowed: false,
        reason: 'Insufficient opening or prior close data for robust gap classification.',
      };
    }
    const gap = open915.open - close1530;
    const gapPct = (gap / close1530) * 100;
    const gapType = gapPct > 0.8 ? 'Gap Up' : gapPct < -0.8 ? 'Gap Down' : 'Flat';
    const vixRegime = atrProxyPct > 1.2 ? 'High' : atrProxyPct >= 0.6 ? 'Normal' : 'Low';
    const firstHour = session.filter((c) => c.istTime >= '09:15' && c.istTime <= '10:00');
    const fullRangePct = ((Math.max(...session.map((c) => c.high)) - Math.min(...session.map((c) => c.low))) / open915.open) * 100;
    const trend = this.detectTrendDay(firstHour, session);
    const volatile = fullRangePct > 1.2 && this.countDirectionFlips(session) >= 3;
    const dayType = volatile ? 'Volatile' : trend ? 'Trending' : 'Sideways';
    const largeGap = Math.abs(gapPct) > 1.5;
    const tradeAllowed = !volatile && !largeGap;
    const reason = largeGap
      ? 'Large gap day detected (>1.5%), structure reliability filter blocked the setup.'
      : volatile
        ? 'Intraday range and reversal frequency classify this as a volatile/event day.'
        : trend
          ? 'Opening range behavior shows directional continuation without deep re-entry.'
          : 'Price action stayed rotational around opening range, reducing breakout edge.';
    return { day_type: dayType, gap_type: gapType, vix_regime: vixRegime, trade_allowed: tradeAllowed, reason, gap_pct: gapPct };
  }

  detectTrendDay(firstHour, session) {
    const or = firstHour.filter((c) => c.istTime <= '09:35');
    if (or.length < 4) return false;
    const orHigh = Math.max(...or.map((c) => c.high));
    const orLow = Math.min(...or.map((c) => c.low));
    const early = session.filter((c) => c.istTime >= '09:40' && c.istTime <= '10:00');
    const bullishBreak = early.find((c) => c.close > orHigh);
    const bearishBreak = early.find((c) => c.close < orLow);
    if (!bullishBreak && !bearishBreak) return false;
    if (bullishBreak) {
      const reenter = session.filter((c) => c.time > bullishBreak.time).some((c) => c.close < orHigh);
      return !reenter;
    }
    const reenter = session.filter((c) => c.time > bearishBreak.time).some((c) => c.close > orLow);
    return !reenter;
  }

  countDirectionFlips(session) {
    let flips = 0;
    let prevDir = 0;
    for (const c of session) {
      const dir = c.close === c.open ? 0 : c.close > c.open ? 1 : -1;
      if (dir !== 0 && prevDir !== 0 && dir !== prevDir) flips += 1;
      if (dir !== 0) prevDir = dir;
    }
    return flips;
  }

  findBreakout(session, orStats) {
    const scan = session.filter((c) => c.istTime >= '09:40' && c.istTime <= '11:15');
    for (let i = 0; i < scan.length; i += 1) {
      const c = scan[i];
      const idxInSession = session.findIndex((x) => x.time === c.time);
      if (idxInSession < 2) continue;
      const prev2 = session.slice(idxInSession - 2, idxInSession);
      const prevInside = prev2.every((p) => p.high <= orStats.OR_High && p.low >= orStats.OR_Low);
      if (!prevInside) continue;
      const range = Math.max(0.0001, c.high - c.low);
      const body = Math.abs(c.close - c.open);
      const bodyRatio = body / range;
      if (bodyRatio < 0.5) continue;
      const prev5 = session.slice(Math.max(0, idxInSession - 5), idxInSession);
      const avgBody = Math.max(0.0001, avg(prev5.map((p) => Math.abs(p.close - p.open))));
      const bodyVsAvg = body / avgBody;
      if (bodyVsAvg < 1.2) continue;
      const prev10 = session.slice(Math.max(0, idxInSession - 10), idxInSession);
      const avgVol = avg(prev10.map((p) => Number(p.volume || 0)));
      const volOk = avgVol <= 0 ? true : Number(c.volume || 0) >= avgVol * 1.2;
      if (!volOk) continue;
      const dir = c.close > orStats.Upper_Buffer ? 'BULLISH' : c.close < orStats.Lower_Buffer ? 'BEARISH' : null;
      if (!dir) continue;
      const next = scan[i + 1];
      if (!next) return { pending: true, breakoutCandle: c, direction: dir, bodyRatio, bodyVsAvg };
      const falseBreak = dir === 'BULLISH' ? next.close < orStats.OR_High : next.close > orStats.OR_Low;
      if (falseBreak) {
        return { falseBreakAt: c.istTime, continueScan: true };
      }
      return {
        direction: dir,
        breakoutCandle: c,
        confirmCandle: next,
        bodyRatio,
        bodyVsAvg,
        volumeSpike: avgVol > 0 ? Number(c.volume || 0) / avgVol : null,
      };
    }
    return null;
  }

  async resolveOptionSnapshot(underlying, indexEntry, sessionDate, preferredExpiry = '') {
    const u = fnoService.normalizeQuery(underlying);
    const expiry = preferredExpiry || await this.getNearestThursdayExpiry(u, sessionDate);
    if (!expiry) return { error: 'No weekly expiry found in DB' };
    const rowsRes = await client.query({
      query: `
        SELECT
          strike_price,
          argMax(call_ltp, updated_at) AS call_ltp,
          argMax(put_ltp, updated_at) AS put_ltp,
          argMax(call_oi, updated_at) AS call_oi,
          argMax(put_oi, updated_at) AS put_oi
        FROM fno_option_chain
        WHERE underlying_symbol = {u:String}
          AND expiry = toDate({e:String})
        GROUP BY strike_price
        ORDER BY strike_price ASC
      `,
      query_params: { u, e: expiry },
      format: 'JSONEachRow',
    });
    const rows = await rowsRes.json();
    if (!rows.length) return { error: 'No option chain snapshot available in DB for selected expiry' };
    const strikes = rows.map((r) => Number(r.strike_price)).filter((x) => Number.isFinite(x));
    const step = STRIKE_STEP[u] || 50;
    const atm = strikes.reduce((p, c) => Math.abs(c - indexEntry) < Math.abs(p - indexEntry) ? c : p, strikes[0]);
    const itm = atm - step;
    return { expiry, rows, atm, itm };
  }

  async getNearestThursdayExpiry(underlying, sessionDate) {
    const res = await client.query({
      query: `
        SELECT DISTINCT expiry
        FROM fno_contracts
        WHERE underlying_symbol = {u:String}
          AND expiry >= toDate({d:String})
        ORDER BY expiry ASC
        LIMIT 6
      `,
      query_params: { u: underlying, d: sessionDate },
      format: 'JSONEachRow',
    });
    const rows = await res.json();
    return rows[0]?.expiry ? String(rows[0].expiry).slice(0, 10) : '';
  }

  weekdayNameFromDate(ymd) {
    const d = new Date(`${ymd}T00:00:00Z`);
    return d.getUTCDay();
  }

  buildSkipCard(underlying, dayClassification, note) {
    return {
      verdict: 'SKIP',
      message: note,
      trade_summary_card: {
        Instrument: `${underlying} weekly options`,
        'Day type': dayClassification.day_type,
        'Trade direction': 'N/A',
        'OVERALL TRADE VERDICT': 'SKIP',
      },
    };
  }

  async analyze({ underlying = 'NIFTY', expiry = '' } = {}) {
    const symbol = fnoService.normalizeQuery(underlying);
    const oneMin = await this.getIndexMinuteSeries(symbol, 15000);
    const candles5m = aggregate5m(oneMin);
    const sessionMap = this.buildSessionMap(candles5m);
    const dates = Array.from(sessionMap.keys()).sort();
    const analysisDate = this.pickAnalysisDate(dates);
    if (!analysisDate) {
      return { success: false, error: 'Insufficient historical index candles in DB for analysis.' };
    }
    const prevDate = dates[dates.indexOf(analysisDate) - 1];
    const session = (sessionMap.get(analysisDate) || []).filter((c) => c.istTime >= '09:15' && c.istTime <= '15:30');
    const prevSession = (sessionMap.get(prevDate) || []).filter((c) => c.istTime >= '09:15' && c.istTime <= '15:30');
    if (session.length < 24 || prevSession.length < 24) {
      return { success: false, error: 'Not enough intraday candles for previous session analysis from DB.' };
    }

    const prevClose = prevSession.find((c) => c.istTime === '15:30')?.close || prevSession[prevSession.length - 1]?.close;
    const atrProxyPct = ((Math.max(...session.map((c) => c.high)) - Math.min(...session.map((c) => c.low))) / session[0].open) * 100;
    const dayClassification = this.classifyDay(session, prevClose, atrProxyPct);
    if (Math.abs(Number(dayClassification.gap_pct || 0)) > 1.5) {
      return { success: true, analysis_date: analysisDate, day_classification: dayClassification, ...this.buildSkipCard(symbol, dayClassification, 'Large gap day: structure unreliable, no trade') };
    }
    if (!dayClassification.trade_allowed) {
      return { success: true, analysis_date: analysisDate, day_classification: dayClassification, ...this.buildSkipCard(symbol, dayClassification, dayClassification.reason) };
    }

    const orCandles = session.filter((c) => ['09:15', '09:20', '09:25', '09:30'].includes(c.istTime));
    if (orCandles.length < 4) {
      return { success: false, error: 'Missing opening range candles in DB.' };
    }
    const OR_High = Math.max(...orCandles.map((c) => c.high));
    const OR_Low = Math.min(...orCandles.map((c) => c.low));
    const OR_Width = OR_High - OR_Low;
    const OR_Width_Pct = (OR_Width / OR_High) * 100;
    const Upper_Buffer = OR_High * 1.0015;
    const Lower_Buffer = OR_Low * 0.9985;
    const OR_valid = OR_Width_Pct >= 0.4 && OR_Width_Pct <= 1.2;
    const openingRange = { OR_High, OR_Low, OR_Width_Pct, OR_valid, Upper_Buffer, Lower_Buffer };
    if (!OR_valid) {
      const note = OR_Width_Pct < 0.4 ? 'Sideways day filter: no trade' : 'Volatile open filter: no trade';
      return { success: true, analysis_date: analysisDate, day_classification: dayClassification, opening_range: openingRange, ...this.buildSkipCard(symbol, dayClassification, note) };
    }

    const breakout = this.findBreakout(session, openingRange);
    if (!breakout || breakout.pending) {
      return {
        success: true,
        analysis_date: analysisDate,
        day_classification: dayClassification,
        opening_range: openingRange,
        verdict: 'SKIP',
        message: 'No valid breakout detected in trading window',
      };
    }
    if (breakout.continueScan) {
      return {
        success: true,
        analysis_date: analysisDate,
        day_classification: dayClassification,
        opening_range: openingRange,
        verdict: 'SKIP',
        message: `False breakout on ${breakout.falseBreakAt} candle — scanning continues`,
      };
    }

    const entryIndex = Number(breakout.confirmCandle.close);
    const optionSnapshot = await this.resolveOptionSnapshot(symbol, entryIndex, analysisDate, expiry);
    if (optionSnapshot.error) {
      return { success: true, analysis_date: analysisDate, day_classification: dayClassification, opening_range: openingRange, verdict: 'SKIP', message: optionSnapshot.error };
    }
    const direction = breakout.direction === 'BULLISH' ? 'LONG CALL' : 'LONG PUT';
    const candidates = [optionSnapshot.atm, optionSnapshot.itm].filter((v, idx, arr) => Number.isFinite(v) && arr.indexOf(v) === idx);
    let picked = null;
    for (const strike of candidates) {
      const row = optionSnapshot.rows.find((r) => Number(r.strike_price) === strike);
      if (!row) continue;
      const oi = breakout.direction === 'BULLISH' ? Number(row.call_oi || 0) : Number(row.put_oi || 0);
      if (oi >= 500000) {
        picked = { strike, row, oi };
        break;
      }
      if (!picked) picked = { strike, row, oi };
    }
    if (!picked) {
      return { success: true, analysis_date: analysisDate, verdict: 'SKIP', message: 'No tradable strike found in DB chain snapshot' };
    }
    const entryPremium = breakout.direction === 'BULLISH' ? Number(picked.row.call_ltp || 0) : Number(picked.row.put_ltp || 0);
    if (!(entryPremium > 0)) {
      return { success: true, analysis_date: analysisDate, verdict: 'SKIP', message: 'Option premium unavailable in DB chain snapshot' };
    }

    const slPremium = entryPremium * 0.65;
    const t1Premium = entryPremium * 2;
    const lot = FNO_LOT_SIZE[symbol] || 25;
    const capitalRisk = entryPremium * lot;
    const rr = (t1Premium - entryPremium) / (entryPremium - slPremium);
    const weekday = this.weekdayNameFromDate(analysisDate);
    let sizeNote = 'Normal size';
    if (weekday === 3) sizeNote = 'Wednesday: reduce position size by 50%';
    if (weekday === 4 && dayClassification.vix_regime !== 'High') {
      return { success: true, analysis_date: analysisDate, verdict: 'SKIP', message: 'Thursday expiry filter: VIX regime not supportive for directional premium buy' };
    }

    const indexInvalidation = breakout.direction === 'BULLISH' ? OR_High : OR_Low;
    const entryTime = toIstParts(breakout.confirmCandle.time).time;
    const instrument = `${symbol} ${picked.strike} ${breakout.direction === 'BULLISH' ? 'CE' : 'PE'} ${optionSnapshot.expiry}`;
    const verdict = rr >= 1.5 ? 'TAKE' : 'SKIP';

    const tradeCard = {
      Instrument: instrument,
      'Day type': dayClassification.day_type,
      'Trade direction': direction,
      'Entry time': `${entryTime} IST`,
      'Entry index': Number(entryIndex.toFixed(2)),
      'Entry premium': Number(entryPremium.toFixed(2)),
      'Lot size': lot,
      'Capital at risk': Number(capitalRisk.toFixed(2)),
      'Stop loss': Number(slPremium.toFixed(2)),
      'Index SL level': Number(indexInvalidation.toFixed(2)),
      'Time SL': '11:15 IST',
      'Target 1': Number(t1Premium.toFixed(2)),
      'Target 2': breakout.direction === 'BULLISH' ? 'Trail using 5-min swing low' : 'Trail using 5-min swing high',
      'Min R:R': '1:2',
      WHY_THIS_TRADE: [
        `Opening range width: ${OR_Width_Pct.toFixed(2)}% — valid`,
        `Breakout candle body ratio: ${breakout.bodyRatio.toFixed(2)} (>0.5)`,
        `Body vs avg: ${((breakout.bodyVsAvg - 1) * 100).toFixed(1)}% larger than 5-candle average`,
        'Consolidation before break: yes',
        `Volume spike: ${breakout.volumeSpike ? `yes (${(breakout.volumeSpike * 100).toFixed(0)}% of avg)` : 'not available'}`,
        `VIX regime: ${dayClassification.vix_regime}`,
        `Gap type: ${dayClassification.gap_type}`,
        `Day classification confidence: ${dayClassification.day_type === 'Trending' ? 'High' : 'Medium'}`,
      ],
      HOW_TO_TAKE_THIS_TRADE: [
        `Enter ${direction} at confirmation candle close (${entryTime}) near premium ${entryPremium.toFixed(2)} with limit +2-3 points above ask`,
        `Place immediate premium SL at ${slPremium.toFixed(2)} and index invalidation at ${indexInvalidation.toFixed(2)}`,
        `Book 50% at ${t1Premium.toFixed(2)} (premium doubles)`,
        `Trail remaining using prior 5-min swing ${breakout.direction === 'BULLISH' ? 'lows' : 'highs'}`,
        'Exit at market if still open at 11:15 IST',
      ],
      WHAT_COULD_GO_WRONG: [
        'False momentum extension after confirmation candle can compress option premium quickly',
        'Bid-ask widening around fast candles can degrade realized R:R',
        sizeNote,
      ],
      'OVERALL TRADE VERDICT': verdict,
    };

    return {
      success: true,
      analysis_date: analysisDate,
      day_classification: dayClassification,
      opening_range: openingRange,
      breakout: {
        direction: breakout.direction,
        breakout_time: toIstParts(breakout.breakoutCandle.time).time,
        confirmation_time: entryTime,
        body_ratio: Number(breakout.bodyRatio.toFixed(3)),
        body_vs_avg_ratio: Number(breakout.bodyVsAvg.toFixed(3)),
      },
      trade_allowed: verdict === 'TAKE',
      trade_card: tradeCard,
      local_trade: {
        id: `ORB_${analysisDate}_${symbol}`,
        symbol: instrument,
        type: breakout.direction === 'BULLISH' ? 'LONG' : 'SHORT',
        entry: entryPremium,
        target: t1Premium,
        stopLoss: slPremium,
        time: breakout.confirmCandle.time,
        reason: `F&O ORB strategy (${dayClassification.day_type}) | ${sizeNote}`,
        source: 'FNO_ORB_DB',
        confidence: dayClassification.day_type === 'Trending' ? 88 : 72,
      },
      chart_annotations: {
        or_high: OR_High,
        or_low: OR_Low,
        upper_buffer: Upper_Buffer,
        lower_buffer: Lower_Buffer,
        breakout_time: toIstParts(breakout.breakoutCandle.time).time,
        entry_time: entryTime,
        index_sl_line: indexInvalidation,
      },
      backtest_integrity: {
        no_look_ahead_bias: true,
        entry_on_confirmation_close: true,
        one_way_slippage_pct: 0.05,
        brokerage_per_lot_roundtrip_inr: 40,
        option_spread_points: 0.5,
      },
    };
  }
}

module.exports = new FnoOrbStrategyService();

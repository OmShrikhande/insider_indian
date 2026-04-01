import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  CrosshairMode,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  createSeriesMarkers,
} from 'lightweight-charts';
import * as Calcs from '../lib/indicators';
import { scanPatterns } from '../lib/patterns';
import { detectSMC } from '../lib/smc';
import { calculateVolumeProfile } from '../lib/volumeProfile';

const CandlestickChart = ({ data, news, symbol, activeIndicators, activePatterns }) => {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const candleRef = useRef(null);
  const seriesMarkersRef = useRef(null); // v5 markers plugin instance
  const seriesMapRef = useRef({});
  const prevSymbolRef = useRef(symbol);
  const [tooltipData, setTooltipData] = useState(null);
  const [newsMarkers, setNewsMarkers] = useState([]);
  const [drawings, setDrawings] = useState([]);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [rulerState, setRulerState] = useState(null); // { startPoint: { time, price }, currentPoint: { time, price } }
  const [isRulerMode, setIsRulerMode] = useState(false);
  const [activeDrawingType, setActiveDrawingType] = useState(null); // 'hline' | 'trend' | 'box'
  const [currentLine, setCurrentLine] = useState(null); // { start: { time, price }, end: { time, price } }
  const [currentBox, setCurrentBox] = useState(null); // { start: { time, price }, end: { time, price } }
  const [vpProfile, setVpProfile] = useState(null);

  // ─── Init chart once ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      layout: {
        background: { color: '#000000' },
        textColor: '#d1d4dc',
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: 'rgba(42,46,57,0.06)' },
        horzLines: { color: 'rgba(42,46,57,0.06)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { width: 1, color: '#00f2ff', style: 3, labelBackgroundColor: '#000000' },
        horzLine: { width: 1, color: '#00f2ff', style: 3, labelBackgroundColor: '#000000' },
      },
      rightPriceScale: { borderColor: '#1c2127', textColor: '#848e9c' },
      timeScale: {
        borderColor: '#1c2127',
        textColor: '#848e9c',
        timeVisible: true,
        secondsVisible: false,
        // Critical: ensure enough space for the time axis labels
        barSpacing: 6,
        rightOffset: 5,
      },
      handleScroll: true,
      handleScale: true,
    });

    const candle = chart.addSeries(CandlestickSeries, {
      upColor: '#39ff14',
      downColor: '#ff003c',
      borderVisible: false,
      wickUpColor: '#39ff14',
      wickDownColor: '#ff003c',
    });
    candleRef.current = candle;

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData.size) { setTooltipData(null); return; }
      const c = param.seriesData.get(candle);
      if (c) setTooltipData({ time: param.time, open: c.open, high: c.high, low: c.low, close: c.close });
    });

    // Robust resize observer — uses explicit pixel dimensions
    const resizeObs = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        chart.applyOptions({ width: Math.floor(width), height: Math.floor(height) });
      }
    });
    resizeObs.observe(containerRef.current);

    chartRef.current = chart;
    seriesMapRef.current = {};
    seriesMarkersRef.current = null;

    return () => {
      resizeObs.disconnect();
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      seriesMarkersRef.current = null;
    };
  }, []);

  // ─── Rebuild all series when data or indicators change ──────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    const candle = candleRef.current;
    if (!chart || !candle || !data || data.length === 0) return;

    candle.setData(data);

    // Remove stale indicator series
    Object.values(seriesMapRef.current).forEach(s => {
      try { chart.removeSeries(s); } catch (_) {}
    });
    seriesMapRef.current = {};

    let subPaneIdx = 0;

    const addLine = (id, calcData, color, scaleId = 'right', lineWidth = 1) => {
      if (!calcData || calcData.length === 0) return;
      try {
        const s = chart.addSeries(LineSeries, {
          color, lineWidth, priceLineVisible: false,
          lastValueVisible: true, priceScaleId: scaleId,
        });
        if (scaleId !== 'right') {
          chart.priceScale(scaleId).applyOptions({
            scaleMargins: { top: 0.78, bottom: 0.02 },
            borderVisible: true, borderColor: '#1c2127',
          });
        }
        s.setData(calcData);
        seriesMapRef.current[id] = s;
      } catch (e) { console.warn(`Failed to add series ${id}:`, e.message); }
    };

    const addHistogram = (id, calcData, color, scaleId) => {
      if (!calcData || calcData.length === 0) return;
      try {
        const s = chart.addSeries(HistogramSeries, {
          color, priceScaleId: scaleId || '', priceLineVisible: false,
        });
        if (scaleId) {
          chart.priceScale(scaleId).applyOptions({
            scaleMargins: { top: 0.82, bottom: 0.02 },
            borderVisible: true, borderColor: '#1c2127',
          });
        }
        s.setData(calcData);
        seriesMapRef.current[id] = s;
      } catch (e) { console.warn(`Failed to add histogram ${id}:`, e.message); }
    };

    const addBand = (id, calcData, color) => {
      if (!calcData || calcData.length === 0) return;
      try {
        const opts = { color, lineWidth: 1, priceLineVisible: false, lineStyle: 2, lastValueVisible: false };
        const upper = chart.addSeries(LineSeries, opts);
        const lower = chart.addSeries(LineSeries, opts);
        const middle = chart.addSeries(LineSeries, { ...opts, lineStyle: 0, lineWidth: 1 });
        upper.setData(calcData.map(d => ({ time: d.time, value: d.upper })));
        lower.setData(calcData.map(d => ({ time: d.time, value: d.lower })));
        if (calcData[0]?.middle != null) middle.setData(calcData.map(d => ({ time: d.time, value: d.middle })));
        seriesMapRef.current[`${id}_u`] = upper;
        seriesMapRef.current[`${id}_l`] = lower;
        seriesMapRef.current[`${id}_m`] = middle;
      } catch (e) { console.warn(`Failed to add band ${id}:`, e.message); }
    };

    const on = (id) => activeIndicators?.[id];
    const nextScale = () => `sub${subPaneIdx++}`;

    try {
      // ── Price-Overlay Indicators ──────────────────────────────────────────
      if (on('sma20'))  addLine('sma20',  Calcs.calcSMA(data, 20),  '#00f2ff');
      if (on('sma50'))  addLine('sma50',  Calcs.calcSMA(data, 50),  '#26a69a');
      if (on('sma100')) addLine('sma100', Calcs.calcSMA(data, 100), '#80cbc4');
      if (on('sma200')) addLine('sma200', Calcs.calcSMA(data, 200), '#4db6ac', 'right', 2);
      if (on('ema9'))   addLine('ema9',   Calcs.calcEMA(data, 9),   '#ffeb3b');
      if (on('ema21'))  addLine('ema21',  Calcs.calcEMA(data, 21),  '#e91e63');
      if (on('ema50'))  addLine('ema50',  Calcs.calcEMA(data, 50),  '#ff9800');
      if (on('ema200')) addLine('ema200', Calcs.calcEMA(data, 200), '#ff5722', 'right', 2);
      if (on('wma'))    addLine('wma',    Calcs.calcWMA(data, 20),  '#9c27b0');
      if (on('hma'))    addLine('hma',    Calcs.calcHMA(data, 20),  '#ba68c8');
      if (on('dema'))   addLine('dema',   Calcs.calcDEMA(data, 20), '#ce93d8');
      if (on('tema'))   addLine('tema',   Calcs.calcTEMA(data, 20), '#ab47bc');
      if (on('vwap'))   addLine('vwap',   Calcs.calcVWAP(data),     '#00bcd4', 'right', 2);
      if (on('vwma') || on('vwma_vol')) addLine('vwma', Calcs.calcVWMA(data, 20), '#00b0ff');
      if (on('alma'))   addLine('alma',   Calcs.calcALMA(data, 9),  '#006064');
      if (on('bb'))     addBand('bb', Calcs.calcBollingerBands(data, 20, 2), '#546e7a');
      if (on('kc'))     addBand('kc', Calcs.calcKeltnerChannels(data, 20, 2), '#4527a0');
      if (on('dc'))     addBand('dc', Calcs.calcDonchianChannels(data, 20), '#283593');
      if (on('psar'))   addLine('psar',  Calcs.calcParabolicSAR(data), '#b0bec5');
      if (on('supertrend')) addLine('supertrend', Calcs.calcSupertrend(data, 10, 3), '#b71c1c', 'right', 2);

      if (on('ichimoku')) {
        const ich = Calcs.calcIchimoku(data, 9, 26, 52);
        addLine('ich_t', ich.map(d => ({ time: d.time, value: d.tenkan })), '#26a69a');
        addLine('ich_k', ich.map(d => ({ time: d.time, value: d.kijun })), '#ef5350');
        addLine('ich_a', ich.filter(d => d.senkouA != null).map(d => ({ time: d.time, value: d.senkouA })), '#4caf50');
        addLine('ich_b', ich.filter(d => d.senkouB != null).map(d => ({ time: d.time, value: d.senkouB })), '#f44336');
      }

      // ── Sub-pane Indicators ───────────────────────────────────────────────
      if (on('volume')) {
        const vs = chart.addSeries(HistogramSeries, { priceScaleId: 'vol', priceLineVisible: false });
        chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.86, bottom: 0 }, borderVisible: false });
        vs.setData(data.map(d => ({
          time: d.time, value: d.volume,
          color: d.close >= d.open ? 'rgba(57,255,20,0.3)' : 'rgba(255,0,60,0.3)',
        })));
        seriesMapRef.current['volume'] = vs;
      }
      if (on('rsi'))   addLine('rsi', Calcs.calcRSI(data, 14), '#ffa726', nextScale());
      if (on('macd')) {
        const { macdLine, signalLine, histogram } = Calcs.calcMACD(data, 12, 26, 9);
        const sc = nextScale();
        addLine('macd_l', macdLine.map(d => ({ time: d.time, value: d.value })), '#26a69a', sc);
        addLine('macd_s', signalLine.map(d => ({ time: d.time, value: d.value })), '#ef5350', sc);
        addHistogram('macd_h', histogram.map(d => ({ time: d.time, value: d.value, color: d.value >= 0 ? 'rgba(57,255,20,0.4)' : 'rgba(255,0,60,0.4)' })), '#26a69a', sc);
      }
      if (on('stoch')) {
        const { kLine, dLine } = Calcs.calcStochastic(data, 14, 3, 3);
        const sc = nextScale();
        addLine('stoch_k', kLine.map(d => ({ time: d.time, value: d.value })), '#00bcd4', sc);
        addLine('stoch_d', dLine.map(d => ({ time: d.time, value: d.value })), '#ff9800', sc);
      }
      if (on('stochrsi'))  addLine('stochrsi', Calcs.calcStochRSI(data, 14), '#e040fb', nextScale());
      if (on('cci'))       addLine('cci', Calcs.calcCCI(data, 20), '#f06292', nextScale());
      if (on('roc'))       addHistogram('roc', Calcs.calcROC(data, 12).map(d => ({ ...d, color: d.value >= 0 ? 'rgba(57,255,20,0.4)' : 'rgba(255,0,60,0.4)' })), '#4caf50', nextScale());
      if (on('momentum'))  addLine('momentum', Calcs.calcMomentum(data, 10), '#8bc34a', nextScale());
      if (on('willr'))     addLine('willr', Calcs.calcWillR(data, 14), '#cddc39', nextScale());
      if (on('ao'))        addHistogram('ao', Calcs.calcAO(data).map(d => ({ ...d, color: d.value >= 0 ? 'rgba(57,255,20,0.4)' : 'rgba(255,0,60,0.4)' })), '#8bc34a', nextScale());
      if (on('uo'))        addLine('uo', Calcs.calcUltimateOscillator(data), '#ff7043', nextScale());
      if (on('tsi'))       addLine('tsi', Calcs.calcTSI(data, 25, 13), '#ff8a65', nextScale());
      if (on('atr'))       addLine('atr', Calcs.calcATR(data, 14), '#78909c', nextScale());
      if (on('stddev'))    addLine('stddev', Calcs.calcStdDev(data, 20), '#5c6bc0', nextScale());
      if (on('adx')) {
        const adxData = Calcs.calcADX(data, 14);
        const sc = nextScale();
        addLine('adx_v', adxData.map(d => ({ time: d.time, value: d.value })), '#f9a825', sc);
        addLine('adx_p', adxData.map(d => ({ time: d.time, value: d.diPlus })), '#4caf50', sc);
        addLine('adx_m', adxData.map(d => ({ time: d.time, value: d.diMinus })), '#ef5350', sc);
      }
      if (on('aroon')) {
        const sc = nextScale();
        const ar = Calcs.calcAroon(data, 25);
        addLine('aroon_u', ar.map(d => ({ time: d.time, value: d.aroonUp })), '#4caf50', sc);
        addLine('aroon_d', ar.map(d => ({ time: d.time, value: d.aroonDown })), '#ef5350', sc);
      }
      if (on('vortex')) {
        const sc = nextScale();
        const vx = Calcs.calcVortex(data, 14);
        addLine('vortex_p', vx.map(d => ({ time: d.time, value: d.viPlus })), '#4caf50', sc);
        addLine('vortex_m', vx.map(d => ({ time: d.time, value: d.viMinus })), '#ef5350', sc);
      }
      if (on('obv'))      addLine('obv', Calcs.calcOBV(data), '#00897b', nextScale());
      if (on('cmf'))      addLine('cmf', Calcs.calcCMF(data, 20), '#00acc1', nextScale());
      if (on('mfi'))      addLine('mfi', Calcs.calcMFI(data, 14), '#039be5', nextScale());
      if (on('adl'))      addLine('adl', Calcs.calcADL(data), '#1e88e5', nextScale());
      if (on('efi'))      addHistogram('efi', Calcs.calcEFI(data, 13).map(d => ({ ...d, color: d.value >= 0 ? 'rgba(57,255,20,0.4)' : 'rgba(255,0,60,0.4)' })), '#3949ab', nextScale());
      if (on('dpo'))      addLine('dpo', Calcs.calcDPO(data, 20), '#d500f9', nextScale());
      if (on('trix'))     addLine('trix', Calcs.calcTRIX(data, 15), '#6200ea', nextScale());
      if (on('massindex')) addLine('massindex', Calcs.calcMassIndex(data), '#304ffe', nextScale());
      if (on('coppock'))  addLine('coppock', Calcs.calcCoppockCurve(data), '#00b0ff', nextScale());
      if (on('kst'))      addLine('kst', Calcs.calcKST(data), '#00e5ff', nextScale());
      if (on('ppo')) {
        const { ppoLine, signalLine } = Calcs.calcPPO(data, 12, 26, 9);
        const sc = nextScale();
        addLine('ppo_l', ppoLine.map(d => ({ time: d.time, value: d.value })), '#aa00ff', sc);
        addLine('ppo_s', signalLine.map(d => ({ time: d.time, value: d.value })), '#e040fb', sc);
      }
      if (on('elderray')) {
        const sc = nextScale();
        const er = Calcs.calcElderRay(data, 13);
        addHistogram('er_b', er.map(d => ({ time: d.time, value: d.bullPower, color: 'rgba(57,255,20,0.4)' })), '#4caf50', sc);
        addHistogram('er_r', er.map(d => ({ time: d.time, value: d.bearPower, color: 'rgba(255,0,60,0.4)' })), '#ef5350', sc);
      }
    } catch (err) {
      console.error('Indicator render error:', err);
    }

    // ── Pattern & News & SMC Markers (lightweight-charts v5 API) ──────────
    if (candleRef.current) {
      try {
        const patternMarkers = activePatterns ? scanPatterns(data, activePatterns) : [];
        
        // SMC Detection
        const smc = detectSMC(data);
        const smcMarkers = [];
        if (activeIndicators?.smc) {
          smc.bos.forEach(b => smcMarkers.push({ time: b.time, position: 'aboveBar', shape: 'arrowDown', color: b.color, text: b.type }));
          smc.choch.forEach(c => smcMarkers.push({ time: c.time, position: 'aboveBar', shape: 'arrowDown', color: c.color, text: c.type }));
        }

        // Convert news to markers (limit to last 5)
        const newsMarkersList = (news || []).slice(0, 5).map(item => ({
          time: Math.floor(new Date(item.timestamp).getTime() / 1000),
          position: 'aboveBar',
          shape: 'circle',
          color: item.sentiment === 'bullish' ? '#39ff14' : item.sentiment === 'bearish' ? '#ff003c' : '#00f2ff',
          text: 'NEWS',
          size: 2,
        }));

        const allMarkers = [...patternMarkers, ...newsMarkersList, ...smcMarkers].sort((a, b) => a.time - b.time);

        if (seriesMarkersRef.current) {
          seriesMarkersRef.current.setMarkers(allMarkers);
        } else {
          seriesMarkersRef.current = createSeriesMarkers(candleRef.current, allMarkers);
        }

        // Volume Profile Overlay
        if (activeIndicators?.vp) {
          const vp = calculateVolumeProfile(data);
          setVpProfile(vp);
        } else {
          setVpProfile(null);
        }

      } catch (e) {
        console.warn('Markers rendering error:', e.message);
      }
    }

    // Only fit content when symbol changes or first data load
    if (prevSymbolRef.current !== symbol || !seriesMapRef.current._initialFitDone) {
      chart.timeScale().fitContent();
      prevSymbolRef.current = symbol;
      seriesMapRef.current._initialFitDone = true;
    }
  }, [data, news, activeIndicators, activePatterns, symbol]);

  const handleChartClick = useCallback((e) => {
    if (!chartRef.current || !candleRef.current) return;
    const price = candleRef.current.coordinateToPrice(e.nativeEvent.offsetY);
    const time = chartRef.current.timeScale().coordinateToTime(e.nativeEvent.offsetX);

    if (isRulerMode) {
      if (!rulerState) {
        setRulerState({ start: { time, price }, end: { time, price } });
      } else {
        setRulerState(null);
        setIsRulerMode(false);
      }
      return;
    }

    if (activeDrawingType === 'hline') {
      setDrawings(prev => [...prev, { type: 'hline', price }]);
      setActiveDrawingType(null);
    } else if (activeDrawingType === 'trend') {
      if (!currentLine) {
        setCurrentLine({ start: { time, price }, end: { time, price } });
      } else {
        setDrawings(prev => [...prev, { type: 'trend', ...currentLine, end: { time, price } }]);
        setCurrentLine(null);
        setActiveDrawingType(null);
      }
    } else if (activeDrawingType === 'box') {
      if (!currentBox) {
        setCurrentBox({ start: { time, price }, end: { time, price } });
      } else {
        setDrawings(prev => [...prev, { type: 'box', ...currentBox, end: { time, price } }]);
        setCurrentBox(null);
        setActiveDrawingType(null);
      }
    }
  }, [activeDrawingType, isRulerMode, rulerState, currentLine, currentBox]);

  const handleMouseMove = useCallback((e) => {
    if (!chartRef.current || !candleRef.current) return;
    const price = candleRef.current.coordinateToPrice(e.nativeEvent.offsetY);
    const time = chartRef.current.timeScale().coordinateToTime(e.nativeEvent.offsetX);

    if (isRulerMode && rulerState) {
      setRulerState(prev => ({ ...prev, end: { time, price } }));
    }
    if (activeDrawingType === 'trend' && currentLine) {
      setCurrentLine(prev => ({ ...prev, end: { time, price } }));
    }
    if (activeDrawingType === 'box' && currentBox) {
      setCurrentBox(prev => ({ ...prev, end: { time, price } }));
    }
  }, [isRulerMode, rulerState, activeDrawingType, currentLine, currentBox]);

  return (
    <div 
      className="relative w-full h-full bg-[#000000]" 
      onClick={handleChartClick}
      onMouseMove={handleMouseMove}
    >

      {/* Toolbar */}
      <div className="absolute top-2 left-2 z-20 flex flex-col gap-1.5 p-1 bg-[#050505]/80 backdrop-blur-md rounded border border-[#1c2127]">
        <button
          onClick={e => { e.stopPropagation(); setActiveDrawingType('hline'); setIsRulerMode(false); }}
          className={`w-8 h-8 flex items-center justify-center rounded transition-all ${
            activeDrawingType === 'hline' ? 'bg-[#00f2ff] text-[#000]' : 'text-[#848e9c] hover:bg-[#1c2127]'
          }`}
          title="Horizontal Line"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/></svg>
        </button>
        <button
          onClick={e => { e.stopPropagation(); setActiveDrawingType('trend'); setIsRulerMode(false); }}
          className={`w-8 h-8 flex items-center justify-center rounded transition-all ${
            activeDrawingType === 'trend' ? 'bg-[#00f2ff] text-[#000]' : 'text-[#848e9c] hover:bg-[#1c2127]'
          }`}
          title="Trendline"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 4L3 20"/></svg>
        </button>
        <button
          onClick={e => { e.stopPropagation(); setActiveDrawingType('box'); setIsRulerMode(false); }}
          className={`w-8 h-8 flex items-center justify-center rounded transition-all ${
            activeDrawingType === 'box' ? 'bg-[#00f2ff] text-[#000]' : 'text-[#848e9c] hover:bg-[#1c2127]'
          }`}
          title="Order Block Box"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
        </button>
        <button
          onClick={e => { e.stopPropagation(); setIsRulerMode(v => !v); setActiveDrawingType(null); }}
          className={`w-8 h-8 flex items-center justify-center rounded transition-all ${
            isRulerMode ? 'bg-[#39ff14] text-[#000]' : 'text-[#848e9c] hover:bg-[#1c2127]'
          }`}
          title="Ruler tool"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 4v16M5 4v16M5 12h14M8 4h0M12 4h0M16 4h0M8 20h0M12 20h0M16 20h0"/></svg>
        </button>
        <div className="w-full h-px bg-[#1c2127] my-0.5" />
        <button
          onClick={e => { e.stopPropagation(); setDrawings([]); }}
          className="w-8 h-8 flex items-center justify-center text-[#848e9c] hover:text-[#ff003c] rounded transition-all"
          title="Clear all"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 7l-7 7-7-7"/></svg>
        </button>
        <div className="w-full h-px bg-[#1c2127] my-0.5" />
        <button
          onClick={e => { 
            e.stopPropagation(); 
            const ts = chartRef.current?.timeScale();
            if (ts) {
              const range = ts.getVisibleLogicalRange();
              if (range) {
                const width = range.to - range.from;
                ts.setVisibleLogicalRange({ from: range.from + width * 0.1, to: range.to - width * 0.1 });
              }
            }
          }}
          className="w-8 h-8 flex items-center justify-center text-[#848e9c] hover:bg-[#1c2127] rounded"
          title="Zoom In"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
        </button>
        <button
          onClick={e => { 
            e.stopPropagation(); 
            const ts = chartRef.current?.timeScale();
            if (ts) {
              const range = ts.getVisibleLogicalRange();
              if (range) {
                const width = range.to - range.from;
                ts.setVisibleLogicalRange({ from: range.from - width * 0.1, to: range.to + width * 0.1 });
              }
            }
          }}
          className="w-8 h-8 flex items-center justify-center text-[#848e9c] hover:bg-[#1c2127] rounded"
          title="Zoom Out"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/></svg>
        </button>
      </div>

      {/* Shapes & VP Overlay (SVG) */}
      <svg className="absolute inset-0 pointer-events-none z-10 w-full h-full">
        {/* Volume Profile Bars */}
        {vpProfile && chartRef.current && (
           <g opacity="0.4">
              {vpProfile.profile.map((p, i) => {
                const y = chartRef.current.priceScale('right').priceToCoordinate(p.value);
                const barWidth = (p.volume / vpProfile.maxVolume) * 120; // Max 120px width
                return (
                  <rect 
                    key={i} 
                    x={containerRef.current.clientWidth - barWidth} 
                    y={y - 2} 
                    width={barWidth} 
                    height={4} 
                    fill={p.value === vpProfile.poc ? '#39ff14' : '#00f2ff'} 
                  />
                );
              })}
           </g>
        )}

        {drawings.map((draw, idx) => (
           <g key={idx}>
              {draw.type === 'trend' && (
                <line 
                  x1={chartRef.current?.timeScale().timeToCoordinate(draw.start.time)}
                  y1={chartRef.current?.priceScale('right').priceToCoordinate(draw.start.price)}
                  x2={chartRef.current?.timeScale().timeToCoordinate(draw.end.time)}
                  y2={chartRef.current?.priceScale('right').priceToCoordinate(draw.end.price)}
                  stroke="rgba(0,242,255,0.7)" strokeWidth="1.5" 
                />
              )}
              {draw.type === 'box' && (
                <rect 
                  x={Math.min(chartRef.current?.timeScale().timeToCoordinate(draw.start.time), chartRef.current?.timeScale().timeToCoordinate(draw.end.time))}
                  y={Math.min(chartRef.current?.priceScale('right').priceToCoordinate(draw.start.price), chartRef.current?.priceScale('right').priceToCoordinate(draw.end.price))}
                  width={Math.abs(chartRef.current?.timeScale().timeToCoordinate(draw.start.time) - chartRef.current?.timeScale().timeToCoordinate(draw.end.time))}
                  height={Math.abs(chartRef.current?.priceScale('right').priceToCoordinate(draw.start.price) - chartRef.current?.priceScale('right').priceToCoordinate(draw.end.price))}
                  fill="rgba(0,242,255,0.15)" stroke="rgba(0,242,255,0.3)" 
                />
              )}
              {draw.type === 'hline' && (
                <line 
                  x1="0" x2="100%"
                  y1={chartRef.current?.priceScale('right').priceToCoordinate(draw.price)}
                  y2={chartRef.current?.priceScale('right').priceToCoordinate(draw.price)}
                  stroke="rgba(0,242,255,0.4)" strokeWidth="1" strokeDasharray="2 2"
                />
              )}
           </g>
        ))}
        {/* Partial previews */}
        {currentLine && (
          <line 
            x1={chartRef.current?.timeScale().timeToCoordinate(currentLine.start.time)}
            y1={chartRef.current?.priceScale('right').priceToCoordinate(currentLine.start.price)}
            x2={chartRef.current?.timeScale().timeToCoordinate(currentLine.end.time)}
            y2={chartRef.current?.priceScale('right').priceToCoordinate(currentLine.end.price)}
            stroke="rgba(0,242,255,0.5)" strokeWidth="1.5" strokeDasharray="4 4"
          />
        )}
        {currentBox && (
          <rect 
            x={Math.min(chartRef.current?.timeScale().timeToCoordinate(currentBox.start.time), chartRef.current?.timeScale().timeToCoordinate(currentBox.end.time))}
            y={Math.min(chartRef.current?.priceScale('right').priceToCoordinate(currentBox.start.price), chartRef.current?.priceScale('right').priceToCoordinate(currentBox.end.price))}
            width={Math.abs(chartRef.current?.timeScale().timeToCoordinate(currentBox.start.time) - chartRef.current?.timeScale().timeToCoordinate(currentBox.end.time))}
            height={Math.abs(chartRef.current?.priceScale('right').priceToCoordinate(currentBox.start.price) - chartRef.current?.priceScale('right').priceToCoordinate(currentBox.end.price))}
            fill="rgba(0,242,255,0.1)" stroke="rgba(0,242,255,0.2)" strokeDasharray="4 4"
          />
        )}
      </svg>

      {/* Ruler Overlay */}
      {isRulerMode && rulerState && (
        <div className="absolute inset-0 pointer-events-none z-30">
           <svg className="w-full h-full">
              <line 
                x1={chartRef.current?.timeScale().timeToCoordinate(rulerState.start.time)}
                y1={chartRef.current?.priceScale('right').priceToCoordinate(rulerState.start.price)}
                x2={chartRef.current?.timeScale().timeToCoordinate(rulerState.end.time)}
                y2={chartRef.current?.priceScale('right').priceToCoordinate(rulerState.end.price)}
                stroke="#39ff14"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
           </svg>
           {/* Delta Label */}
           {chartRef.current && (
             <div 
               style={{ 
                 position: 'absolute', 
                 left: chartRef.current.timeScale().timeToCoordinate(rulerState.end.time) + 10,
                 top: chartRef.current.priceScale('right').priceToCoordinate(rulerState.end.price) - 10,
                 background: '#39ff14', color: '#000', padding: '2px 6px', borderRadius: 4,
                 fontSize: 10, fontWeight: 700, fontFamily: 'monospace'
               }}
             >
               {((rulerState.end.price - rulerState.start.price)/rulerState.start.price * 100).toFixed(2)}% | {(rulerState.end.price - rulerState.start.price).toFixed(2)} pts
             </div>
           )}
        </div>
      )}

      {/* OHLC Tooltip */}
      {tooltipData && (
        <div className="absolute top-2 right-2 z-20 bg-[#000000]/95 border border-[#1c2127] p-2.5 rounded min-w-[148px] pointer-events-none">
          <div className="text-[9px] font-mono text-[#5d606b] mb-1.5 pb-1 border-b border-[#1c2127]">
            {new Date(tooltipData.time * 1000).toLocaleDateString()} {new Date(tooltipData.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono text-[11px]">
            {[['O', tooltipData.open, '#d1d4dc'], ['H', tooltipData.high, '#39ff14'], ['L', tooltipData.low, '#ff003c'], ['C', tooltipData.close, '#d1d4dc']].map(([l, v, c]) => (
              <div key={l} className="flex justify-between">
                <span className="text-[#5d606b]">{l}</span>
                <span style={{ color: c }}>{v?.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="mt-1 pt-1 border-t border-[#1c2127] flex justify-between text-[9px] font-mono">
            <span className="text-[#5d606b]">Δ</span>
            <span style={{ color: tooltipData.close >= tooltipData.open ? '#39ff14' : '#ff003c' }}>
              {tooltipData.close >= tooltipData.open ? '+' : ''}{(tooltipData.close - tooltipData.open).toFixed(2)}
              {' '}({((tooltipData.close - tooltipData.open) / tooltipData.open * 100).toFixed(2)}%)
            </span>
          </div>
        </div>
      )}

      {/* Drawing overlays */}
      <div className="absolute inset-0 pointer-events-none z-10">
        {drawings.map((draw, idx) => {
          const coord = chartRef.current?.priceScale('right').priceToCoordinate(draw.price);
          if (coord == null) return null;
          return (
            <div key={idx} style={{ position: 'absolute', top: coord, left: 0, right: 0, height: '1px', background: 'rgba(0,242,255,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 68 }}>
              <span style={{ background: '#000', color: '#00f2ff', fontSize: 8, fontFamily: 'monospace', padding: '0 3px', border: '1px solid rgba(0,242,255,0.3)', borderRadius: 2 }}>
                {draw.price.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>

      {/* The actual chart — fills 100% of parent */}
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
    </div>
  );
};

export default CandlestickChart;
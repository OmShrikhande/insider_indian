import React, { useState, useEffect, useMemo, useRef } from 'react';
import apiService from '../services/apiService';

function normalizeChainRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const callOptions = row.call_options || {};
    const putOptions = row.put_options || {};
    const callMarket = callOptions.market_data || {};
    const putMarket = putOptions.market_data || {};
    const callGreeks = callOptions.option_greeks || {};
    const putGreeks = putOptions.option_greeks || {};

    return {
      underlying_spot_price: row.underlying_spot_price != null ? Number(row.underlying_spot_price) : null,
      strike_price: row.strike_price,
      call_key: row.call_key || callOptions.instrument_key || '',
      put_key: row.put_key || putOptions.instrument_key || '',
      call_ltp: row.call_ltp ?? callMarket.ltp ?? 0,
      put_ltp: row.put_ltp ?? putMarket.ltp ?? 0,
      call_oi: row.call_oi ?? callMarket.oi ?? 0,
      put_oi: row.put_oi ?? putMarket.oi ?? 0,
      call_volume: row.call_volume ?? callMarket.volume ?? 0,
      put_volume: row.put_volume ?? putMarket.volume ?? 0,
      call_delta: row.call_delta ?? callGreeks.delta ?? 0,
      put_delta: row.put_delta ?? putGreeks.delta ?? 0,
      call_iv: row.call_iv ?? callGreeks.iv ?? 0,
      put_iv: row.put_iv ?? putGreeks.iv ?? 0,
      call_vega: row.call_vega ?? callGreeks.vega ?? 0,
      put_vega: row.put_vega ?? putGreeks.vega ?? 0,
      call_theta: row.call_theta ?? callGreeks.theta ?? 0,
      put_theta: row.put_theta ?? putGreeks.theta ?? 0,
    };
  });
}

const OptionChainTable = ({ symbol, instrumentKey, expiry, onSelectContract, spotPrice, onOpenIndexChart }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [liveLastPrice, setLiveLastPrice] = useState(null);
  const atmRowRef = useRef(null);

  const resolvedSpot = useMemo(() => {
    const live =
      liveLastPrice != null && !Number.isNaN(Number(liveLastPrice)) ? Number(liveLastPrice) : null;
    if (live != null) return live;
    const s = spotPrice != null && !Number.isNaN(Number(spotPrice)) ? Number(spotPrice) : null;
    if (s != null) return s;
    const fromRow = data[0]?.underlying_spot_price;
    return fromRow != null && !Number.isNaN(Number(fromRow)) ? Number(fromRow) : null;
  }, [liveLastPrice, spotPrice, data]);

  const atmStrike = useMemo(() => {
    if (resolvedSpot == null || !data.length) return null;
    let best = data[0].strike_price;
    let bestD = Math.abs(Number(best) - resolvedSpot);
    for (const r of data) {
      const d = Math.abs(Number(r.strike_price) - resolvedSpot);
      if (d < bestD) {
        bestD = d;
        best = r.strike_price;
      }
    }
    return Number(best);
  }, [data, resolvedSpot]);

  const resolvedKeyForQuote = useMemo(
    () => instrumentKey || apiService.resolveFnoInstrumentKey(symbol),
    [instrumentKey, symbol]
  );

  useEffect(() => {
    setLiveLastPrice(null);
  }, [resolvedKeyForQuote]);

  useEffect(() => {
    if (!symbol || !expiry || !resolvedKeyForQuote) return undefined;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await apiService.getMarketQuoteOhlc(resolvedKeyForQuote, 'I30');
        const lp = res?.data?.last_price;
        if (!cancelled && lp != null && !Number.isNaN(Number(lp))) {
          setLiveLastPrice(Number(lp));
        }
      } catch {
        /* keep chain spot / props */
      }
    };
    poll();
    const id = setInterval(poll, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [symbol, expiry, resolvedKeyForQuote]);

  useEffect(() => {
    if (atmStrike == null || !data.length) return;
    const t = setTimeout(() => {
      atmRowRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    }, 400);
    return () => clearTimeout(t);
  }, [atmStrike, data.length, liveLastPrice]);

  useEffect(() => {
    const fetchChain = async () => {
      if (!symbol || !expiry) return;
      try {
        setLoading(true);
        setError(null);

        const resolvedKey = resolvedKeyForQuote;
        let response = await apiService.getOptionChainByInstrument(resolvedKey, expiry);
        let rows = Array.isArray(response?.data) ? response.data : [];

        if (response?.message && rows.length === 0) {
          setError(response.message);
          setData([]);
          return;
        }

        if (rows.length === 0) {
          response = await apiService.getOptionChain(symbol, expiry);
          rows = Array.isArray(response?.data) ? response.data : [];
        }

        if (response.success || response.status === 'success') {
          setData(normalizeChainRows(rows));
          if (!rows.length && response.message) setError(response.message);
        } else {
          setError(response.error);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchChain();
  }, [symbol, instrumentKey, expiry, resolvedKeyForQuote]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 space-y-4">
      <div className="w-8 h-8 border-2 border-[#00f2ff] border-t-transparent rounded-full animate-spin shadow-[0_0_15px_#00f2ff]"></div>
      <div className="text-[#00f2ff] text-[10px] font-mono tracking-widest animate-pulse font-bold">FETCHING_CHAIN_SNAPSHOT...</div>
    </div>
  );

  if (error) return (
    <div className="p-10 text-center">
      <div className="text-[#ff4d4d] text-xs font-mono border border-[#ff4d4d]/20 bg-[#ff4d4d]/5 px-4 py-3 rounded-lg">
        ERROR_O3: {error}
      </div>
    </div>
  );

  const toNum = (value) => Number(value || 0);
  const fmt = (value, digits = 2) => toNum(value).toFixed(digits);
  const fmtInt = (value) => toNum(value).toLocaleString('en-IN');

  return (
    <div className="h-full overflow-auto custom-scrollbar bg-[#050505] rounded-xl border border-[#1c2127] shadow-2xl">
      {(resolvedSpot != null || onOpenIndexChart) && (
        <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-[#1c2127] bg-[#0a0a0a]/95 text-[10px] font-mono">
          <div className="text-[#848e9c]">
            {resolvedSpot != null && (
              <>
                <span className="text-[#5d606b] mr-2">SPOT</span>
                <span className="text-[#39ff14] font-bold">{fmt(resolvedSpot, 2)}</span>
                {liveLastPrice != null && (
                  <span className="text-[#5d606b] ml-2">(LIVE_LTP)</span>
                )}
                {atmStrike != null && (
                  <span className="text-[#5d606b] ml-3">ATM_STRIKE</span>
                )}
                {atmStrike != null && (
                  <span className="text-[#00f2ff] font-bold ml-1">{atmStrike}</span>
                )}
              </>
            )}
          </div>
          {typeof onOpenIndexChart === 'function' && (
            <button
              type="button"
              onClick={onOpenIndexChart}
              className="px-3 py-1 rounded border border-[#00f2ff]/40 bg-[#00f2ff]/10 text-[#00f2ff] text-[10px] font-bold tracking-widest hover:bg-[#00f2ff]/20"
            >
              INDEX_CHART
            </button>
          )}
        </div>
      )}
      <table className="min-w-[1200px] w-full text-[10px] font-mono border-collapse">
        <thead className="sticky top-0 bg-[#0a0a0a] z-10">
          <tr className="border-b border-[#1c2127]">
            <th colSpan="7" className="py-2 text-[#00f2ff] bg-[#00f2ff]/5 border-r border-[#1c2127]">CALLS (BULL_V)</th>
            <th className="py-2 text-[#848e9c] text-center">STRIKE</th>
            <th colSpan="7" className="py-2 text-[#ff4d4d] bg-[#ff4d4d]/5 border-l border-[#1c2127]">PUTS (BEAR_V)</th>
          </tr>
          <tr className="text-[#5d606b] border-b border-[#1c2127] bg-[#0d0d0d]">
             <th className="py-2 px-1">IV</th>
             <th className="py-2 px-1">DELTA</th>
             <th className="py-2 px-1">VEGA</th>
             <th className="py-2 px-1">THETA</th>
             <th className="py-2 px-1 text-right">OI</th>
             <th className="py-2 px-1 text-right">VOLUME</th>
             <th className="py-2 px-1 text-[#00f2ff] text-right border-r border-[#1c2127]">LTP</th>
             <th className="py-2 px-2 bg-[#1c2127]/20 text-white font-bold text-center">PRICE</th>
             <th className="py-2 px-1 text-[#ff4d4d] text-left border-l border-[#1c2127]">LTP</th>
             <th className="py-2 px-1 text-left">VOLUME</th>
             <th className="py-2 px-1 text-left">OI</th>
             <th className="py-2 px-1">THETA</th>
             <th className="py-2 px-1">VEGA</th>
             <th className="py-2 px-1">DELTA</th>
             <th className="py-2 px-1">IV</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => {
            const isAtm = atmStrike != null && Number(row.strike_price) === atmStrike;
            return (
            <tr
              key={idx}
              ref={isAtm ? atmRowRef : undefined}
              className={`border-b border-[#1c2127]/30 hover:bg-white/5 transition-colors group ${
                isAtm ? 'bg-[#00f2ff]/15 ring-2 ring-inset ring-[#39ff14]/50 shadow-[0_0_12px_rgba(57,255,20,0.12)]' : ''
              }`}
            >
              {/* CALLS */}
              <td className="py-2 px-1 text-center text-[#555] group-hover:text-[#848e9c]">{fmt(row.call_iv, 1)}</td>
              <td className="py-2 px-1 text-center text-[#555] group-hover:text-[#848e9c]">{fmt(row.call_delta, 2)}</td>
              <td className="py-2 px-1 text-center text-[#555] group-hover:text-[#848e9c]">{fmt(row.call_vega, 2)}</td>
              <td className="py-2 px-1 text-center text-[#555] group-hover:text-[#848e9c]">{fmt(row.call_theta, 2)}</td>
              <td className="py-2 px-1 text-right text-[#848e9c]">{fmtInt(row.call_oi)}</td>
              <td className="py-2 px-1 text-right text-[#848e9c]">{fmtInt(row.call_volume)}</td>
              <td 
                onClick={() => onSelectContract(row.call_key)}
                className="py-2 px-1 text-right text-[#00f2ff] font-bold cursor-pointer hover:bg-[#00f2ff]/10 border-r border-[#1c2127]"
              >
                {fmt(row.call_ltp, 2)}
              </td>

              {/* STRIKE */}
              <td className={`py-2 px-2 text-center font-bold whitespace-nowrap shadow-[inset_0_0_10px_rgba(0,242,255,0.05)] ${
                isAtm ? 'bg-[#39ff14]/20 text-[#39ff14]' : 'bg-[#00f2ff]/5 text-white'
              }`}>
                {row.strike_price}
              </td>

              {/* PUTS */}
              <td 
                onClick={() => onSelectContract(row.put_key)}
                className="py-2 px-1 text-left text-[#ff4d4d] font-bold cursor-pointer hover:bg-[#ff4d4d]/10 border-l border-[#1c2127]"
              >
                {fmt(row.put_ltp, 2)}
              </td>
              <td className="py-2 px-1 text-left text-[#848e9c]">{fmtInt(row.put_volume)}</td>
              <td className="py-2 px-1 text-left text-[#848e9c]">{fmtInt(row.put_oi)}</td>
              <td className="py-2 px-1 text-left text-[#555] group-hover:text-[#848e9c]">{fmt(row.put_theta, 2)}</td>
              <td className="py-2 px-1 text-left text-[#555] group-hover:text-[#848e9c]">{fmt(row.put_vega, 2)}</td>
              <td className="py-2 px-1 text-left text-[#555] group-hover:text-[#848e9c]">{fmt(row.put_delta, 2)}</td>
              <td className="py-2 px-1 text-center text-[#555] group-hover:text-[#848e9c]">{fmt(row.put_iv, 1)}</td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default OptionChainTable;

import { useState, useEffect, useMemo } from 'react';
import CandlestickChart from './CandlestickChart';
import apiService from '../services/apiService';
import { INDICATORS } from '../lib/indicatorRegistry';
import { DEFAULT_PATTERNS } from '../lib/patternRegistry';

const defaultIndicators = () => Object.fromEntries(INDICATORS.map((ind) => [ind.id, false]));

/**
 * Full-screen modal: underlying index OHLC from ClickHouse (Upstox v3 sync).
 */
const IndexOhlcChartModal = ({ underlying, open, onClose }) => {
  const [timeframe, setTimeframe] = useState('1h');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const chartPatterns = useMemo(() => {
    const o = { ...DEFAULT_PATTERNS };
    Object.keys(o).forEach((k) => { o[k] = false; });
    return o;
  }, []);

  useEffect(() => {
    if (!open || !underlying) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiService.getIndexOhlc(underlying, timeframe, 8000);
        const rows = Array.isArray(res?.data) ? res.data : [];
        if (!cancelled) setData(rows);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [open, underlying, timeframe]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-md p-4">
      <div className="w-full max-w-6xl h-[85vh] flex flex-col border border-[#1c2127] rounded-xl bg-[#050505] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1c2127] bg-[#0a0a0a]">
          <div className="flex items-center gap-4">
            <span className="text-[#00f2ff] text-xs font-black tracking-[0.2em]">
              INDEX_OHLC / {underlying}
            </span>
            <div className="flex gap-1">
              {[
                { id: '1m', label: '1M' },
                { id: '1h', label: '1H' },
                { id: '1d', label: '1D' },
              ].map((tf) => (
                <button
                  key={tf.id}
                  type="button"
                  onClick={() => setTimeframe(tf.id)}
                  className={`px-2 py-1 text-[10px] font-bold rounded border ${
                    timeframe === tf.id
                      ? 'bg-[#00f2ff]/15 text-[#00f2ff] border-[#00f2ff]/40'
                      : 'text-[#5d606b] border-[#1c2127] hover:text-[#848e9c]'
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-[#ff4d4d]/10 text-[#ff4d4d] border border-[#ff4d4d]/20 rounded text-[10px] font-bold hover:bg-[#ff4d4d]/20"
          >
            CLOSE
          </button>
        </div>

        <div className="flex-1 min-h-0 relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/40">
              <div className="text-[#00f2ff] text-[10px] font-mono animate-pulse">LOADING_INDEX_BARS...</div>
            </div>
          )}
          {error && (
            <div className="absolute top-4 left-4 right-4 z-10 text-[#ff4d4d] text-xs border border-[#ff4d4d]/30 bg-[#ff4d4d]/5 px-3 py-2 rounded">
              {error}
            </div>
          )}
          {!loading && !error && data.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-[#5d606b] text-xs">
              No index bars in database yet. Wait for the hourly sync or enable INDEX_OHLC_V3_BACKFILL on the server.
            </div>
          )}
          {data.length > 0 && (
            <CandlestickChart
              data={data}
              news={[]}
              symbol={underlying}
              timeframe={timeframe}
              activeIndicators={defaultIndicators()}
              activePatterns={chartPatterns}
              showGrid
              onInfoClick={() => {}}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default IndexOhlcChartModal;

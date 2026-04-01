import { useState, useEffect } from 'react';
import CandlestickChart from './CandlestickChart';
import TimeframeSelector from './TimeframeSelector';
import useStockData from '../hooks/useStockData';
import Sidebar from './Sidebar';
import NewsList from './NewsList';
import TradeFeed from './TradeFeed';
import IndicatorPanel from './IndicatorPanel';
import PatternPanel from './PatternPanel';
import { INDICATORS } from '../lib/indicatorRegistry';
import { DEFAULT_PATTERNS } from '../lib/patternRegistry';
import { detectSMC } from '../lib/smc';
import './Dashboard.css'; // New CSS for premium styling

const buildDefaultIndicators = () =>
  Object.fromEntries(INDICATORS.map(ind => [ind.id, ind.enabled]));

const Dashboard = () => {
  const [selectedTimeframe, setSelectedTimeframe] = useState('1h');
  const [selectedSymbol, setSelectedSymbol] = useState('ABB');
  const [activeRightPanel, setActiveRightPanel] = useState('news');
  const [activeIndicators, setActiveIndicators] = useState(buildDefaultIndicators);
  const [activePatterns, setActivePatterns] = useState({ ...DEFAULT_PATTERNS });
  const { data, news, loading, error } = useStockData(selectedSymbol, selectedTimeframe);
  const [smcData, setSmcData] = useState({ suggestions: [] });

  useEffect(() => {
    if (data.length > 0) {
      const result = detectSMC(data);
      setSmcData(result);
    }
  }, [data]);

  // Global "Type to search" shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' || (e.key.length === 1 && /[a-zA-Z]/.test(e.key))) {
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
        if (e.key === '/') e.preventDefault();
        document.getElementById('symbol-search-input')?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const activeIndicatorCount = Object.values(activeIndicators).filter(Boolean).length;
  const activePatternCount  = Object.values(activePatterns).filter(Boolean).length;

  return (
    <div className="flex h-screen overflow-hidden elite-dashboard font-mono-elite">

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <Sidebar selectedSymbol={selectedSymbol} onSymbolChange={setSelectedSymbol} />

      {/* ── Main Column ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-[#1c2127]">

        {/* Top Bar — Elite Transparent System */}
        <div className="h-16 flex-shrink-0 bg-black/60 backdrop-blur-xl border-b border-[#1c2127]/50 flex items-center gap-6 px-6 relative z-[100]">

          {/* Symbol info */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-black text-xl text-[#00f2ff] tracking-tight">
                {selectedSymbol}
              </span>
              <span className="text-[10px] bg-[#00f2ff]/10 text-[#00f2ff] px-1.5 py-0.5 rounded border border-[#00f2ff]/20">PRO</span>
            </div>
            <span className="text-[9px] text-[#39ff14] font-bold tracking-[0.3em] uppercase opacity-80">
              Live_Uplink / {data.length} Bars
            </span>
          </div>

          <div className="w-px h-8 bg-[#1c2127]/50" />

          <TimeframeSelector selectedTimeframe={selectedTimeframe} onTimeframeChange={setSelectedTimeframe} />

          <div className="w-px h-8 bg-[#1c2127]/50" />

          {/* Indicator & Pattern toggle buttons */}
          <div className="flex items-center gap-2">
            <IndicatorPanel activeIndicators={activeIndicators} onToggle={(id, val) => setActiveIndicators(prev => ({ ...prev, [id]: val }))} />
            <PatternPanel activePatterns={activePatterns} onToggle={(id, val) => setActivePatterns(prev => ({ ...prev, [id]: val }))} />
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Real-time Stats */}
          <div className="flex items-center gap-6 text-[10px] font-bold">
            <div className="flex flex-col items-end">
              <span className="text-[#5d606b] text-[8px] uppercase">Active_Layer</span>
              <span className="text-[#00f2ff]">{activeIndicatorCount} IND / {activePatternCount} PTRN</span>
            </div>
            {data.length > 0 && (
              <div className="flex flex-col items-end">
                <span className="text-[#5d606b] text-[8px] uppercase">Market_Price</span>
                <span className="text-white text-lg tracking-tighter">
                  {data[data.length - 1]?.close?.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          <div className="w-px h-8 bg-[#1c2127]/50" />

          <div className="w-10 h-10 elite-button rounded-xl flex items-center justify-center cursor-pointer hover:shadow-[0_0_15px_#00f2ff33]">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"/></svg>
          </div>
        </div>

        {/* Chart Area */}
        <div className="flex-1 min-height-0 relative bg-black">

          {/* Loading System */}
          {loading && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-2 border-[#00f2ff] border-t-transparent rounded-full animate-spin shadow-[0_0_20px_#00f2ff33]" />
                <span className="text-[10px] tracking-[0.5em] text-[#00f2ff] font-bold animate-pulse">
                  SYNCING_ASSETS_
                </span>
              </div>
            </div>
          )}

          {/* Error Handling */}
          {error && (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-6">
              <div className="elite-panel border-[#ff003c55] p-8 max-w-sm text-center">
                <div className="text-[10px] color-[#ff003c] font-black tracking-[0.2em] mb-4">
                  CRITICAL_CONNECTION_FAILURE
                </div>
                <div className="text-sm text-[#848e9c] mb-6 leading-relaxed uppercase">{error}</div>
                <button
                  onClick={() => window.location.reload()}
                  className="w-full py-4 elite-button text-[#ff003c] border-[#ff003c33] rounded-lg tracking-widest text-[10px]"
                >
                  REBOOT_SYSTEM_
                </button>
              </div>
            </div>
          )}

          {/* No data state */}
          {!loading && !error && data.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <span className="text-[#1c2127] text-sm tracking-[0.4em] font-black italic">
                [ NO_OHLCV_INTEL_CAPTURED ]
              </span>
            </div>
          )}

          {/* The Chart */}
          {!loading && !error && data.length > 0 && (
            <CandlestickChart
              data={data}
              news={news}
              symbol={selectedSymbol}
              activeIndicators={activeIndicators}
              activePatterns={activePatterns}
            />
          )}
        </div>

        {/* Terminal Status Bar */}
        <div className="h-8 flex-shrink-0 bg-black border-t border-[#1c2127]/50 flex items-center justify-between px-6 text-[8px] font-mono tracking-widest text-[#333]">
          <div className="flex gap-6 items-center">
            <span className="text-[#39ff14] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#39ff14] animate-pulse" />
              STATUS: NOMINAL
            </span>
            <span>ENCRYPTION: SH-512</span>
            <span>BUFFER: {Math.floor(data.length / 10)}MB</span>
          </div>
          <div className="flex gap-6 items-center">
            <span className="text-[#5d606b]">{new Date().toISOString().replace('T', '_').slice(0, 19)}</span>
            <span className="text-[#00f2ff] font-bold bg-[#00f2ff]/5 px-2 py-0.5 rounded">ELITE_EDITION_V7.2</span>
          </div>
        </div>
      </div>


      {/* ── Right Intelligence Panel ──────────────────────────────────────── */}
      <div className="w-72 flex-shrink-0 flex flex-col bg-black border-l border-[#1c2127]">
        <div className="flex border-b border-[#1c2127] flex-shrink-0 bg-[#050505]">
          {['news', 'trades'].map(panel => (
            <button
              key={panel}
              onClick={() => setActiveRightPanel(panel)}
              className={`flex-1 py-4 text-[9px] font-black uppercase tracking-[0.2em] transition-all cursor-pointer ${
                activeRightPanel === panel 
                  ? 'text-[#00f2ff] border-b-2 border-[#00f2ff] bg-[#00f2ff]/5' 
                  : 'text-[#5d606b] border-b-2 border-transparent hover:text-[#848e9c]'
              }`}
            >
              {panel === 'news' ? 'Market_Intel' : 'SMC_Alpha'}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-hidden">
          {activeRightPanel === 'news' ? (
            <NewsList /> 
          ) : (
            <TradeFeed trades={smcData.suggestions} />
          )}
        </div>
      </div>


      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
      `}</style>
    </div>
  );
};

export default Dashboard;
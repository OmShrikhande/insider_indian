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

const buildDefaultIndicators = () =>
  Object.fromEntries(INDICATORS.map(ind => [ind.id, ind.enabled]));

const Dashboard = () => {
  const [selectedTimeframe, setSelectedTimeframe] = useState('1h');
  const [selectedSymbol, setSelectedSymbol] = useState('ABB');
  const [activeRightPanel, setActiveRightPanel] = useState('news');
  const [activeIndicators, setActiveIndicators] = useState(buildDefaultIndicators);
  const [activePatterns, setActivePatterns] = useState({ ...DEFAULT_PATTERNS });

  const { data, loading, error } = useStockData(selectedSymbol, selectedTimeframe);

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
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#000', color: '#848e9c' }}>

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <Sidebar selectedSymbol={selectedSymbol} onSymbolChange={setSelectedSymbol} />

      {/* ── Main Column ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, borderRight: '1px solid #1c2127' }}>

        {/* Top Bar — NO overflow:hidden so dropdowns can escape the bar */}
        <div style={{ height: 56, flexShrink: 0, background: '#000', borderBottom: '1px solid #1c2127', display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', position: 'relative', zIndex: 100 }}>

          {/* Symbol info */}
          <div style={{ display: 'flex', flexDirection: 'column', marginRight: 4 }}>
            <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 18, color: '#d1d4dc', lineHeight: 1 }}>
              {selectedSymbol}
            </span>
            <span style={{ fontSize: 9, color: '#39ff14', letterSpacing: '0.2em', fontWeight: 700 }}>
              LIVE · {data.length.toLocaleString()} BARS
            </span>
          </div>

          <div style={{ width: 1, height: 28, background: '#1c2127', flexShrink: 0 }} />

          <TimeframeSelector selectedTimeframe={selectedTimeframe} onTimeframeChange={setSelectedTimeframe} />

          <div style={{ width: 1, height: 28, background: '#1c2127', flexShrink: 0 }} />

          {/* Indicator & Pattern toggle buttons */}
          <IndicatorPanel activeIndicators={activeIndicators} onToggle={(id, val) => setActiveIndicators(prev => ({ ...prev, [id]: val }))} />
          <PatternPanel activePatterns={activePatterns} onToggle={(id, val) => setActivePatterns(prev => ({ ...prev, [id]: val }))} />

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Stats */}
          <div style={{ display: 'flex', gap: 16, fontSize: 10, fontFamily: 'monospace', color: '#5d606b', flexShrink: 0 }}>
            {activeIndicatorCount > 0 && (
              <span style={{ color: '#00f2ff' }}>{activeIndicatorCount} indicators</span>
            )}
            {activePatternCount > 0 && (
              <span style={{ color: '#39ff14' }}>{activePatternCount} patterns</span>
            )}
            {data.length > 0 && (
              <span style={{ color: '#d1d4dc', fontWeight: 700 }}>
                {data[data.length - 1]?.close?.toFixed(2)}
              </span>
            )}
          </div>

          <div style={{ width: 1, height: 28, background: '#1c2127', flexShrink: 0 }} />

          <div style={{ width: 28, height: 28, border: '1px solid #1c2127', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#5d606b', fontSize: 14, flexShrink: 0 }}>
            ★
          </div>
        </div>

        {/* Chart Area — CRITICAL: use flex:1 with minHeight:0 to prevent overflow */}
        <div style={{ flex: 1, minHeight: 0, position: 'relative', background: '#000' }}>

          {/* Loading */}
          {loading && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 40, height: 40, border: '2px solid #00f2ff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <span style={{ fontSize: 9, letterSpacing: '0.3em', color: '#00f2ff', fontFamily: 'monospace', fontWeight: 700 }}>
                  FETCHING {selectedSymbol}…
                </span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: '#060000', border: '1px solid rgba(255,0,60,0.5)', padding: 24, borderRadius: 8, maxWidth: 360 }}>
                <div style={{ fontSize: 10, color: '#ff003c', fontWeight: 700, letterSpacing: '0.2em', marginBottom: 8 }}>
                  ● LINK ERROR
                </div>
                <div style={{ fontSize: 12, color: '#848e9c', fontFamily: 'monospace' }}>{error}</div>
                <button
                  onClick={() => window.location.reload()}
                  style={{ marginTop: 16, width: '100%', padding: '8px 0', fontSize: 10, fontWeight: 700, color: '#ff003c', background: 'transparent', border: '1px solid rgba(255,0,60,0.3)', borderRadius: 4, cursor: 'pointer', letterSpacing: '0.15em' }}
                >
                  RECONNECT
                </button>
              </div>
            </div>
          )}

          {/* No data */}
          {!loading && !error && data.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <span style={{ color: '#1c2127', fontFamily: 'monospace', fontSize: 13, letterSpacing: '0.25em' }}>
                [ NO DATA — {selectedSymbol} {selectedTimeframe} ]
              </span>
            </div>
          )}

          {/* Chart */}
          {!loading && !error && data.length > 0 && (
            <CandlestickChart
              data={data}
              symbol={selectedSymbol}
              activeIndicators={activeIndicators}
              activePatterns={activePatterns}
            />
          )}
        </div>

        {/* Status bar */}
        <div style={{ height: 28, flexShrink: 0, background: '#000', borderTop: '1px solid #1c2127', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', fontSize: 9, fontFamily: 'monospace', color: '#5d606b' }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <span style={{ color: '#39ff14', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#39ff14', display: 'inline-block', animation: 'pulse 2s infinite' }} />
              UPLINK: ACTIVE
            </span>
            <span>AES-256</span>
            <span>ClickHouse_P99</span>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <span>{new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC</span>
            <span style={{ color: '#00f2ff' }}>ProTrader v7.0</span>
          </div>
        </div>
      </div>

      {/* ── Right Intelligence Panel ──────────────────────────────────────── */}
      <div style={{ width: 288, flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#000', borderLeft: '1px solid #1c2127' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #1c2127', flexShrink: 0 }}>
          {['news', 'trades'].map(panel => (
            <button
              key={panel}
              onClick={() => setActiveRightPanel(panel)}
              style={{
                flex: 1, padding: '12px 0', fontSize: 9, fontWeight: 700, letterSpacing: '0.2em',
                textTransform: 'uppercase', background: 'transparent', border: 'none', cursor: 'pointer',
                borderBottom: activeRightPanel === panel ? '2px solid #00f2ff' : '2px solid transparent',
                color: activeRightPanel === panel ? '#00f2ff' : '#5d606b',
                transition: 'all 0.2s',
              }}
            >
              {panel === 'news' ? 'Intelligence' : 'Futuristic'}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {activeRightPanel === 'news' ? <NewsList /> : <TradeFeed />}
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
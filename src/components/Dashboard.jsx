import { useState, useEffect, useMemo } from 'react';
import Sidebar from './Sidebar';
import AuthModal from './AuthModal';
import authService from '../services/authService';
import useStockData from '../hooks/useStockData';
import useFnoData from '../hooks/useFnoData';
import { useFnoLogic } from '../hooks/useFnoLogic';
import { detectSMC, detectChainSMC } from '../lib/smc';
import apiService from '../services/apiService';
import { INDICATORS } from '../lib/indicatorRegistry';
import { DEFAULT_PATTERNS } from '../lib/patternRegistry';

// Modularized Components
import DashboardTopBar from './DashboardTopBar';
import MainChartArea from './MainChartArea';
import ScreenerPanel from './ScreenerPanel';
import NewsList from './NewsList';
import TradeFeed from './TradeFeed';
import ResearchPanel from './ResearchPanel';
import AlphaChatPanel from './AlphaChatPanel';
import ResearchAnalystPanel from './ResearchAnalystPanel';

import './Dashboard.css';

const buildDefaultIndicators = () =>
  Object.fromEntries(INDICATORS.map(ind => [ind.id, ind.enabled]));

import OptionChainTable from './OptionChainTable';
import IndexOhlcChartModal from './IndexOhlcChartModal';

const FNO_ALLOWED = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY'];

/**
 * Dashboard - Core platform layout.
 * ROAST FIX: Transformed from an 800-line "God Component" into a clean layout orchestrator.
 */
const Dashboard = () => {
  const readStored = (key, fallback) => {
    try {
      const value = localStorage.getItem(key);
      if (value == null) return fallback;
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  };
  // --- Core State ---
  const [selectedTimeframe, setSelectedTimeframe] = useState(() => readStored('roxey_selected_timeframe', '1h'));
  const [selectedSymbol, setSelectedSymbol] = useState(() => readStored('roxey_selected_symbol', 'ABB'));
  const [activeRightPanel, setActiveRightPanel] = useState(() => readStored('roxey_active_panel', 'news'));
  const [activeIndicators, setActiveIndicators] = useState(buildDefaultIndicators);
  const [activePatterns, setActivePatterns] = useState({ ...DEFAULT_PATTERNS });
  const [showGrid, setShowGrid] = useState(false);
  const [candleStyle, setCandleStyle] = useState('default');
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(false);
  const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState(false);
  const [currentUser, setCurrentUser] = useState(authService.getCurrentUser());
  const [showScreener, setShowScreener] = useState(false);
  const [showOptionChain, setShowOptionChain] = useState(false);
  const [showSuggestScreen, setShowSuggestScreen] = useState(false);
  const [showIndexChart, setShowIndexChart] = useState(false);
  const [smcData, setSmcData] = useState({ suggestions: [] });
  const [chainRows, setChainRows] = useState([]);
  const [fnoIndexSpotData, setFnoIndexSpotData] = useState([]);
  const [fnoIndexSpotLoading, setFnoIndexSpotLoading] = useState(false);
  const [fnoModeHydrated, setFnoModeHydrated] = useState(false);
  const [focusedTrade, setFocusedTrade] = useState(null);

  // --- Specialized Hooks ---
  const { data, loading, error } = useStockData(selectedSymbol, selectedTimeframe);
  const fnoLogic = useFnoLogic(selectedSymbol, data);
  const fnoData = useFnoData(selectedSymbol, fnoLogic.fnoExpiry, fnoLogic.fnoStrike, selectedTimeframe);
  const setFnoMode = fnoLogic.setIsFnoMode;
  useEffect(() => {
    localStorage.setItem('roxey_selected_symbol', JSON.stringify(selectedSymbol));
  }, [selectedSymbol]);

  useEffect(() => {
    localStorage.setItem('roxey_selected_timeframe', JSON.stringify(selectedTimeframe));
  }, [selectedTimeframe]);

  useEffect(() => {
    localStorage.setItem('roxey_active_panel', JSON.stringify(activeRightPanel));
  }, [activeRightPanel]);

  useEffect(() => {
    localStorage.setItem('roxey_fno_mode', JSON.stringify(fnoLogic.isFnoMode));
  }, [fnoLogic.isFnoMode]);

  useEffect(() => {
    const savedFnoMode = readStored('roxey_fno_mode', false);
    if (!savedFnoMode) return;
    setFnoMode(true);
    setSelectedSymbol((prev) =>
      FNO_ALLOWED.includes(String(prev || '').toUpperCase()) ? prev : 'NIFTY'
    );
    setFnoModeHydrated(true);
  }, [setFnoMode]);

  useEffect(() => {
    if (fnoModeHydrated) return;
    setFnoModeHydrated(true);
  }, [fnoModeHydrated]);


  // --- Effects ---
  useEffect(() => {
    if (data.length > 0) setSmcData(detectSMC(data, selectedSymbol));
  }, [data, selectedSymbol]);

  useEffect(() => {
    const loadChainRows = async () => {
      if (!fnoLogic.isFnoMode || !fnoLogic.fnoExpiry) {
        setChainRows([]);
        return;
      }
      try {
        const resolvedKey = selectedSymbol?.includes('|')
          ? selectedSymbol
          : ({
            NIFTY: 'NSE_INDEX|Nifty 50',
            BANKNIFTY: 'NSE_INDEX|Nifty Bank',
            FINNIFTY: 'NSE_INDEX|Nifty Fin Service',
            MIDCPNIFTY: 'NSE_INDEX|Nifty Mid Select',
          }[String(selectedSymbol || '').toUpperCase()] || `NSE_EQ|${String(selectedSymbol || '').toUpperCase()}`);

        const response = await apiService.getOptionChainByInstrument(resolvedKey, fnoLogic.fnoExpiry);
        const rows = Array.isArray(response?.data) ? response.data : [];
        setChainRows(rows);
      } catch {
        setChainRows([]);
      }
    };
    loadChainRows();
  }, [fnoLogic.isFnoMode, fnoLogic.fnoExpiry, selectedSymbol]);

  const chainTrades = useMemo(
    () => detectChainSMC(chainRows, selectedSymbol, fnoLogic.fnoExpiry),
    [chainRows, selectedSymbol, fnoLogic.fnoExpiry]
  );
  const allTrades = useMemo(
    () => [...chainTrades, ...(smcData.suggestions || [])],
    [chainTrades, smcData.suggestions]
  );

  const indexUnderlyingForChart = useMemo(() => {
    const s = String(selectedSymbol || '').trim();
    const u = s.toUpperCase();
    if (['NIFTY', 'BANKNIFTY', 'FINNIFTY'].includes(u)) return u;
    if (s.includes('Nifty 50') || s.includes('NIFTY 50')) return 'NIFTY';
    if (s.includes('Nifty Bank')) return 'BANKNIFTY';
    if (s.includes('Nifty Fin')) return 'FINNIFTY';
    return null;
  }, [selectedSymbol]);

  const chainSpotPrice = useMemo(() => {
    const v = chainRows[0]?.underlying_spot_price;
    return v != null && !Number.isNaN(Number(v)) ? Number(v) : null;
  }, [chainRows]);

  useEffect(() => {
    if (!fnoLogic.isFnoMode || !indexUnderlyingForChart) {
      setFnoIndexSpotData([]);
      setFnoIndexSpotLoading(false);
      return undefined;
    }
    let cancelled = false;
    setFnoIndexSpotLoading(true);
    (async () => {
      try {
        const res = await apiService.getIndexOhlc(indexUnderlyingForChart, selectedTimeframe, 8000);
        const rows = Array.isArray(res?.data) ? res.data : [];
        if (!cancelled) setFnoIndexSpotData(rows);
      } catch {
        if (!cancelled) setFnoIndexSpotData([]);
      } finally {
        if (!cancelled) setFnoIndexSpotLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fnoLogic.isFnoMode, indexUnderlyingForChart, selectedTimeframe]);

  // Global Hotkeys & Listeners
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeTag = document.activeElement.tagName;
      const isInputOpen = ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag);

      if (e.ctrlKey && e.key.toLowerCase() === 'b') { e.preventDefault(); setIsLeftSidebarCollapsed(p => !p); return; }
      if (e.ctrlKey && e.key.toLowerCase() === 'i') { e.preventDefault(); setIsRightSidebarCollapsed(p => !p); return; }
      if (isInputOpen) return;

      const hotkeys = {
        'g': () => setShowGrid(p => !p),
        'n': () => setActiveRightPanel('news'),
        't': () => setActiveRightPanel('trades'),
        'r': () => setActiveRightPanel('research'),
        'a': () => setActiveRightPanel('alpha'),
        'o': () => setShowOptionChain(p => !p),
      };

      if (hotkeys[e.key.toLowerCase()]) hotkeys[e.key.toLowerCase()]();
      if (e.key === '/' || (e.key.length === 1 && /[a-zA-Z]/.test(e.key))) {
        if (e.key === '/') e.preventDefault();
        document.getElementById('symbol-search-input')?.focus();
      }
    };

    const handleInfoClick = (e) => {
      setSelectedSymbol(e.detail.symbol);
      setIsRightSidebarCollapsed(false);
    };
    const handleFocusTrade = (e) => {
      const trade = e?.detail || null;
      if (!trade) return;
      const symbolFromTrade = String(trade.symbol || '').trim().split(' ')[0];
      if (symbolFromTrade) setSelectedSymbol(symbolFromTrade);
      setFocusedTrade({ ...trade, _focusAt: Date.now() });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('roxey-info-click', handleInfoClick);
    window.addEventListener('roxey-focus-trade', handleFocusTrade);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('roxey-info-click', handleInfoClick);
      window.removeEventListener('roxey-focus-trade', handleFocusTrade);
    };
  }, []);

  if (!currentUser) return <AuthModal onLoginSuccess={setCurrentUser} />;

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
  };

  const activeIndicatorCount = Object.values(activeIndicators).filter(Boolean).length;

  return (
    <div className="flex h-screen overflow-hidden elite-dashboard font-mono-elite bg-black">
      {showScreener && <ScreenerPanel onClose={() => setShowScreener(false)} isRightSidebarCollapsed={isRightSidebarCollapsed} />}
      {showIndexChart && indexUnderlyingForChart && (
        <IndexOhlcChartModal
          underlying={indexUnderlyingForChart}
          open={showIndexChart}
          onClose={() => setShowIndexChart(false)}
        />
      )}

      <Sidebar
        selectedSymbol={selectedSymbol}
        onSymbolChange={setSelectedSymbol}
        isCollapsed={isLeftSidebarCollapsed}
        onToggleCollapse={() => setIsLeftSidebarCollapsed(p => !p)}
        onFnoModeChange={(enabled) => {
          fnoLogic.setIsFnoMode(enabled);
          if (enabled && !FNO_ALLOWED.includes(String(selectedSymbol || '').toUpperCase())) {
            setSelectedSymbol('NIFTY');
          }
        }}
        onFnoExpirySelect={(expiry) => {
          if (expiry) {
            fnoLogic.setFnoStrike('');
            fnoLogic.setFnoExpiry(expiry);
          }
        }}
      />

      <div className="flex-1 flex flex-col min-w-0 border-r border-[#1c2127]">
        <DashboardTopBar 
          selectedSymbol={selectedSymbol}
          dataCount={data.length}
          onShowScreener={() => setShowScreener(true)}
          isFnoMode={fnoLogic.isFnoMode}
          onToggleFnoMode={() => fnoLogic.setIsFnoMode(!fnoLogic.isFnoMode)}
          fnoExpiry={fnoLogic.fnoExpiry}
          onFnoExpiryChange={e => { fnoLogic.setFnoStrike(''); fnoLogic.setFnoExpiry(e.target.value); }}
          fnoStrike={fnoLogic.fnoStrike}
          onFnoStrikeChange={e => fnoLogic.setFnoStrike(e.target.value)}
          availableExpiries={fnoLogic.availableExpiries}
          availableStrikes={fnoLogic.availableStrikes}
          selectedTimeframe={selectedTimeframe}
          onTimeframeChange={setSelectedTimeframe}
          activeIndicators={activeIndicators}
          onIndicatorToggle={(id, val) => setActiveIndicators(p => ({ ...p, [id]: val }))}
          activePatterns={activePatterns}
          onPatternToggle={(id, val) => setActivePatterns(p => ({ ...p, [id]: val }))}
          showGrid={showGrid}
          onToggleGrid={() => setShowGrid(p => !p)}
          candleStyle={candleStyle}
          onCandleStyleChange={setCandleStyle}
          showSuggestScreen={showSuggestScreen}
          onToggleSuggestScreen={() => setShowSuggestScreen((p) => !p)}
          onLogout={handleLogout}
          currentUser={currentUser}
          showOptionChain={showOptionChain}
          onToggleOptionChain={() => setShowOptionChain(p => !p)}
        />

        <div className="flex-1 min-height-0 relative bg-black z-0">
          {showOptionChain && fnoLogic.fnoExpiry ? (
            <div className="absolute inset-0 z-[200] bg-[#050505] p-6 overflow-hidden flex flex-col border border-[#1c2127] shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[#00f2ff] font-bold text-xs tracking-widest uppercase">
                  Option_Chain: {selectedSymbol} @ {fnoLogic.fnoExpiry}
                </h3>
                <button 
                  onClick={() => setShowOptionChain(false)}
                  className="px-3 py-1 bg-[#ff4d4d]/10 text-[#ff4d4d] border border-[#ff4d4d]/20 rounded text-[10px] font-bold hover:bg-[#ff4d4d]/20"
                >
                  CLOSE_X
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <OptionChainTable 
                  symbol={selectedSymbol} 
                  instrumentKey={
                    selectedSymbol?.includes('|')
                      ? selectedSymbol
                      : ({
                        NIFTY: 'NSE_INDEX|Nifty 50',
                        BANKNIFTY: 'NSE_INDEX|Nifty Bank',
                        FINNIFTY: 'NSE_INDEX|Nifty Fin Service',
                        MIDCPNIFTY: 'NSE_INDEX|Nifty Mid Select',
                      }[String(selectedSymbol || '').toUpperCase()] || `NSE_EQ|${String(selectedSymbol || '').toUpperCase()}`)
                  }
                  expiry={fnoLogic.fnoExpiry}
                  spotPrice={chainSpotPrice}
                  onOpenIndexChart={indexUnderlyingForChart ? () => setShowIndexChart(true) : undefined}
                  onSelectContract={(key) => {
                    // Logic to handle contract selection from chain
                    console.log('Selected contract:', key);
                  }}
                />
              </div>
            </div>
          ) : null}
          {showSuggestScreen ? (
            <div className="absolute inset-0 z-[220] bg-[#050505] border border-[#1c2127] shadow-2xl flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#1c2127] bg-[#0a0a0a]">
                <div className="text-[#00f2ff] text-xs font-black tracking-widest uppercase">
                  Suggest_Trade_Screen
                </div>
                <button
                  type="button"
                  onClick={() => setShowSuggestScreen(false)}
                  className="px-3 py-1 bg-[#ff4d4d]/10 text-[#ff4d4d] border border-[#ff4d4d]/20 rounded text-[10px] font-bold hover:bg-[#ff4d4d]/20"
                >
                  CLOSE_X
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                <ResearchAnalystPanel />
              </div>
            </div>
          ) : null}

          <div className={`absolute inset-0 z-0 min-h-0 ${showOptionChain && fnoLogic.fnoExpiry ? 'pointer-events-none opacity-0' : ''}`} aria-hidden={showOptionChain && fnoLogic.fnoExpiry ? true : undefined}>
          <MainChartArea 
            loading={loading}
            error={error}
            data={data}
            isFnoMode={fnoLogic.isFnoMode}
            selectedSymbol={selectedSymbol}
            selectedTimeframe={selectedTimeframe}
            activeIndicators={activeIndicators}
            activePatterns={activePatterns}
            showGrid={showGrid}
            candleStyle={candleStyle}
            onInfoClick={(sym) => { setSelectedSymbol(sym); setIsRightSidebarCollapsed(false); }}
            fnoData={fnoData}
            fnoStrike={fnoLogic.fnoStrike}
            fnoSpotData={fnoIndexSpotData}
            fnoSpotLoading={fnoIndexSpotLoading}
            focusedTrade={focusedTrade}
          />
          </div>
        </div>

        {/* Status Bar */}
        <div className="h-8 flex-shrink-0 bg-black border-t border-[#1c2127]/50 flex items-center justify-between px-6 text-[8px] font-mono tracking-widest text-[#333]">
          <div className="flex gap-6 items-center">
            <span className="text-[#39ff14] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#39ff14] animate-pulse" />
              STATUS: NOMINAL
            </span>
            <span>ENCRYPTION: SH-256</span>
            <span>UPLINK: ACTIVE / {activeIndicatorCount}IND</span>
          </div>
          <span className="text-[#00f2ff] font-bold bg-[#00f2ff]/5 px-2 py-0.5 rounded uppercase tracking-[0.2em]">ROXEY_PRO_EDITION_V8.5_REFACTORED</span>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className={`${isRightSidebarCollapsed ? 'w-12' : 'w-72'} flex-shrink-0 flex flex-col bg-black border-l border-[#1c2127] transition-all duration-200 z-[100]`}>
        <div className="flex border-b border-[#1c2127] flex-shrink-0 bg-[#050505]">
          <button onClick={() => setIsRightSidebarCollapsed(p => !p)} className="px-2 w-12 text-[#848e9c] hover:text-[#00f2ff] transition-colors text-lg italic font-serif">i</button>
          {!isRightSidebarCollapsed && ['news', 'trades', 'research', 'alpha'].map(panel => (
            <button key={panel} onClick={() => setActiveRightPanel(panel)} className={`flex-1 py-3 text-[7px] font-black uppercase tracking-[0.15em] transition-all ${activeRightPanel === panel ? 'text-[#00f2ff] border-b-2 border-[#00f2ff] bg-[#00f2ff]/5' : 'text-[#5d606b] border-b-2 border-transparent hover:text-[#848e9c]'}`}>
              {panel === 'news' ? 'Intel' : panel === 'trades' ? 'SMC' : panel === 'research' ? 'Data' : 'Alpha'}
            </button>
          ))}
        </div>
        {!isRightSidebarCollapsed && (
          <div className="flex-1 overflow-hidden">
            {activeRightPanel === 'news' && <NewsList selectedSymbol={selectedSymbol} />}
            {activeRightPanel === 'trades' && <TradeFeed trades={allTrades} />}
            {activeRightPanel === 'research' && <ResearchPanel selectedSymbol={selectedSymbol} />}
            {activeRightPanel === 'alpha' && (
              <AlphaChatPanel
                selectedSymbol={selectedSymbol}
                isFnoMode={fnoLogic.isFnoMode}
                fnoExpiry={fnoLogic.fnoExpiry}
              />
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
      `}</style>
    </div>
  );
};

export default Dashboard;
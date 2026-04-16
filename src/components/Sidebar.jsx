import { useState, useEffect, memo, useMemo } from 'react';
import apiService from '../services/apiService';

const SidebarItem = memo(({ s, selectedSymbol, onSymbolChange, inWatchlist, onToggleWatchlist, compact }) => {
  return (
    <button
      onClick={() => onSymbolChange(s.symbol)}
      className={`w-full text-left ${compact ? 'px-2 py-2' : 'px-4 py-3'} rounded-lg transition-all flex items-center justify-between group relative overflow-hidden elite-sidebar-item ${
        selectedSymbol === s.symbol
          ? 'bg-[#00f2ff]/10 text-[#00f2ff] border-l-2 border-l-[#00f2ff]'
          : 'text-[#848e9c] hover:bg-white/5 hover:text-[#d1d4dc]'
      }`}
      title={s.symbol}
    >
      <div className="flex flex-col">
        <span className="font-mono font-bold tracking-tight text-xs">{compact ? s.symbol.slice(0, 4) : s.symbol}</span>
        {!compact && <span className="text-[8px] text-[#5d606b] uppercase tracking-tighter">NSE_INDEX</span>}
      </div>
      {!compact && (
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded-sm ${
              selectedSymbol === s.symbol ? 'bg-[#00f2ff]/20 text-[#00f2ff]' : 'bg-[#1c2127] text-[#555]'
            }`}>
              {s.in_hourly || s.in_daily ? 'REC' : 'SYS'}
            </span>
          </div>
          <div
            onClick={(e) => onToggleWatchlist(e, s.symbol)}
            className={`cursor-pointer text-[14px] transition-colors ${
              inWatchlist ? 'text-[#ffea00] hover:text-[#ffd600] drop-shadow-[0_0_5px_#ffea00aa]' : 'text-[#333] hover:text-[#848e9c]'
            }`}
          >
            {inWatchlist ? '★' : '☆'}
          </div>
        </div>
      )}
    </button>
  );
});
SidebarItem.displayName = 'SidebarItem';

const Sidebar = ({ selectedSymbol, onSymbolChange, isCollapsed = false, onToggleCollapse }) => {
  const [symbols, setSymbols] = useState([]);
  const [fnoSymbols, setFnoSymbols] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('all'); // all | watchlist | fno
  const [watchlist, setWatchlist] = useState([]);

  useEffect(() => {
    const fetchWatchlist = async () => {
      try {
        const response = await apiService.getWatchlist();
        if (response.success && Array.isArray(response.data)) {
          setWatchlist(response.data);
        }
      } catch (err) {
        console.error('Failed to load watchlist:', err);
      }
    };
    fetchWatchlist();
  }, []);

  useEffect(() => {
    const fetchFno = async () => {
      try {
        const response = await apiService.getFnoContracts('', 100);
        if (response?.success && Array.isArray(response.data)) {
          setFnoSymbols(response.data.map((item) => ({
            symbol: item.underlying_symbol || item.trading_symbol,
            in_hourly: 1,
            in_daily: 1,
          })));
        }
      } catch (err) {
        console.error('Failed to fetch FNO list', err);
      }
    };
    fetchFno();
  }, []);

  useEffect(() => {
    const fetchTopSymbols = async () => {
      try {
        setLoading(true);
        const response = await apiService.searchSymbols('');
        if (response) {
          const data = Array.isArray(response) ? response : (response.data || []);
          setSymbols(data);
        }
      } catch (err) {
        console.error('Failed to fetch symbols', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTopSymbols();
  }, []);

  const handleSearch = async (query) => {
    setSearch(query);
    const response = await apiService.searchSymbols(query || '');
    if (response) {
      const data = Array.isArray(response) ? response : (response.data || []);
      setSymbols(data);
    }
  };

  const symbolMap = useMemo(() => new Map(symbols.map((item) => [item.symbol, item])), [symbols]);
  const displayedSymbols = useMemo(() => {
    if (viewMode === 'watchlist') {
      return watchlist.map((sym) => symbolMap.get(sym) || { symbol: sym, in_hourly: 1, in_daily: 1 });
    }
    if (viewMode === 'fno') {
      return fnoSymbols;
    }
    return symbols;
  }, [symbols, viewMode, watchlist, symbolMap, fnoSymbols]);

  const handleToggleWatchlist = async (e, symbol) => {
    e.stopPropagation();
    try {
      const response = await apiService.toggleWatchlist(symbol);
      if (response.success) {
        setWatchlist((prev) => (
          response.action === 'added'
            ? Array.from(new Set([...prev, symbol]))
            : prev.filter((s) => s !== symbol)
        ));
      }
    } catch (err) {
      console.error('Failed to toggle watchlist:', err);
    }
  };

  return (
    <div className={`${isCollapsed ? 'w-16' : 'w-64'} elite-panel border-r border-[#1c2127] flex flex-col h-full bg-[#000000] transition-all duration-200`}>
      <div className="p-4 border-b border-[#1c2127]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#00f2ff] flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-[#00f2ff] rounded-full shadow-[0_0_8px_#00f2ff]"></span>
            {!isCollapsed && 'Roxey_Scan / Node 01'}
          </h2>
          <button onClick={onToggleCollapse} className="text-[#848e9c] hover:text-[#00f2ff] transition-colors" title={isCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}>
            {isCollapsed ? '»' : '«'}
          </button>
        </div>

        {!isCollapsed && (
          <>
            <div className="relative mb-3">
              <input
                type="text"
                placeholder="TYPE SYMBOL_ (/)"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#1c2127] rounded-lg px-3 py-2.5 text-xs text-[#d1d4dc] focus:outline-none focus:border-[#00f2ff] font-mono transition-all placeholder:text-[#333] elite-card"
                id="symbol-search-input"
                autoComplete="off"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('all')}
                className={`flex-1 py-1 text-[8px] font-bold uppercase rounded border transition-all ${
                  viewMode === 'all' ? 'bg-[#00f2ff]/10 border-[#00f2ff] text-[#00f2ff]' : 'bg-transparent border-[#1c2127] text-[#5d606b]'
                }`}
              >
                All_Intel
              </button>
              <button
                onClick={() => setViewMode('watchlist')}
                className={`flex-1 py-1 text-[8px] font-bold uppercase rounded border transition-all ${
                  viewMode === 'watchlist' ? 'bg-[#ffea00]/10 border-[#ffea00] text-[#ffea00]' : 'bg-transparent border-[#1c2127] text-[#5d606b]'
                }`}
              >
                Watchlist
              </button>
              <button
                onClick={() => setViewMode('fno')}
                className={`flex-1 py-1 text-[8px] font-bold uppercase rounded border transition-all ${
                  viewMode === 'fno' ? 'bg-[#39ff14]/10 border-[#39ff14] text-[#39ff14]' : 'bg-transparent border-[#1c2127] text-[#5d606b]'
                }`}
              >
                F&O
              </button>
            </div>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-2 py-4">
        <div className="space-y-1">
          {loading && (
            <div className="px-4 py-8 flex flex-col items-center gap-3">
              <div className="w-4 h-4 border border-[#00f2ff] border-t-transparent rounded-full animate-spin"></div>
              <span className="text-[9px] text-[#5d606b] uppercase animate-pulse font-mono">Syncing_Protocol...</span>
            </div>
          )}
          {!loading && displayedSymbols.length === 0 && (
            <div className="px-4 py-8 text-center text-[#1c2127] text-[10px] uppercase font-mono">[ NO_INTEL_FOUND ]</div>
          )}
          {displayedSymbols.map((s) => (
            <SidebarItem
              key={s.symbol}
              s={s}
              selectedSymbol={selectedSymbol}
              onSymbolChange={onSymbolChange}
              inWatchlist={watchlist.includes(s.symbol)}
              onToggleWatchlist={handleToggleWatchlist}
              compact={isCollapsed}
            />
          ))}
        </div>
      </div>

      {!isCollapsed && (
        <div className="p-4 mt-auto border-t border-[#1c2127] bg-[#000]">
          <div className="flex flex-col gap-2">
            <div className="text-[9px] text-[#39ff14] flex items-center gap-2 font-mono font-bold">
              <div className="w-1.5 h-1.5 rounded-full bg-[#39ff14] animate-pulse"></div>
              ENCRYPTED_UPLINK [O3-V]
            </div>
            <div className="flex justify-between items-center text-[8px] text-[#333] font-mono uppercase">
              <span>V7_SECURE</span>
              <span>Latency: {Math.floor(Math.random() * 20)}ms</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;

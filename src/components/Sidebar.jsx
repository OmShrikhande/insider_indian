import { useState, useEffect, memo, useMemo, useRef, useCallback } from 'react';
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

const Sidebar = ({
  selectedSymbol,
  onSymbolChange,
  isCollapsed = false,
  onToggleCollapse,
  onFnoModeChange,
  onFnoExpirySelect,
}) => {
  const [symbols, setSymbols] = useState([]);
  const [fnoSymbols, setFnoSymbols] = useState([]);
  const [fnoExpiriesMap, setFnoExpiriesMap] = useState({});
  const [selectedFnoExpiry, setSelectedFnoExpiry] = useState('');
  const [chainPreview, setChainPreview] = useState([]);
  const [fnoMetaLoading, setFnoMetaLoading] = useState(false);
  const [search, setSearch] = useState('');
  const searchDebounceRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('all'); // all | watchlist | fno
  const [watchlist, setWatchlist] = useState([]);

  useEffect(() => () => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
  }, []);

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
        const response = await apiService.getFnoContracts('', 120);
        if (response?.success && Array.isArray(response.data)) {
          const optionContracts = response.data.filter((item) => {
            const type = String(item.option_type || item.instrument_type || '').toUpperCase();
            return type === 'CE' || type === 'PE';
          });

          const groupedExpiries = optionContracts.reduce((acc, row) => {
            const u = (row.underlying_symbol || '').toUpperCase();
            const e = row.expiry;
            if (!u || !e) return acc;
            if (!acc[u]) acc[u] = new Set();
            acc[u].add(e);
            return acc;
          }, {});

          const mapWithArrays = Object.fromEntries(
            Object.entries(groupedExpiries).map(([u, expSet]) => [u, Array.from(expSet).sort()])
          );
          setFnoExpiriesMap(mapWithArrays);

          const uniq = Object.keys(mapWithArrays);
          setFnoSymbols(uniq.map((symbol) => ({
            symbol,
            in_hourly: 1,
            in_daily: 1,
          })));

          if (uniq.length > 0) {
            const firstExpiry = mapWithArrays[uniq[0]]?.[0] || '';
            if (firstExpiry) setSelectedFnoExpiry((prev) => prev || firstExpiry);
          }
        }
      } catch (err) {
        console.error('Failed to fetch FNO list', err);
        const fallback = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY'];
        setFnoSymbols(fallback.map((symbol) => ({ symbol, in_hourly: 1, in_daily: 1 })));
      }
    };
    fetchFno();
  }, [onFnoExpirySelect]);

  useEffect(() => {
    if (!selectedFnoExpiry) return;
    onFnoExpirySelect?.(selectedFnoExpiry);
  }, [selectedFnoExpiry, onFnoExpirySelect]);

  useEffect(() => {
    const loadChainPreview = async () => {
      if (viewMode !== 'fno' || !selectedSymbol || !selectedFnoExpiry) {
        setChainPreview([]);
        return;
      }

      try {
        setFnoMetaLoading(true);
        const instrumentKey = apiService.resolveFnoInstrumentKey(selectedSymbol);
        const response = await apiService.getOptionChainByInstrument(instrumentKey, selectedFnoExpiry);
        if ((response?.success || response?.status === 'success') && Array.isArray(response.data)) {
          setChainPreview(response.data.slice(0, 14));
        } else {
          setChainPreview([]);
        }
      } catch (err) {
        console.error('Failed to load option-chain preview:', err);
        setChainPreview([]);
      } finally {
        setFnoMetaLoading(false);
      }
    };

    loadChainPreview();
  }, [viewMode, selectedSymbol, selectedFnoExpiry]);

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

  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const handleSearch = useCallback((query) => {
    setSearch(query);
    setShowDropdown(query.trim().length > 0);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        if (viewMode === 'fno') {
          const response = await apiService.getFnoContracts(query || '', 50);
          if (response?.success && Array.isArray(response.data)) {
            const optionsOnly = response.data.filter((item) => {
              const type = String(item.option_type || item.instrument_type || '').toUpperCase();
              return type === 'CE' || type === 'PE';
            });
            const uniq = Array.from(
              new Set(optionsOnly.map((item) => (item.underlying_symbol || '').toUpperCase()).filter(Boolean))
            );
            setFnoSymbols(uniq.map((symbol) => ({
              symbol,
              in_hourly: 1,
              in_daily: 1,
            })));
            setSearchResults(uniq.slice(0, 8).map(s => ({ symbol: s })));
          }
        } else {
          const response = await apiService.searchSymbols(query || '');
          if (response) {
            const data = Array.isArray(response) ? response : (response.data || []);
            setSymbols(data);
            setSearchResults((data || []).slice(0, 8));
          }
        }
      } catch (err) {
        console.error('Sidebar search failed:', err);
      }
    }, 250);
  }, [viewMode]);

  const handleSearchSelect = useCallback((symbol) => {
    onSymbolChange(symbol);
    setSearch('');
    setShowDropdown(false);
    setSearchResults([]);
  }, [onSymbolChange]);

  const handleSearchKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      const first = searchResults[0];
      if (first) {
        handleSearchSelect(first.symbol);
      } else if (search.trim()) {
        handleSearchSelect(search.trim().toUpperCase());
      }
    }
    if (e.key === 'Escape') {
      setShowDropdown(false);
      setSearch('');
    }
  }, [searchResults, search, handleSearchSelect]);

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
                onKeyDown={handleSearchKeyDown}
                onFocus={() => search.trim() && setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                className="w-full bg-[#0a0a0a] border border-[#1c2127] rounded-lg px-3 py-2.5 text-xs text-[#d1d4dc] focus:outline-none focus:border-[#00f2ff] font-mono transition-all placeholder:text-[#333] elite-card"
                id="symbol-search-input"
                autoComplete="off"
              />
              {showDropdown && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#0a0a0a] border border-[#00f2ff]/30 rounded-lg overflow-hidden z-50 shadow-lg shadow-black/80">
                  {searchResults.map((item) => (
                    <button
                      key={item.symbol}
                      type="button"
                      onMouseDown={() => handleSearchSelect(item.symbol)}
                      className="w-full text-left px-3 py-2 text-xs font-mono text-[#d1d4dc] hover:bg-[#00f2ff]/10 hover:text-[#00f2ff] flex items-center gap-2 border-b border-[#1c2127] last:border-b-0 transition-all"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00f2ff]/50 flex-shrink-0"></span>
                      <span className="font-bold">{item.symbol}</span>
                      {item.in_hourly || item.in_daily ? (
                        <span className="ml-auto text-[8px] text-[#39ff14] opacity-70">REC</span>
                      ) : null}
                    </button>
                  ))}
                  <div className="px-3 py-1.5 text-[8px] text-[#5d606b] font-mono border-t border-[#1c2127] flex items-center gap-1">
                    <span className="text-[#00f2ff]">[ENTER]</span> to select first · <span className="text-[#848e9c]">{searchResults.length} results</span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setViewMode('all');
                  onFnoModeChange?.(false);
                }}
                className={`flex-1 py-1 text-[8px] font-bold uppercase rounded border transition-all ${
                  viewMode === 'all' ? 'bg-[#00f2ff]/10 border-[#00f2ff] text-[#00f2ff]' : 'bg-transparent border-[#1c2127] text-[#5d606b]'
                }`}
              >
                All_Intel
              </button>
              <button
                onClick={() => {
                  setViewMode('watchlist');
                  onFnoModeChange?.(false);
                }}
                className={`flex-1 py-1 text-[8px] font-bold uppercase rounded border transition-all ${
                  viewMode === 'watchlist' ? 'bg-[#ffea00]/10 border-[#ffea00] text-[#ffea00]' : 'bg-transparent border-[#1c2127] text-[#5d606b]'
                }`}
              >
                Watchlist
              </button>
              <button
                onClick={() => {
                  setViewMode('fno');
                  onFnoModeChange?.(true);
                  const defaultExpiry = fnoExpiriesMap[selectedSymbol]?.[0] || selectedFnoExpiry;
                  if (defaultExpiry) {
                    setSelectedFnoExpiry(defaultExpiry);
                  }
                }}
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
          {!loading && viewMode === 'fno' && !isCollapsed && (
            <div className="mb-3 p-2 rounded border border-[#1c2127] bg-[#050505]">
              <div className="text-[8px] uppercase tracking-widest text-[#39ff14] font-black mb-2">Options_Only_Mode</div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[8px] text-[#5d606b] uppercase">Expiry</span>
                <select
                  value={selectedFnoExpiry}
                  onChange={(e) => {
                    setSelectedFnoExpiry(e.target.value);
                  }}
                  className="flex-1 bg-[#000] border border-[#1c2127] text-[#00f2ff] text-[9px] rounded px-2 py-1 font-mono"
                >
                  {(fnoExpiriesMap[selectedSymbol] || []).map((exp) => (
                    <option key={exp} value={exp}>{exp}</option>
                  ))}
                </select>
              </div>
              <div className="max-h-24 overflow-y-auto custom-scrollbar space-y-1">
                {fnoMetaLoading ? (
                  <div className="text-[8px] text-[#5d606b] uppercase animate-pulse">Loading_Chain...</div>
                ) : chainPreview.length > 0 ? (
                  chainPreview.map((row, idx) => (
                    <div key={`${row.strike_price}-${idx}`} className="grid grid-cols-3 text-[8px] font-mono text-[#848e9c]">
                      <span className="text-[#00f2ff]">{Number(row.call_options?.market_data?.ltp || row.call_ltp || 0).toFixed(2)}</span>
                      <span className="text-center text-white">{row.strike_price}</span>
                      <span className="text-right text-[#ff4d4d]">{Number(row.put_options?.market_data?.ltp || row.put_ltp || 0).toFixed(2)}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-[8px] text-[#333] uppercase">No_Chain_Data</div>
                )}
              </div>
            </div>
          )}
          {!loading && displayedSymbols.length === 0 && (
            <div className="px-4 py-8 text-center text-[#1c2127] text-[10px] uppercase font-mono">[ NO_INTEL_FOUND ]</div>
          )}
          {displayedSymbols.map((s) => (
            <SidebarItem
              key={s.symbol}
              s={viewMode === 'fno' ? { ...s, in_hourly: 1, in_daily: 1 } : s}
              selectedSymbol={selectedSymbol}
              onSymbolChange={(symbol) => {
                onSymbolChange(symbol);
                if (viewMode === 'fno') {
                  onFnoModeChange?.(true);
                  const nextExpiry = (fnoExpiriesMap[symbol] || [])[0];
                  if (nextExpiry) {
                    setSelectedFnoExpiry(nextExpiry);
                  }
                }
              }}
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

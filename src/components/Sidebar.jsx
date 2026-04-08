import { useState, useEffect } from 'react';
import apiService from '../services/apiService';

const Sidebar = ({ selectedSymbol, onSymbolChange }) => {
  const [symbols, setSymbols] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchTopSymbols = async () => {
      try {
        setLoading(true);
        // Default top symbols if search is empty
        const response = await apiService.searchSymbols('');
        if (response) {
          // Backward compatibility for different response structures
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
    if (query.length > 0) {
      try {
        const response = await apiService.searchSymbols(query);
        if (response) {
          const data = Array.isArray(response) ? response : (response.data || []);
          setSymbols(data);
        }
      } catch (err) {
        console.error('Search failed', err);
      }
    }
  };

  return (
    <div className="w-64 glass-panel border-r border-[#1c2127] flex flex-col h-full bg-[#000000]">
      <div className="p-4 border-b border-[#1c2127]">
        <h2 className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#00f2ff] mb-4 glow-cyan flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-[#00f2ff] rounded-full"></span>
            Scan: Market_Intel
        </h2>
        <div className="relative">
          <input
            type="text"
            placeholder="TYPE SYMBOL_ (/)"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full bg-[#050505] border border-[#1c2127] rounded px-3 py-2.5 text-xs text-[#d1d4dc] focus:outline-none focus:border-[#00f2ff] border-glow-cyan font-mono transition-all placeholder:text-[#1c2127]"
            id="symbol-search-input"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-2 space-y-1">
          <h3 className="text-[9px] uppercase tracking-widest text-[#5d606b] px-3 mb-2 font-bold mt-2">Active_Watchlist</h3>
          {loading && (
            <div className="px-4 py-8 flex flex-col items-center gap-3">
              <div className="w-4 h-4 border border-[#00f2ff] border-t-transparent rounded-full animate-spin"></div>
              <span className="text-[9px] text-[#5d606b] uppercase animate-pulse">Syncing...</span>
            </div>
          )}
          {!loading && symbols.length === 0 && (
            <div className="px-4 py-8 text-center text-[#1c2127] text-[10px] uppercase font-mono">
              [ EMPTY_SET ]
            </div>
          )}
          {symbols.map((s) => (
            <button
              key={s.symbol}
              onClick={() => onSymbolChange(s.symbol)}
              className={`w-full text-left px-3 py-2.5 rounded transition-all flex items-center justify-between group relative overflow-hidden ${
                selectedSymbol === s.symbol
                  ? 'bg-[#00f2ff]/5 border border-[#00f2ff]/30 text-[#00f2ff]'
                  : 'text-[#848e9c] hover:bg-[#0a0a0a] hover:text-[#d1d4dc] border border-transparent'
              }`}
            >
              <div className="flex flex-col">
                <span className="font-mono font-bold tracking-tight text-xs">{s.symbol}</span>
                <span className="text-[8px] text-[#5d606b] uppercase tracking-tighter">Sector: Alpha_Node</span>
              </div>
              <div className="flex flex-col items-end">
                  <span className={`text-[8px] font-mono px-1 rounded ${
                    selectedSymbol === s.symbol ? 'text-[#39ff14]' : 'text-[#1c2127]'
                  }`}>
                    {s.in_hourly ? 'H' : ''}{s.in_daily ? 'D' : ''}
                  </span>
              </div>
              {selectedSymbol === s.symbol && (
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#00f2ff] glow-cyan"></div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 mt-auto border-t border-[#1c2127] bg-[#000000]">
        <div className="flex flex-col gap-1.5">
            <div className="text-[10px] text-[#39ff14] flex items-center gap-2 font-mono font-bold">
                <div className="w-1.5 h-1.5 rounded-full bg-[#39ff14] animate-pulse"></div>
                SECURE UPLINK: VERIFIED
            </div>
            <div className="flex justify-between items-center text-[9px] text-[#5d606b] font-mono uppercase tracking-tighter">
                <span>V4.2.0_SECURE</span>
                <span>Node: ClickHouse_P99</span>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;

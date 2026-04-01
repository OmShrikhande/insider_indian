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
    <div className="w-64 elite-panel border-r border-[#1c2127] flex flex-col h-full bg-[#000000]">
      <div className="p-4 border-b border-[#1c2127]">
        <h2 className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#00f2ff] mb-4 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-[#00f2ff] rounded-full shadow-[0_0_8px_#00f2ff]"></span>
            Elite_Scan / Node 01
        </h2>
        <div className="relative">
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
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-2 py-4">
        <div className="space-y-1">
          <h3 className="text-[9px] uppercase tracking-widest text-[#5d606b] px-3 mb-3 font-bold">Watchlist_Alpha</h3>
          {loading && (
            <div className="px-4 py-8 flex flex-col items-center gap-3">
              <div className="w-4 h-4 border border-[#00f2ff] border-t-transparent rounded-full animate-spin"></div>
              <span className="text-[9px] text-[#5d606b] uppercase animate-pulse font-mono">Syncing_Protocol...</span>
            </div>
          )}
          {!loading && symbols.length === 0 && (
            <div className="px-4 py-8 text-center text-[#1c2127] text-[10px] uppercase font-mono">
              [ NO_INTEL_FOUND ]
            </div>
          )}
          {symbols.map((s) => (
            <button
              key={s.symbol}
              onClick={() => onSymbolChange(s.symbol)}
              className={`w-full text-left px-4 py-3 rounded-lg transition-all flex items-center justify-between group relative overflow-hidden elite-sidebar-item ${
                selectedSymbol === s.symbol
                  ? 'bg-[#00f2ff]/10 text-[#00f2ff] border-l-2 border-l-[#00f2ff]'
                  : 'text-[#848e9c] hover:bg-white/5 hover:text-[#d1d4dc]'
              }`}
            >
              <div className="flex flex-col">
                <span className="font-mono font-bold tracking-tight text-xs">{s.symbol}</span>
                <span className="text-[8px] text-[#5d606b] uppercase tracking-tighter">NSE_INDEX / BAR {Math.floor(Math.random() * 999)}</span>
              </div>
              <div className="flex flex-col items-end">
                  <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded-sm ${
                    selectedSymbol === s.symbol ? 'bg-[#00f2ff]/20 text-[#00f2ff]' : 'bg-[#1c2127] text-[#555]'
                  }`}>
                    {s.in_hourly ? 'H' : ''}{s.in_daily ? 'D' : ''}
                  </span>
              </div>
            </button>
          ))}
        </div>
      </div>

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

    </div>
  );
};

export default Sidebar;

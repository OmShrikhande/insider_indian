import { useState, useEffect, useCallback } from 'react';
import apiService from '../services/apiService';

const NewsList = ({ selectedSymbol }) => {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('desc');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showSpecificStockNews, setShowSpecificStockNews] = useState(true);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchNews = useCallback(async () => {
    try {
      setLoading(true);
      const query = showSpecificStockNews && selectedSymbol 
        ? `${selectedSymbol} ${debouncedSearch}`.trim() 
        : debouncedSearch;

      const response = await apiService.getLatestNews(query, sort);
      if (response.success) {
        setNews(response.data);
      } else if (Array.isArray(response)) {
        // Fallback for mock data direct array return
        setNews(response);
      }
    } catch (err) {
      console.error('Failed to fetch news', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, sort, showSpecificStockNews, selectedSymbol]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  return (
    <div className="flex flex-col h-full bg-[#000]">
      <div className="p-4 border-b border-[#1c2127] bg-[#050505] space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d1d4dc] font-mono-elite">Intelligence_Feed</h3>
          <span className="flex items-center gap-2 text-[9px] px-2 py-0.5 bg-[#ff003c]/20 text-[#ff003c] rounded-full font-bold border border-[#ff003c]/30">
            <span className="w-1.5 h-1.5 bg-[#ff003c] rounded-full animate-ping"></span>
            LIVE
          </span>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            placeholder="FILTER INTEL... (/)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#0a0a0a] border border-[#1c2127] rounded-lg px-3 py-2 text-[10px] text-[#d1d4dc] focus:outline-none focus:border-[#00f2ff] font-mono transition-all placeholder:text-[#333]"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2">
            <button 
              onClick={() => setShowSpecificStockNews(prev => !prev)}
              className={`whitespace-nowrap px-2 py-1 text-[8px] font-bold uppercase rounded border transition-all ${
                showSpecificStockNews ? 'bg-[#00f2ff]/10 border-[#00f2ff] text-[#00f2ff]' : 'bg-transparent border-[#1c2127] text-[#5d606b]'
              }`}
            >
              {selectedSymbol} Only
            </button>
            <div className="flex-1 flex gap-2">
              <button 
                onClick={() => setSort('desc')}
                className={`flex-1 py-1 text-[8px] font-bold uppercase rounded border transition-all ${
                sort === 'desc' ? 'bg-[#00f2ff]/10 border-[#00f2ff] text-[#00f2ff]' : 'bg-transparent border-[#1c2127] text-[#5d606b]'
              }`}
            >
              Newest
            </button>
            <button 
              onClick={() => setSort('asc')}
              className={`flex-1 py-1 text-[8px] font-bold uppercase rounded border transition-all ${
                sort === 'asc' ? 'bg-[#00f2ff]/10 border-[#00f2ff] text-[#00f2ff]' : 'bg-transparent border-[#1c2127] text-[#5d606b]'
              }`}
            >
              Oldest
            </button>
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {loading ? (
          <div className="p-4 text-xs text-[#5d606b] animate-pulse font-mono-elite uppercase tracking-widest text-center">
            Decrypting_Packets...
          </div>
        ) : news.length === 0 ? (
          <div className="p-8 text-center text-[#333] text-[10px] uppercase font-mono-elite tracking-widest">
            [ NO_MATCHING_INTEL_FOUND ]
          </div>
        ) : (
          news.map((item, idx) => (
            <div key={idx} className="elite-panel p-4 cursor-pointer elite-card group transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[8px] uppercase font-black px-1.5 py-0.5 rounded tracking-widest ${
                  item.sentiment === 'bullish' ? 'bg-[#39ff14]/10 text-[#39ff14]' : 'bg-[#ff003c]/10 text-[#ff003c]'
                }`}>
                  {item.sentiment}
                </span>
                <span className="text-[9px] text-[#5d606b] font-mono-elite font-bold">
                   {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                   <span className="ml-2 opacity-50">{new Date(item.timestamp).toLocaleDateString()}</span>
                </span>
              </div>
              <h4 className="text-[11px] font-black text-[#d1d4dc] group-hover:text-[#00f2ff] transition-colors leading-relaxed mb-2 font-mono-elite uppercase tracking-tight">
                {item.title}
              </h4>
              <p className="text-[10px] text-[#848e9c] line-clamp-2 leading-relaxed mb-3">
                {item.summary}
              </p>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#1c2127]">
                 <span className="text-[8px] text-[#333] font-black uppercase tracking-widest">SRC: {item.source}</span>
                 <div className="flex gap-1">
                    <div className="w-1 h-1 bg-[#00f2ff] rounded-full"></div>
                    <div className="w-1 h-1 bg-[#1c2127] rounded-full"></div>
                    <div className="w-1 h-1 bg-[#1c2127] rounded-full"></div>
                 </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>


  );
};

export default NewsList;

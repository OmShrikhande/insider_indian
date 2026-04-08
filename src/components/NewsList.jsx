import { useState, useEffect } from 'react';
import apiService from '../services/apiService';

const NewsList = () => {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const response = await apiService.getLatestNews();
        if (response.success) {
          setNews(response.data);
        }
      } catch (err) {
        console.error('Failed to fetch news', err);
      } finally {
        setLoading(false);
      }
    };
    fetchNews();
  }, []);

  if (loading) return <div className="p-4 text-xs text-[#5d606b] animate-pulse font-mono">Decrypting feed...</div>;

  return (
    <div className="flex flex-col h-full bg-[#000000]">
      <div className="p-3 border-b border-[#1c2127] flex items-center justify-between">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#d1d4dc] font-mono">Intelligence Feed</h3>
        <span className="text-[9px] px-1 bg-[#ff003c] text-white rounded animate-pulse">LIVE</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {news.map((item) => (
          <div key={item.id} className="group cursor-pointer">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[9px] uppercase font-bold px-1 rounded ${
                item.sentiment === 'bullish' ? 'bg-[#1e3a2f] text-[#39ff14]' : 'bg-[#3a1e1e] text-[#ff003c]'
              }`}>
                {item.sentiment}
              </span>
              <span className="text-[9px] text-[#5d606b] font-mono">{new Date(item.timestamp).toLocaleTimeString()}</span>
            </div>
            <h4 className="text-xs font-semibold text-[#d1d4dc] group-hover:text-[#00f2ff] transition-colors leading-tight mb-1 font-mono">
              {item.title}
            </h4>
            <p className="text-[11px] text-[#848e9c] line-clamp-2 leading-snug">
              {item.summary}
            </p>
            <div className="mt-2 text-[9px] text-[#5d606b] font-mono italic">SOURCE: {item.source}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NewsList;

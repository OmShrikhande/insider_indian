import { useState, useEffect } from 'react';
import apiService from '../services/apiService';

const TradeFeed = () => {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrades = async () => {
      try {
        const response = await apiService.getFuturisticTrades();
        if (response.success) {
          setTrades(response.data);
        }
      } catch (err) {
        console.error('Failed to fetch trades', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTrades();
  }, []);

  if (loading) return <div className="p-4 text-xs text-[#5d606b] font-mono animate-pulse">Simulating trade vectors...</div>;

  return (
    <div className="flex flex-col h-full bg-[#000000]">
      <div className="p-3 border-b border-[#1c2127]">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#d1d4dc] font-mono">Predictive Signals</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {trades.map((trade) => (
          <div key={trade.id} className="p-3 bg-[#0a0a0a] border border-[#1c2127] rounded relative overflow-hidden group hover:border-[#00f2ff] transition-all">
            <div className={`absolute top-0 right-0 w-1 h-full ${
              trade.type === 'LONG' ? 'bg-[#39ff14]' : 'bg-[#ff003c]'
            }`}></div>
            
            <div className="flex justify-between items-start mb-2">
              <span className="font-mono font-bold text-sm text-[#d1d4dc]">{trade.symbol}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                trade.type === 'LONG' ? 'bg-[#1e3a2f] text-[#39ff14]' : 'bg-[#3a1e1e] text-[#ff003c]'
              }`}>
                {trade.type}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono mb-2">
              <div>
                <span className="text-[#5d606b]">ENTRY</span>
                <div className="text-[#d1d4dc] font-bold">${trade.entry.toFixed(2)}</div>
              </div>
              <div>
                <span className="text-[#5d606b]">TARGET</span>
                <div className="text-[#39ff14] font-bold">${trade.target.toFixed(2)}</div>
              </div>
            </div>

            <div className="text-[9px] text-[#848e9c] mb-2 italic font-mono">
              "{trade.reason}"
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 h-1 bg-[#1c2127] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#00f2ff]" 
                  style={{ width: `${trade.confidence * 100}%` }}
                ></div>
              </div>
              <span className="text-[9px] font-mono text-[#00f2ff] font-bold">{(trade.confidence * 100).toFixed(0)}% CONF</span>
            </div>
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-[#1c2127] bg-[#050505] text-center">
        <button className="text-[10px] text-[#00f2ff] font-bold hover:underline opacity-50 cursor-not-allowed font-mono">
          + UNLOCK QUANTUM ALPHA
        </button>
      </div>
    </div>
  );
};

export default TradeFeed;

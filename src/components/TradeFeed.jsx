const TradeFeed = ({ trades = [] }) => {
  if (trades.length === 0) return <div className="p-4 text-xs text-[#5d606b] font-mono">Scanning live vectors for SMC setups...</div>;


  return (
    <div className="flex flex-col h-full bg-[#000]">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {trades.map((trade, idx) => (
          <div key={idx} className="p-4 elite-panel elite-card relative group transition-all">
            <div className={`absolute top-0 right-0 w-1 h-full rounded-r ${
              trade.type === 'LONG' ? 'bg-[#39ff14]' : 'bg-[#ff003c]'
            }`}></div>
            
            <div className="flex justify-between items-start mb-3">
              <div>
                <span className="font-black text-sm text-[#d1d4dc] tracking-tighter">{trade.symbol}</span>
                <div className="text-[8px] text-[#5d606b] uppercase font-bold tracking-widest mt-0.5">SMC_ALGO_VECTOR</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${
                  trade.type === 'LONG' ? 'bg-[#39ff14]/10 text-[#39ff14]' : 'bg-[#ff003c]/10 text-[#ff003c]'
                }`}>
                  {trade.type}
                </span>
                {trade.time && (
                  <span className="text-[8px] text-[#848e9c] font-mono tracking-widest">
                    {new Date(trade.time * 1000).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-[10px] font-mono-elite mb-4">
              <div className="bg-white/5 p-2 rounded border border-white/5">
                <span className="text-[#5d606b] block mb-1 uppercase text-[8px]">ENTRY</span>
                <div className="text-[#d1d4dc] font-black">${trade.entry.toFixed(2)}</div>
              </div>
              <div className="bg-white/5 p-2 rounded border border-white/5">
                <span className="text-[#5d606b] block mb-1 uppercase text-[8px]">TARGET</span>
                <div className="text-[#39ff14] font-black">${trade.target.toFixed(2)}</div>
              </div>
              <div className="bg-white/5 p-2 rounded border border-white/5">
                <span className="text-[#5d606b] block mb-1 uppercase text-[8px]">STOP</span>
                <div className="text-[#ff003c] font-black">${trade.stopLoss.toFixed(2)}</div>
              </div>
            </div>

            {trade.range && (
              <div className="mb-4 p-2 bg-white/5 rounded border border-white/10">
                <div className="text-[8px] text-[#5d606b] uppercase mb-2 font-bold">TRADE RANGE</div>
                <div className="flex justify-between text-[9px] font-mono">
                  <span className="text-[#5d606b]">MIN: <span className="text-[#d1d4dc] font-bold">${trade.range.min.toFixed(2)}</span></span>
                  <span className="text-[#5d606b]">MAX: <span className="text-[#d1d4dc] font-bold">${trade.range.max.toFixed(2)}</span></span>
                </div>
                <div className="mt-1 h-1 bg-[#1c2127] rounded-full overflow-hidden">
                  <div
                    className={`h-full ${trade.type === 'LONG' ? 'bg-gradient-to-r from-[#ff003c] via-[#39ff14] to-[#39ff14]' : 'bg-gradient-to-r from-[#39ff14] via-[#ff003c] to-[#ff003c]'}`}
                    style={{
                      width: `${((trade.entry - trade.range.min) / (trade.range.max - trade.range.min)) * 100}%`,
                      marginLeft: 'auto'
                    }}
                  ></div>
                </div>
              </div>
            )}

            <div className="text-[10px] text-[#848e9c] mb-4 leading-relaxed font-medium bg-[#050505] p-2 rounded border border-[#1c2127]">
              <span className="text-[#00f2ff] mr-1">ANALYSIS:</span> "{trade.reason}"
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-1 bg-[#1c2127] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-[#00f2ff] to-[#39ff14]" 
                  style={{ width: `85%` }}
                ></div>
              </div>
              <span className="text-[9px] font-black text-[#00f2ff] tracking-widest">CONF: 85%</span>
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

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
              <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${
                trade.type === 'LONG' ? 'bg-[#39ff14]/10 text-[#39ff14]' : 'bg-[#ff003c]/10 text-[#ff003c]'
              }`}>
                {trade.type}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-[10px] font-mono-elite mb-4">
              <div className="bg-white/5 p-2 rounded border border-white/5">
                <span className="text-[#5d606b] block mb-1 uppercase text-[8px]">ENTRY_P</span>
                <div className="text-[#d1d4dc] font-black">${trade.entry.toFixed(2)}</div>
              </div>
              <div className="bg-white/5 p-2 rounded border border-white/5">
                <span className="text-[#5d606b] block mb-1 uppercase text-[8px]">TARGET_V</span>
                <div className="text-[#39ff14] font-black">${trade.target.toFixed(2)}</div>
              </div>
            </div>

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

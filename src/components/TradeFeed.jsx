import { useEffect, useMemo, useState } from 'react';
import apiService from '../services/apiService';

const TradeFeed = ({ trades = [], isFnoMode = false, fnoStrategySignal = null }) => {
  const [dbTrades, setDbTrades] = useState([]);
  const [toast, setToast] = useState('');

  const notify = (msg) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 2200);
  };

  const loadDbTrades = async () => {
    try {
      const res = await apiService.getFnoSuggestedTrades(120);
      if (res?.success && Array.isArray(res.data)) setDbTrades(res.data);
    } catch (_) {}
  };

  useEffect(() => {
    loadDbTrades();
  }, []);

  const localTrades = useMemo(() => trades.map((t, i) => ({
    ...t,
    id: `LOCAL_${i}`,
    status: t.status || 'open',
    handled_action: t.handled_action || '',
    isDb: false,
  })), [trades]);

  const suggestedTrades = useMemo(() => dbTrades.map((t) => ({
    id: t.id,
    symbol: t.symbol,
    type: ['SELL', 'SHORT'].includes(String(t.side || '').toUpperCase()) ? 'SHORT' : 'LONG',
    entry: Number(t.entry || 0),
    target: Number(t.target || 0),
    stopLoss: Number(t.stop_loss || 0),
    reason: t.analysis || '',
    time: Math.floor(new Date(t.created_at || Date.now()).getTime() / 1000),
    status: t.status || 'open',
    handled_action: t.handled_action || '',
    isDb: true,
  })), [dbTrades]);

  const mergedTrades = isFnoMode ? [...localTrades] : [...suggestedTrades, ...localTrades];
  const visibleTrades = mergedTrades.slice(0, 10);
  if (visibleTrades.length === 0) {
    if (isFnoMode) {
      return (
        <div className="p-4 space-y-3">
          <div className="text-xs text-[#5d606b] font-mono">F&O ORB strategy status</div>
          <div className="border border-[#1c2127] rounded p-3 bg-[#050505] text-[11px] text-[#d1d4dc]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[#00f2ff] font-bold tracking-widest uppercase text-[9px]">ORB_ENGINE</span>
              <span className={`text-[9px] font-black px-2 py-0.5 rounded ${
                fnoStrategySignal?.trade_allowed ? 'bg-[#39ff14]/10 text-[#39ff14]' : 'bg-[#ff4d4d]/10 text-[#ff4d4d]'
              }`}>
                {fnoStrategySignal?.trade_allowed ? 'TRADE ALLOWED' : 'NO TRADE'}
              </span>
            </div>
            <div className="text-[#848e9c]">
              {fnoStrategySignal?.message || fnoStrategySignal?.day_classification?.reason || 'No valid breakout detected in trading window'}
            </div>
          </div>
        </div>
      );
    }
    return <div className="p-4 text-xs text-[#5d606b] font-mono">Scanning live vectors for SMC setups...</div>;
  }

  const focusTradeOnChart = (trade) => {
    window.dispatchEvent(new CustomEvent('roxey-focus-trade', { detail: trade }));
  };

  const handleAction = async (trade, action) => {
    if (!trade.isDb) {
      notify(`Trade ${action === 'accept' ? 'accepted' : 'rejected'} (local-only signal).`);
      return;
    }
    try {
      const res = await apiService.handleFnoSuggestedTrade(trade.id, action, 'trader');
      if (res?.success) {
        notify(`Trade ${action === 'accept' ? 'accepted' : 'rejected'} and marked handled.`);
        loadDbTrades();
      } else {
        notify(res?.error || 'Action failed');
      }
    } catch (e) {
      notify(e.message || 'Action failed');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#000] relative">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {visibleTrades.map((trade, idx) => (
          <div key={idx} className="p-4 elite-panel elite-card relative group transition-all">
            <div className={`absolute top-0 right-0 w-1 h-full rounded-r ${
              trade.type === 'LONG' ? 'bg-[#39ff14]' : 'bg-[#ff003c]'
            }`}></div>
            
            <div className="flex justify-between items-start mb-3">
              <div>
                <span className="font-black text-sm text-[#d1d4dc] tracking-tighter">{trade.symbol}</span>
                <div className="text-[8px] text-[#5d606b] uppercase font-bold tracking-widest mt-0.5">
                  {trade.source ? String(trade.source) : 'SMC_ALGO_VECTOR'}
                </div>
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
                {String(trade.status).toLowerCase() === 'handled' && (
                  <span className="text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest bg-[#ffea00]/10 text-[#ffea00] border border-[#ffea00]/30">
                    Handled {trade.handled_action ? `(${trade.handled_action})` : ''}
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

            {String(trade.status).toLowerCase() !== 'handled' && (
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => handleAction(trade, 'accept')}
                  className="flex-1 py-2 rounded border border-[#39ff14]/40 bg-[#39ff14]/10 text-[#39ff14] text-[10px] font-black tracking-widest hover:bg-[#39ff14]/20"
                >
                  ACCEPT
                </button>
                <button
                  type="button"
                  onClick={() => handleAction(trade, 'reject')}
                  className="flex-1 py-2 rounded border border-[#ff4d4d]/30 bg-[#ff4d4d]/10 text-[#ff4d4d] text-[10px] font-black tracking-widest hover:bg-[#ff4d4d]/20"
                >
                  REJECT
                </button>
              </div>
            )}

            <div className="mb-3">
              <div className="text-[8px] text-[#5d606b] uppercase tracking-widest mb-1.5 font-mono">Apply to Chart</div>
              <button
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/json', JSON.stringify(trade));
                  e.dataTransfer.effectAllowed = 'copyMove';
                }}
                onClick={() => focusTradeOnChart(trade)}
                className="w-full py-2.5 rounded border border-[#00f2ff]/50 bg-[#00f2ff]/8 text-[#00f2ff] text-[10px] font-black tracking-widest hover:bg-[#00f2ff]/20 hover:border-[#00f2ff]/80 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <path d="M3 9h18M9 21V9"/>
                </svg>
                SHOW ON CHART
              </button>
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
      {toast && (
        <div className="absolute bottom-3 left-3 right-3 text-center text-[10px] font-mono border border-[#00f2ff]/30 bg-[#00f2ff]/10 text-[#b4f4ff] px-2 py-1 rounded">
          {toast}
        </div>
      )}
    </div>
  );
};

export default TradeFeed;

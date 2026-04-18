import { useState, useEffect } from 'react';
import apiService from '../services/apiService';

const ScreenerPanel = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState('momentum');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const summary = {
    total: data.length,
    avgClose: data.length ? (data.reduce((acc, item) => acc + Number(item.close || 0), 0) / data.length) : 0,
    avgVolume: data.length ? (data.reduce((acc, item) => acc + Number(item.volume || 0), 0) / data.length) : 0,
    topSymbol: data[0]?.symbol || '--',
  };

  useEffect(() => {
    const fetchScreener = async () => {
      setLoading(true);
      try {
        let res;
        if (activeTab === 'momentum') res = await apiService.getMomentumScreener(50);
        else if (activeTab === 'volatility') res = await apiService.getVolatilityScreener(50);
        else res = await apiService.getTrendScreener(50);

        if (res.success) {
          setData(res.data);
        } else {
          setData([]);
        }
      } catch (e) {
        console.error('Screener fetch error:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchScreener();
  }, [activeTab]);

  return (
    <div className="absolute inset-0 z-[60] bg-black/90 backdrop-blur-md flex flex-col p-8 overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl text-[#00f2ff] font-black uppercase tracking-[0.2em] flex items-center gap-3">
          <span className="w-2 h-2 bg-[#00f2ff] animate-pulse rounded-full"></span>
          MARKET_SCREENER_NODE
        </h2>
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-[#00f2ff] border border-[#00f2ff]/30 bg-[#00f2ff]/10 hover:bg-[#00f2ff]/20 px-3 py-2 rounded transition-colors uppercase text-[10px] tracking-widest font-bold">
            [ RETURN_DASHBOARD ]
          </button>
          <button onClick={onClose} className="text-[#ff003c] hover:text-white transition-colors uppercase text-sm tracking-widest font-bold">
            [ CLOSE_NODE ]
          </button>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        {['momentum', 'volatility', 'trend'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-2 uppercase tracking-[0.2em] text-xs font-black transition-all rounded border ${
              activeTab === tab ? 'bg-[#00f2ff]/20 text-[#00f2ff] border-[#00f2ff]' : 'bg-transparent text-[#5d606b] border-[#1c2127] hover:border-[#848e9c]'
            }`}
          >
            {tab}_scan
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="border border-[#1c2127] rounded-lg bg-[#050505] p-3">
          <div className="text-[9px] text-[#5d606b] uppercase">Total Signals</div>
          <div className="text-[#00f2ff] text-lg font-black">{summary.total}</div>
        </div>
        <div className="border border-[#1c2127] rounded-lg bg-[#050505] p-3">
          <div className="text-[9px] text-[#5d606b] uppercase">Avg Close</div>
          <div className="text-white text-lg font-black">{summary.avgClose.toFixed(2)}</div>
        </div>
        <div className="border border-[#1c2127] rounded-lg bg-[#050505] p-3">
          <div className="text-[9px] text-[#5d606b] uppercase">Avg Volume</div>
          <div className="text-white text-lg font-black">{Math.round(summary.avgVolume).toLocaleString('en-IN')}</div>
        </div>
        <div className="border border-[#1c2127] rounded-lg bg-[#050505] p-3">
          <div className="text-[9px] text-[#5d606b] uppercase">Top Symbol</div>
          <div className="text-[#39ff14] text-lg font-black">{summary.topSymbol}</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto elite-scrollbar border border-[#1c2127] rounded-lg bg-[#050505]">
        {loading ? (
          <div className="flex justify-center items-center h-full text-[#00f2ff] tracking-[0.5em] animate-pulse text-xs">SCANNING_MARKET_MATRIX...</div>
        ) : (
          <table className="w-full text-left text-xs uppercase tracking-widest text-[#d1d4dc]">
            <thead className="sticky top-0 bg-[#0a0a0a] border-b border-[#1c2127]">
              <tr>
                <th className="p-4 text-[#848e9c] font-black">Symbol</th>
                <th className="p-4 text-[#848e9c] font-black">Volume</th>
                <th className="p-4 text-[#848e9c] font-black">Close</th>
                <th className="p-4 text-[#848e9c] font-black text-right">Score/Type</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, idx) => (
                <tr key={`${item.symbol}-${idx}`} className="border-b border-[#1c2127]/50 hover:bg-[#1a1f26] transition-colors">
                  <td className="p-4 font-bold text-[#00f2ff]">{item.symbol}</td>
                  <td className="p-4">{item.volume?.toLocaleString() || '-'}</td>
                  <td className="p-4">{item.close?.toFixed(2) || '-'}</td>
                  <td className="p-4 text-right font-black text-[#39ff14]">
                    {activeTab === 'trend' ? item.trend_type : (item.momentum_score || item.volatility_score || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan="4" className="text-center p-8 text-[#5d606b] italic">[ NO_SIGNALS_DETECTED ]</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ScreenerPanel;

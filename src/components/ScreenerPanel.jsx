import { useState, useEffect, useRef } from 'react';
import apiService from '../services/apiService';

const ScreenerStatus = ({ activeTab, onStatusUpdate }) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const requestInFlightRef = useRef(false);

  useEffect(() => {
    const fetchStatus = async () => {
      if (requestInFlightRef.current) return;
      try {
        requestInFlightRef.current = true;
        setLoading(true);
        const result = await apiService.getScreenerStatus();
        if (result.success) {
          setStatus(result.data);
          onStatusUpdate?.(result.data);
        }
      } catch (error) {
        console.error('Failed to fetch screener status:', error);
      } finally {
        setLoading(false);
        requestInFlightRef.current = false;
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);

    return () => clearInterval(interval);
  }, [activeTab, onStatusUpdate]);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      const result = await apiService.refreshScreener(activeTab);
      if (result.success) {
        console.log('Refresh triggered successfully');
        // Status will update automatically via the interval
      }
    } catch (error) {
      console.error('Failed to trigger refresh:', error);
    } finally {
      setRefreshing(false);
    }
  };

  if (!status || loading) return null;

  const screenerData = status.screeners.find(s => s.screener_type === activeTab);
  const isScanning = status.is_syncing;

  if (!screenerData && !isScanning) return null;

  return (
    <div className="mb-4 p-3 bg-[#0a0a0a] border border-[#1c2127] rounded-lg">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          {isScanning ? (
            <>
              <div className="w-2 h-2 bg-[#00f2ff] rounded-full animate-pulse"></div>
              <span className="text-[#00f2ff] font-mono">SCANNING_IN_PROGRESS</span>
            </>
          ) : screenerData?.is_fresh ? (
            <>
              <div className="w-2 h-2 bg-[#39ff14] rounded-full"></div>
              <span className="text-[#39ff14] font-mono">DATA_FRESH</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 bg-[#ff4d4d] rounded-full"></div>
              <span className="text-[#ff4d4d] font-mono">DATA_STALE</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[#5d606b] font-mono text-[10px]">
            {screenerData ? `${screenerData.total_records} stocks` : 'Processing...'}
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing || isScanning}
            className={`px-2 py-1 text-[9px] font-mono uppercase rounded border transition-all ${
              refreshing || isScanning
                ? 'bg-[#333] text-[#666] border-[#444] cursor-not-allowed'
                : 'bg-[#00f2ff]/10 text-[#00f2ff] border-[#00f2ff]/30 hover:bg-[#00f2ff]/20'
            }`}
          >
            {refreshing ? 'SYNC...' : 'SYNC'}
          </button>
        </div>
      </div>
      {screenerData?.last_updated && (
        <div className="text-[9px] text-[#333] mt-1 font-mono">
          Last updated: {new Date(screenerData.last_updated).toLocaleTimeString()}
        </div>
      )}
      {isScanning && (
        <div className="text-[9px] text-[#00f2ff] mt-1 font-mono">
          Batch size: {status.batch_size} | Delay: {status.batch_delay_seconds}s
        </div>
      )}
    </div>
  );
};

const ScreenerPanel = ({ onClose, isRightSidebarCollapsed }) => {
  const [activeTab, setActiveTab] = useState('momentum');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [screenerStatus, setScreenerStatus] = useState(null);

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
        if (activeTab === 'momentum') res = await apiService.getMomentumScreener(1000);
        else if (activeTab === 'volatility') res = await apiService.getVolatilityScreener(1000);
        else res = await apiService.getTrendScreener(1000);

        if (res.success) {
          setData(res.data);
        } else {
          setData([]);
        }
      } catch (e) {
        console.error('Screener fetch error:', e);
        setData([]); // Show empty state instead of loading forever
      } finally {
        setLoading(false);
      }
    };
    fetchScreener();
  }, [activeTab]);

  const handleStatusUpdate = (status) => {
    setScreenerStatus(status);
  };

  return (
    <div className={`absolute inset-0 z-[60] bg-black/90 backdrop-blur-md flex flex-col p-8 overflow-hidden ${isRightSidebarCollapsed ? 'right-12' : 'right-72'}`}>
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

      <ScreenerStatus activeTab={activeTab} onStatusUpdate={handleStatusUpdate} />

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
        {loading && data.length === 0 ? (
          <div className="flex justify-center items-center h-full text-[#00f2ff] tracking-[0.5em] animate-pulse text-xs">
            {screenerStatus?.is_syncing ? 'SCANNING_MARKET_MATRIX...' : 'LOADING_DATA...'}
          </div>
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
                  <td className="p-4 text-right font-black">
                    {activeTab === 'trend' ? (
                      <span className={item.trend_type === 'bullish' ? 'text-[#39ff14]' : 'text-[#ff4d4d]'}>
                        {item.trend_type}
                      </span>
                    ) : (
                      <span className={(item.momentum_score || item.volatility_score || 0) < 0 ? 'text-[#ff4d4d]' : 'text-[#39ff14]'}>
                        {(item.momentum_score || item.volatility_score || 0).toFixed(2)}
                      </span>
                    )}
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

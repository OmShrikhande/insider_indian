import { useEffect, useState } from 'react';
import apiService from '../services/apiService';

const blockCls = 'border border-[#1c2127] rounded p-3 bg-[#050505]';

const ResearchPanel = ({ selectedSymbol }) => {
  const [pcr, setPcr] = useState(null);
  const [expiries, setExpiries] = useState([]);
  const [momentum, setMomentum] = useState([]);
  const [volatility, setVolatility] = useState([]);
  const [trend, setTrend] = useState([]);
  const [strategies, setStrategies] = useState([]);
  const [sources, setSources] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [alertThreshold, setAlertThreshold] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [pcrRes, expRes, mRes, vRes, tRes, sRes, srcRes, aRes] = await Promise.all([
          apiService.getFnoPCR(selectedSymbol || 'NIFTY'),
          apiService.getFnoExpiries(selectedSymbol || 'NIFTY'),
          apiService.getMomentumScreener(8),
          apiService.getVolatilityScreener(8),
          apiService.getTrendScreener(8),
          apiService.getStrategyTemplates(),
          apiService.getDataSources(),
          apiService.getAlerts().catch(() => ({ data: [] })),
        ]);
        setPcr(pcrRes.data);
        setExpiries(expRes.data || []);
        setMomentum(mRes.data || []);
        setVolatility(vRes.data || []);
        setTrend(tRes.data || []);
        setStrategies(sRes.data || []);
        setSources(srcRes.data || null);
        setAlerts(aRes.data || []);
      } catch (error) {
        console.error('Research panel load error:', error);
      }
    };
    load();
  }, [selectedSymbol]);

  const createAlert = async () => {
    const threshold = Number(alertThreshold);
    if (!Number.isFinite(threshold)) return;
    const res = await apiService.createAlert({
      symbol: selectedSymbol,
      conditionType: 'PRICE_ABOVE',
      threshold,
      timeframe: '1h',
    });
    if (res?.success) {
      const next = await apiService.getAlerts();
      setAlerts(next.data || []);
      setAlertThreshold('');
    }
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-3 space-y-3 text-[11px] text-[#d1d4dc]">
      <div className={blockCls}>
        <div className="text-[#39ff14] font-bold mb-1">F&O Snapshot</div>
        <div>PCR: <span className="text-[#00f2ff]">{pcr?.pcr?.toFixed?.(2) ?? 'N/A'}</span></div>
        <div className="text-[#848e9c] mt-1">Expiries: {(expiries || []).slice(0, 4).join(', ') || 'N/A'}</div>
      </div>

      <div className={blockCls}>
        <div className="text-[#00f2ff] font-bold mb-1">Screeners</div>
        <div className="text-[#848e9c]">Momentum: {(momentum[0]?.symbol) || '-'}</div>
        <div className="text-[#848e9c]">Volatility: {(volatility[0]?.symbol) || '-'}</div>
        <div className="text-[#848e9c]">Trend: {(trend[0]?.symbol) || '-'}</div>
      </div>

      <div className={blockCls}>
        <div className="text-[#ffea00] font-bold mb-1">Strategy Templates</div>
        {(strategies || []).map((s) => (
          <div key={s.id} className="mb-2">
            <div className="font-bold">{s.name}</div>
            <div className="text-[#848e9c]">{s.description}</div>
          </div>
        ))}
      </div>

      <div className={blockCls}>
        <div className="text-[#ff003c] font-bold mb-1">Alerts (Server-side)</div>
        <div className="flex gap-2 mb-2">
          <input
            className="flex-1 bg-black border border-[#1c2127] rounded px-2 py-1"
            placeholder={`Create ${selectedSymbol} alert price`}
            value={alertThreshold}
            onChange={(e) => setAlertThreshold(e.target.value)}
          />
          <button className="px-2 py-1 border border-[#ff003c] rounded text-[#ff003c]" onClick={createAlert}>Add</button>
        </div>
        <div className="space-y-1">
          {(alerts || []).slice(0, 6).map((a) => (
            <div key={a.id} className="text-[#848e9c]">{a.symbol} {a.condition_type} {a.threshold}</div>
          ))}
        </div>
      </div>

      <div className={blockCls}>
        <div className="text-[#39ff14] font-bold mb-1">Data Source</div>
        <div className="text-[#848e9c]">{sources?.stocks?.historical || 'N/A'}</div>
      </div>
    </div>
  );
};

export default ResearchPanel;

import { useMemo, useState } from 'react';
import apiService from '../services/apiService';

const inputCls = 'w-full bg-black/60 border border-[#1c2127] rounded px-2 py-2 text-[11px] text-[#d1d4dc] focus:outline-none focus:border-[#00f2ff]/40';

const defaultStock = {
  symbol: '',
  side: 'BUY',
  budget: '',
  entry: '',
  target: '',
  stopLoss: '',
  analysis: '',
};

const defaultFno = {
  symbol: 'NIFTY',
  instrumentType: 'OPTION',
  optionBucket: 'ATM',
  bucketDistance: '1',
  optionType: 'CE',
  strike: '',
  expiry: '',
  side: 'BUY',
  budget: '',
  entry: '',
  target: '',
  stopLoss: '',
  analysis: '',
};

const ResearchAnalystPanel = ({ onTradeSaved }) => {
  const [mode, setMode] = useState('STOCK');
  const [stockForm, setStockForm] = useState(defaultStock);
  const [fnoForm, setFnoForm] = useState(defaultFno);
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);

  const summary = useMemo(() => ({ total: 14, accuracy: '78.4%' }), []);

  const notify = (msg) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 2200);
  };

  const handleSubmit = async () => {
    const form = mode === 'STOCK' ? stockForm : fnoForm;
    const payload = {
      marketSegment: mode,
      symbol: form.symbol,
      instrumentType: mode === 'FNO' ? form.instrumentType : 'EQUITY',
      optionType: mode === 'FNO' ? form.optionType : '',
      strike: mode === 'FNO' && form.instrumentType === 'OPTION' ? Number(form.strike || 0) : null,
      expiry: mode === 'FNO' && form.instrumentType === 'OPTION' ? form.expiry : null,
      side: form.side,
      budget: Number(form.budget || 0),
      entry: Number(form.entry),
      target: Number(form.target),
      stopLoss: Number(form.stopLoss),
      analysis: form.analysis,
      source: 'research_panel',
    };
    if (mode === 'FNO' && form.instrumentType === 'OPTION') {
      const bucket = String(form.optionBucket || '').trim().toUpperCase();
      payload.analysis = bucket
        ? `[Bucket:${bucket}${Number(form.bucketDistance || 0) > 1 ? `-${Number(form.bucketDistance)}` : ''}] ${payload.analysis || ''}`.trim()
        : payload.analysis;
    }

    try {
      setSaving(true);
      const res = await apiService.createFnoSuggestedTrade(payload);
      if (res?.success) {
        notify('Trade suggestion submitted and stored.');
        if (mode === 'STOCK') setStockForm(defaultStock);
        else setFnoForm(defaultFno);
        if (typeof onTradeSaved === 'function') onTradeSaved(res.data);
      } else {
        notify(res?.error || 'Trade save failed');
      }
    } catch (e) {
      notify(e.message || 'Trade save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-3 text-[#d1d4dc] text-[11px] space-y-3">
      <div className="border border-[#1c2127] rounded-lg bg-[#050505]/95 p-3">
        <div className="text-[#00f2ff] text-[10px] font-black tracking-widest uppercase mb-2">Research Analyst Console</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="border border-[#1c2127] rounded p-2 bg-black/50">
            <div className="text-[8px] text-[#5d606b] uppercase">Total Suggestions Today</div>
            <div className="text-[#39ff14] font-black text-sm">{summary.total}</div>
          </div>
          <div className="border border-[#1c2127] rounded p-2 bg-black/50">
            <div className="text-[8px] text-[#5d606b] uppercase">Accuracy Score</div>
            <div className="text-[#00f2ff] font-black text-sm">{summary.accuracy}</div>
          </div>
        </div>
      </div>

      <div className="flex border border-[#1c2127] rounded overflow-hidden">
        {['STOCK', 'FNO'].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 py-2 text-[10px] font-black tracking-widest ${mode === m ? 'bg-[#00f2ff]/10 text-[#00f2ff]' : 'bg-[#0a0a0a] text-[#5d606b]'}`}
          >
            {m}
          </button>
        ))}
      </div>

      {mode === 'STOCK' ? (
        <div className="space-y-2 border border-[#1c2127] rounded p-3 bg-[#050505]">
          <input className={inputCls} placeholder="Symbol (e.g. ABB)" value={stockForm.symbol} onChange={(e) => setStockForm((p) => ({ ...p, symbol: e.target.value }))} />
          <select className={inputCls} value={stockForm.side} onChange={(e) => setStockForm((p) => ({ ...p, side: e.target.value }))}>
            <option>BUY</option><option>SELL</option>
          </select>
          <input className={inputCls} placeholder="Budget (optional)" value={stockForm.budget} onChange={(e) => setStockForm((p) => ({ ...p, budget: e.target.value }))} />
          <div className="grid grid-cols-3 gap-2">
            <input className={inputCls} placeholder="Entry" value={stockForm.entry} onChange={(e) => setStockForm((p) => ({ ...p, entry: e.target.value }))} />
            <input className={inputCls} placeholder="Target" value={stockForm.target} onChange={(e) => setStockForm((p) => ({ ...p, target: e.target.value }))} />
            <input className={inputCls} placeholder="Stop Loss" value={stockForm.stopLoss} onChange={(e) => setStockForm((p) => ({ ...p, stopLoss: e.target.value }))} />
          </div>
          <textarea className={inputCls} rows={4} placeholder="Analysis..." value={stockForm.analysis} onChange={(e) => setStockForm((p) => ({ ...p, analysis: e.target.value }))} />
        </div>
      ) : (
        <div className="space-y-2 border border-[#1c2127] rounded p-3 bg-[#050505]">
          <input className={inputCls} placeholder="Underlying (e.g. NIFTY)" value={fnoForm.symbol} onChange={(e) => setFnoForm((p) => ({ ...p, symbol: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <select className={inputCls} value={fnoForm.instrumentType} onChange={(e) => setFnoForm((p) => ({ ...p, instrumentType: e.target.value }))}>
              <option value="OPTION">OPTION</option><option value="FUTURE">FUTURE</option>
            </select>
            <select className={inputCls} value={fnoForm.side} onChange={(e) => setFnoForm((p) => ({ ...p, side: e.target.value }))}>
              <option>BUY</option><option>SELL</option>
            </select>
          </div>
          <input className={inputCls} placeholder="Option Budget (optional)" value={fnoForm.budget} onChange={(e) => setFnoForm((p) => ({ ...p, budget: e.target.value }))} />
          {fnoForm.instrumentType === 'OPTION' && (
            <>
              <div className="border border-[#1c2127] rounded p-2 bg-black/40">
                <div className="text-[8px] uppercase tracking-widest text-[#5d606b] mb-2">Option Bucket</div>
                <div className="grid grid-cols-4 gap-2">
                  {['ITM', 'ATM', 'OTM', 'FAR'].map((bucket) => (
                    <button
                      key={bucket}
                      type="button"
                      onClick={() => setFnoForm((p) => ({ ...p, optionBucket: bucket }))}
                      className={`py-1.5 rounded border text-[9px] font-black tracking-wider ${
                        fnoForm.optionBucket === bucket
                          ? 'bg-[#00f2ff]/15 border-[#00f2ff] text-[#00f2ff]'
                          : 'bg-[#0a0a0a] border-[#1c2127] text-[#5d606b] hover:text-[#d1d4dc]'
                      }`}
                    >
                      {bucket}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[8px] text-[#5d606b] uppercase">Distance</span>
                  <input
                    className={`${inputCls} max-w-[80px] py-1`}
                    type="number"
                    min="1"
                    max="10"
                    value={fnoForm.bucketDistance}
                    onChange={(e) => setFnoForm((p) => ({ ...p, bucketDistance: e.target.value || '1' }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
              <select className={inputCls} value={fnoForm.optionType} onChange={(e) => setFnoForm((p) => ({ ...p, optionType: e.target.value }))}>
                <option>CE</option><option>PE</option>
              </select>
              <input className={inputCls} placeholder="Strike" value={fnoForm.strike} onChange={(e) => setFnoForm((p) => ({ ...p, strike: e.target.value }))} />
              <input className={inputCls} type="date" value={fnoForm.expiry} onChange={(e) => setFnoForm((p) => ({ ...p, expiry: e.target.value }))} />
              </div>
            </>
          )}
          <div className="grid grid-cols-3 gap-2">
            <input className={inputCls} placeholder="Entry" value={fnoForm.entry} onChange={(e) => setFnoForm((p) => ({ ...p, entry: e.target.value }))} />
            <input className={inputCls} placeholder="Target" value={fnoForm.target} onChange={(e) => setFnoForm((p) => ({ ...p, target: e.target.value }))} />
            <input className={inputCls} placeholder="Stop Loss" value={fnoForm.stopLoss} onChange={(e) => setFnoForm((p) => ({ ...p, stopLoss: e.target.value }))} />
          </div>
          <textarea className={inputCls} rows={4} placeholder="Analysis..." value={fnoForm.analysis} onChange={(e) => setFnoForm((p) => ({ ...p, analysis: e.target.value }))} />
        </div>
      )}

      <button
        type="button"
        disabled={saving}
        onClick={handleSubmit}
        className="w-full py-2 rounded border border-[#39ff14]/40 bg-[#39ff14]/10 text-[#39ff14] text-[10px] font-black tracking-widest hover:bg-[#39ff14]/20 disabled:opacity-60"
      >
        {saving ? 'SUBMITTING...' : 'SUBMIT TRADE'}
      </button>

      {toast && (
        <div className="text-[10px] border border-[#00f2ff]/30 bg-[#00f2ff]/10 text-[#b4f4ff] px-2 py-1 rounded">
          {toast}
        </div>
      )}
    </div>
  );
};

export default ResearchAnalystPanel;

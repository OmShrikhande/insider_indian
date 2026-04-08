import { useState, useRef, useEffect } from 'react';
import { INDICATORS, INDICATOR_CATEGORIES } from '../lib/indicatorRegistry';

const IndicatorPanel = ({ activeIndicators, onToggle }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const panelRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const categories = ['All', ...INDICATOR_CATEGORIES];

  const filtered = INDICATORS.filter(ind => {
    const matchSearch = ind.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === 'All' || ind.category === activeCategory;
    return matchSearch && matchCat;
  });

  const activeCount = Object.values(activeIndicators).filter(Boolean).length;

  return (
    <div ref={panelRef} style={{ position: 'relative', display: 'inline-block', flexShrink: 0 }}>
      <button
        onClick={() => setIsOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 12px', fontSize: 10, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.12em',
          borderRadius: 4, cursor: 'pointer', transition: 'all 0.2s',
          background: isOpen ? 'rgba(0,242,255,0.08)' : '#0a0a0a',
          border: isOpen ? '1px solid #00f2ff' : '1px solid #1c2127',
          color: isOpen ? '#00f2ff' : '#848e9c',
          fontFamily: 'monospace',
        }}
        id="indicator-panel-btn"
      >
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 3v18h18M7 16l4-4 4 4 4-6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Indicators
        {activeCount > 0 && (
          <span className="bg-[#00f2ff] text-[#000000] rounded-full w-4 h-4 flex items-center justify-center text-[8px] font-black">
            {activeCount}
          </span>
        )}
        <svg className={`w-2.5 h-2.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 6,
            width: 520, background: '#000', border: '1px solid #1c2127',
            borderRadius: 6, boxShadow: '0 20px 60px rgba(0,0,0,0.8), 0 0 40px rgba(0,242,255,0.06)',
            zIndex: 9999, overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid #1c2127', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#00f2ff', fontFamily: 'monospace' }}>
              Technical Indicators — {INDICATORS.length} Available
            </span>
            <button
              onClick={() => INDICATORS.forEach(ind => onToggle(ind.id, false))}
              style={{ fontSize: 9, color: '#5d606b', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}
              onMouseEnter={e => e.target.style.color = '#ff003c'}
              onMouseLeave={e => e.target.style.color = '#5d606b'}
            >
              Clear All
            </button>
          </div>

          {/* Search */}
          <div style={{ padding: '10px 12px 6px' }}>
            <input
              type="text"
              placeholder="Search indicators..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', background: '#0a0a0a', border: '1px solid #1c2127', borderRadius: 4, padding: '8px 12px', fontSize: 11, color: '#d1d4dc', outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box' }}
              autoFocus
            />
          </div>

          {/* Category Tabs */}
          <div className="flex gap-1 px-3 pt-2.5 pb-1 overflow-x-auto no-scrollbar">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-wide transition-all ${
                  activeCategory === cat
                    ? 'bg-[#00f2ff]/10 text-[#00f2ff] border border-[#00f2ff]/40'
                    : 'text-[#5d606b] hover:text-[#848e9c] border border-transparent'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Indicator Grid */}
          <div className="max-h-80 overflow-y-auto p-3 custom-scrollbar">
            {filtered.length === 0 ? (
              <div className="text-center py-8 text-[#1c2127] font-mono text-[10px]">No indicators found</div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {filtered.map(ind => {
                  const isActive = activeIndicators[ind.id];
                  return (
                    <button
                      key={ind.id}
                      onClick={() => onToggle(ind.id, !isActive)}
                      className={`relative text-left px-2.5 py-2 rounded border transition-all group ${
                        isActive
                          ? 'border-[#1c2127] bg-[#0a0a0a]'
                          : 'border-[#111] bg-[#030303] hover:border-[#1c2127]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: ind.color }} />
                        <div className={`w-3.5 h-2 rounded-sm flex items-center justify-center transition-all ${
                          isActive ? 'bg-[#00f2ff]' : 'bg-[#1c2127]'
                        }`}>
                          {isActive && <div className="w-1 h-1 rounded-full bg-[#000000]" />}
                        </div>
                      </div>
                      <div className={`text-[9px] font-bold font-mono leading-tight truncate ${
                        isActive ? 'text-[#d1d4dc]' : 'text-[#5d606b] group-hover:text-[#848e9c]'
                      }`}>
                        {ind.name}
                      </div>
                      <div className="text-[8px] text-[#1c2127] font-mono">
                        {ind.pane === 'price' ? 'OVERLAY' : 'SUB-PANE'}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-[#1c2127] text-[9px] font-mono text-[#1c2127] flex justify-between">
            <span>{activeCount} active</span>
            <span>ProTrader v5 · {INDICATORS.length} indicators</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default IndicatorPanel;

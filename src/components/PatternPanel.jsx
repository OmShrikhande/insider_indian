import { useState, useRef, useEffect } from 'react';
import { PATTERNS, PATTERN_CATEGORIES } from '../lib/patternRegistry';

const biasColors = {
  bull: '#39ff14',
  bear: '#ff003c',
  neutral: '#848e9c',
};

const PatternPanel = ({ activePatterns, onToggle }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [hoveredPattern, setHoveredPattern] = useState(null);
  const panelRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = PATTERNS.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === 'All' || p.category === activeCategory;
    return matchSearch && matchCat;
  });

  const activeCount = Object.values(activePatterns).filter(Boolean).length;

  return (
    <div ref={panelRef} style={{ position: 'relative', display: 'inline-block', flexShrink: 0 }}>
      <button
        onClick={() => setIsOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 12px', fontSize: 10, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.12em',
          borderRadius: 4, cursor: 'pointer', transition: 'all 0.2s',
          background: isOpen ? 'rgba(57,255,20,0.08)' : '#0a0a0a',
          border: isOpen ? '1px solid #39ff14' : '1px solid #1c2127',
          color: isOpen ? '#39ff14' : '#848e9c',
          fontFamily: 'monospace',
        }}
        id="pattern-panel-btn"
      >
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2M9 7h.01" strokeLinecap="round"/>
        </svg>
        Patterns
        {activeCount > 0 && (
          <span className="bg-[#39ff14] text-[#000000] rounded-full w-4 h-4 flex items-center justify-center text-[8px] font-black">
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
            width: 480, background: '#000', border: '1px solid #1c2127',
            borderRadius: 6, boxShadow: '0 20px 60px rgba(0,0,0,0.8), 0 0 40px rgba(57,255,20,0.05)',
            zIndex: 9999, overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-[#1c2127] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#39ff14]" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#39ff14]">
                Candlestick Patterns — {PATTERNS.length} Available
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => PATTERNS.forEach(p => onToggle(p.id, true))}
                className="text-[9px] text-[#5d606b] hover:text-[#39ff14] uppercase font-bold transition-colors"
              >
                All On
              </button>
              <button
                onClick={() => PATTERNS.forEach(p => onToggle(p.id, false))}
                className="text-[9px] text-[#5d606b] hover:text-[#ff003c] uppercase font-bold transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Search */}
          <div style={{ padding: '10px 12px 6px' }}>
            <input
              type="text"
              placeholder="Search patterns..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', background: '#0a0a0a', border: '1px solid #1c2127', borderRadius: 4, padding: '8px 12px', fontSize: 11, color: '#d1d4dc', outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box' }}
              autoFocus
            />
          </div>

          {/* Category tabs */}
          <div className="flex gap-1 px-3 pt-2.5 pb-1">
            {PATTERN_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-wide transition-all ${
                  activeCategory === cat
                    ? 'bg-[#39ff14]/10 text-[#39ff14] border border-[#39ff14]/40'
                    : 'text-[#5d606b] hover:text-[#848e9c] border border-transparent'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Pattern list */}
          <div className="max-h-72 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-1">
            {filtered.length === 0 ? (
              <div className="text-center py-8 text-[#1c2127] font-mono text-[10px]">No patterns found</div>
            ) : (
              filtered.map(p => {
                const isActive = activePatterns[p.id];
                const bc = biasColors[p.bias];
                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between px-3 py-2 rounded border cursor-pointer transition-all group ${
                      isActive
                        ? 'border-[#1c2127] bg-[#060606]'
                        : 'border-transparent bg-transparent hover:border-[#1c2127]'
                    }`}
                    onClick={() => onToggle(p.id, !isActive)}
                    onMouseEnter={() => setHoveredPattern(p)}
                    onMouseLeave={() => setHoveredPattern(null)}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-1.5 h-4 rounded-sm shrink-0"
                        style={{ background: isActive ? bc : '#1c2127' }}
                      />
                      <div>
                        <div className={`text-[10px] font-bold font-mono ${isActive ? 'text-[#d1d4dc]' : 'text-[#5d606b] group-hover:text-[#848e9c]'}`}>
                          {p.name}
                        </div>
                        <div className="text-[8px] text-[#1c2127] font-mono">
                          {p.category} · {p.bias === 'bull' ? '↑ Bullish' : p.bias === 'bear' ? '↓ Bearish' : '↔ Neutral'}
                        </div>
                      </div>
                    </div>
                    <div className={`w-8 h-4 rounded-full flex items-center transition-all ${isActive ? 'bg-[#39ff14]/20 justify-end' : 'bg-[#0a0a0a] justify-start'}`}>
                      <div className={`w-3 h-3 rounded-full mx-0.5 transition-all ${isActive ? 'bg-[#39ff14]' : 'bg-[#1c2127]'}`} />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Tooltip / description */}
          {hoveredPattern && (
            <div className="px-4 py-2.5 border-t border-[#1c2127] bg-[#050505]">
              <div className="text-[9px] font-mono" style={{ color: biasColors[hoveredPattern.bias] }}>
                {hoveredPattern.name}
              </div>
              <div className="text-[10px] text-[#848e9c] mt-0.5">{hoveredPattern.description}</div>
            </div>
          )}

          {/* Footer */}
          <div className="px-4 py-2 border-t border-[#1c2127] text-[9px] font-mono text-[#1c2127] flex justify-between">
            <span>{activeCount} active</span>
            <span className="flex gap-3">
              <span style={{ color: '#39ff14' }}>● Bullish</span>
              <span style={{ color: '#ff003c' }}>● Bearish</span>
              <span style={{ color: '#848e9c' }}>● Neutral</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatternPanel;

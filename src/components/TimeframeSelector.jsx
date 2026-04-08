import { useState, useRef, useEffect } from 'react';

const TIMEFRAMES = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '1h', value: '1h' },
  { label: '1d', value: '1d' },
];

const TimeframeSelector = ({ selectedTimeframe, onTimeframeChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = TIMEFRAMES.find(t => t.value === selectedTimeframe) || TIMEFRAMES[3];

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', flexShrink: 0 }}>
      <button
        onClick={() => setIsOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 12px', fontSize: 12, fontWeight: 700,
          borderRadius: 4, cursor: 'pointer', transition: 'all 0.2s',
          background: '#0a0a0a',
          border: isOpen ? '1px solid #00f2ff' : '1px solid #1c2127',
          color: isOpen ? '#00f2ff' : '#d1d4dc',
          fontFamily: 'monospace',
        }}
      >
        {selected.label}
        <svg
          style={{ width: 10, height: 10, color: '#5d606b', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none' }}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4,
          width: 100, background: '#050505', border: '1px solid #1c2127',
          borderRadius: 4, boxShadow: '0 12px 40px rgba(0,0,0,0.9)',
          zIndex: 9999, overflow: 'hidden', padding: '4px 0',
        }}>
          {TIMEFRAMES.map(tf => (
            <button
              key={tf.value}
              onClick={() => { onTimeframeChange(tf.value); setIsOpen(false); }}
              style={{
                width: '100%', textAlign: 'left', padding: '8px 12px',
                fontSize: 12, fontFamily: 'monospace', fontWeight: 700,
                background: selectedTimeframe === tf.value ? '#0f0f0f' : 'transparent',
                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                color: selectedTimeframe === tf.value ? '#00f2ff' : '#848e9c',
                borderLeft: selectedTimeframe === tf.value ? '2px solid #00f2ff' : '2px solid transparent',
              }}
              onMouseEnter={e => { if (selectedTimeframe !== tf.value) { e.currentTarget.style.background = '#0a0a0a'; e.currentTarget.style.color = '#d1d4dc'; } }}
              onMouseLeave={e => { if (selectedTimeframe !== tf.value) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#848e9c'; } }}
            >
              {tf.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TimeframeSelector;
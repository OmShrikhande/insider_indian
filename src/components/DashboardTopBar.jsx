import React from 'react';
import TimeframeSelector from './TimeframeSelector';
import IndicatorPanel from './IndicatorPanel';
import PatternPanel from './PatternPanel';

/**
 * DashboardTopBar - Handles the header actions, F&O toggles, and UI settings.
 * ROAST FIX: Modularized the header to keep Dashboard.jsx focused on main layout.
 */
const DashboardTopBar = ({
  selectedSymbol,
  dataCount,
  onShowScreener,
  isFnoMode,
  onToggleFnoMode,
  fnoExpiry,
  onFnoExpiryChange,
  fnoStrike,
  onFnoStrikeChange,
  availableExpiries,
  availableStrikes,
  selectedTimeframe,
  onTimeframeChange,
  activeIndicators,
  onIndicatorToggle,
  activePatterns,
  onPatternToggle,
  showGrid,
  onToggleGrid,
  candleStyle,
  onCandleStyleChange,
  showSuggestScreen,
  onToggleSuggestScreen,
  onLogout,
  currentUser,
  showOptionChain,
  onToggleOptionChain
}) => {
  return (
    <div className="h-16 flex-shrink-0 bg-black/60 backdrop-blur-xl border-b border-[#1c2127]/50 flex items-center gap-6 px-6 relative z-[50] overflow-visible">
      {/* Symbol info */}
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="font-black text-xl text-[#00f2ff] tracking-tight">
            {selectedSymbol}
          </span>
          <span className="text-[10px] bg-[#00f2ff]/10 text-[#00f2ff] px-1.5 py-0.5 rounded border border-[#00f2ff]/20">PRO</span>
          
          <button onClick={onShowScreener} className="ml-2 px-2 py-0.5 bg-[#ffea00]/10 text-[#ffea00] border border-[#ffea00]/30 text-[9px] tracking-widest font-black rounded hover:bg-[#ffea00]/20 uppercase transition-all">
             SCREENER
          </button>
          <button
            onClick={onToggleSuggestScreen}
            className={`ml-2 px-2 py-0.5 text-[9px] tracking-widest font-black rounded uppercase border transition-all ${
              showSuggestScreen
                ? 'bg-[#00f2ff] text-black border-[#00f2ff]'
                : 'bg-transparent text-[#00f2ff] border-[#00f2ff]/30 hover:bg-[#00f2ff]/10'
            }`}
          >
            SUGGEST
          </button>

          <button onClick={onToggleFnoMode} className={`ml-2 px-2 py-0.5 text-[9px] tracking-widest font-black rounded uppercase border transition-all ${isFnoMode ? 'bg-[#39ff14]/10 text-[#39ff14] border-[#39ff14]/30 shadow-[0_0_8px_#39ff1433]' : 'bg-transparent text-[#848e9c] border-[#1c2127] hover:border-[#848e9c]'}`}>
             F&O_MODE
          </button>

          {isFnoMode && (
            <button 
              onClick={(e) => { e.stopPropagation(); onToggleOptionChain(); }} 
              className={`ml-2 px-2 py-0.5 text-[9px] tracking-widest font-black rounded uppercase border transition-all ${showOptionChain ? 'bg-[#00f2ff] text-black border-[#00f2ff]' : 'bg-transparent text-[#00f2ff] border-[#00f2ff]/30 hover:bg-[#00f2ff]/10'}`}
            >
               CHAIN
            </button>
          )}
        </div>
        <span className="text-[9px] text-[#39ff14] font-bold tracking-[0.3em] uppercase opacity-80">
          Live_Uplink / {dataCount} Bars
        </span>
      </div>

      {isFnoMode && (
         <div className="flex items-center gap-2">
           <select 
             value={fnoExpiry || ''} 
             onChange={onFnoExpiryChange}
             className="bg-black border border-[#1c2127] hover:border-[#00f2ff] text-[#00f2ff] text-[10px] uppercase font-mono p-1 rounded outline-none transition-colors"
           >
             {availableExpiries.map(exp => <option key={exp} value={exp}>{exp}</option>)}
           </select>
           <select 
             value={fnoStrike || ''} 
             onChange={onFnoStrikeChange}
             className="bg-black border border-[#1c2127] hover:border-[#00f2ff] text-[#00f2ff] text-[10px] uppercase font-mono p-1 rounded outline-none transition-colors"
           >
             {availableStrikes.map(st => <option key={st} value={st.toString()}>{st}</option>)}
           </select>
         </div>
      )}

      <div className="w-px h-8 bg-[#1c2127]/50" />

      <TimeframeSelector selectedTimeframe={selectedTimeframe} onTimeframeChange={onTimeframeChange} />

      <div className="w-px h-8 bg-[#1c2127]/50" />

      {/* Indicator, Pattern & Grid toggle buttons */}
      <div className="flex items-center gap-2">
        <select
          value={candleStyle}
          onChange={(e) => onCandleStyleChange?.(e.target.value)}
          className="h-8 bg-black border border-[#1c2127] hover:border-[#00f2ff] text-[#00f2ff] text-[10px] uppercase font-mono px-2 rounded outline-none transition-colors"
          title="Candle style"
        >
          <option value="default">Default</option>
          <option value="hollow">Hollow</option>
          <option value="mono">Mono</option>
        </select>
        <IndicatorPanel activeIndicators={activeIndicators} onToggle={onIndicatorToggle} />
        <PatternPanel activePatterns={activePatterns} onToggle={onPatternToggle} />
        <div className="w-px h-6 bg-[#1c2127] mx-1" />
        <button
          onClick={onToggleGrid}
          className={`h-8 px-3 rounded flex items-center justify-center transition-all ${
            showGrid ? 'bg-[#ff003c] text-white shadow-[0_0_10px_#ff003c44]' : 'bg-[#1c2127] text-[#848e9c] hover:bg-[#2a303c]'
          }`}
          title="Toggle Grid Lines"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <line x1="3" y1="9" x2="21" y2="9"/>
            <line x1="3" y1="15" x2="21" y2="15"/>
            <line x1="9" y1="3" x2="9" y2="21"/>
            <line x1="15" y1="3" x2="15" y2="21"/>
          </svg>
        </button>
      </div>

      <div className="flex-1" />

      {/* User info & Logout */}
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end">
           <span className="text-[10px] text-[#848e9c] uppercase font-bold tracking-widest">Operator</span>
           <span className="text-xs text-white font-black">{currentUser?.username || 'ANONYMOUS'}</span>
        </div>
        <button onClick={onLogout} className="w-8 h-8 rounded bg-[#1c2127] border border-[#ff003c]/20 flex items-center justify-center text-[#ff003c] hover:bg-[#ff003c] hover:text-white transition-all group shadow-inner">
           <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
             <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
           </svg>
        </button>
      </div>
    </div>
  );
};

export default DashboardTopBar;

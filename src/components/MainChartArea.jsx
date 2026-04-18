import React from 'react';
import CandlestickChart from './CandlestickChart';
import ChartErrorBoundary from './ChartErrorBoundary';

/**
 * MainChartArea - Handles the rendering of charts, loading states, and error handling.
 * ROAST FIX: Cleaned up the 'God' conditional rendering in Dashboard.jsx.
 */
const MainChartArea = ({
  loading,
  error,
  data,
  isFnoMode,
  selectedSymbol,
  selectedTimeframe,
  activeIndicators,
  activePatterns,
  showGrid,
  candleStyle,
  onInfoClick,
  fnoData,
  fnoStrike,
  /** Index (NIFTY/BANKNIFTY/FINNIFTY) OHLC for FNO left “spot” pane when equity stream has no bars for that symbol */
  fnoSpotData = [],
  fnoSpotLoading = false,
  focusedTrade = null,
}) => {
  const spotSeriesForFno =
    Array.isArray(fnoSpotData) && fnoSpotData.length > 0 ? fnoSpotData : data;

  // FNO Multi-Chart View (before empty-data gate: index underlyings have no rows in /api/stocks)
  if (isFnoMode) {
    return (
      <div className="absolute inset-0 flex">
        <div className="w-1/2 h-full border-r border-[#1c2127]">
          <ChartErrorBoundary>
            <CandlestickChart
              data={spotSeriesForFno}
              news={[]}
              symbol={`${selectedSymbol} (SPOT)`}
              timeframe={selectedTimeframe}
              activeIndicators={activeIndicators}
              activePatterns={activePatterns}
              showGrid={showGrid}
              candleStyle={candleStyle}
              onInfoClick={onInfoClick}
              focusedTrade={focusedTrade}
            />
          </ChartErrorBoundary>
          {!loading && !fnoSpotLoading && spotSeriesForFno.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/50">
              <span className="text-[10px] text-[#5d606b] font-mono tracking-widest text-center px-4">
                [ NO_SPOT_BARS — SYNC INDEX_OHLC OR SELECT AN EQUITY ]
              </span>
            </div>
          )}
          {fnoSpotLoading && (
            <div className="absolute top-3 left-3 text-[#00f2ff] text-[8px] font-mono animate-pulse z-10">
              LOADING_INDEX_SPOT...
            </div>
          )}
        </div>

        <div className="w-1/2 h-full flex flex-col">
          <div className="flex-1 border-b border-[#1c2127] relative">
            <ChartErrorBoundary>
              <CandlestickChart
                data={fnoData.peData}
                news={[]}
                symbol={`${selectedSymbol} PE ${fnoStrike}`}
                timeframe={selectedTimeframe}
                activeIndicators={activeIndicators}
                activePatterns={activePatterns}
                showGrid={showGrid}
                candleStyle={candleStyle}
                onInfoClick={onInfoClick}
                focusedTrade={focusedTrade}
              />
            </ChartErrorBoundary>
            {fnoData.loading && <div className="absolute top-4 right-4 text-[#ffea00] text-[8px] font-black animate-pulse tracking-widest z-10">SYNCING_PE...</div>}
          </div>

          <div className="flex-1 relative">
            <ChartErrorBoundary>
              <CandlestickChart
                data={fnoData.ceData}
                news={[]}
                symbol={`${selectedSymbol} CE ${fnoStrike}`}
                timeframe={selectedTimeframe}
                activeIndicators={activeIndicators}
                activePatterns={activePatterns}
                showGrid={showGrid}
                candleStyle={candleStyle}
                onInfoClick={onInfoClick}
                focusedTrade={focusedTrade}
              />
            </ChartErrorBoundary>
            {fnoData.loading && <div className="absolute top-4 right-4 text-[#ffea00] text-[8px] font-black animate-pulse tracking-widest z-10">SYNCING_CE...</div>}
          </div>
        </div>
      </div>
    );
  }

  // Loading State
  if (loading) {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-[#00f2ff] border-t-transparent rounded-full animate-spin shadow-[0_0_20px_#00f2ff33]" />
          <span className="text-[10px] tracking-[0.5em] text-[#00f2ff] font-bold animate-pulse">SYNCING_ASSETS_</span>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center p-6">
        <div className="elite-panel border-[#ff003c55] p-8 max-w-sm text-center bg-black/80 backdrop-blur">
          <div className="text-[10px] text-[#ff003c] font-black tracking-[0.2em] mb-4 uppercase">Critical_Connection_Failure</div>
          <div className="text-sm text-[#848e9c] mb-6 leading-relaxed uppercase">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-4 elite-button text-[#ff003c] border-[#ff003c33] rounded-lg tracking-widest text-[10px] hover:bg-[#ff003c] hover:text-white transition-all"
          >
            REBOOT_ROXEY_
          </button>
        </div>
      </div>
    );
  }

  // Empty State
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-[#050505]">
        <div className="flex flex-col items-center gap-2 opacity-20">
          <svg className="w-12 h-12 text-white/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
             <path d="M3 3v18h18" /><path d="M7 12l5 5 5-5" />
          </svg>
          <span className="text-sm tracking-[0.4em] font-black italic uppercase">[ NO_OHLCV_INTEL_CAPTURED ]</span>
        </div>
      </div>
    );
  }

  // Standard Single Chart View
  return (
    <ChartErrorBoundary>
      <CandlestickChart
        data={data}
        news={[]} // News handled by right panel
        symbol={selectedSymbol}
        timeframe={selectedTimeframe}
        activeIndicators={activeIndicators}
        activePatterns={activePatterns}
        showGrid={showGrid}
        candleStyle={candleStyle}
        onInfoClick={onInfoClick}
        focusedTrade={focusedTrade}
      />
    </ChartErrorBoundary>
  );
};

export default MainChartArea;

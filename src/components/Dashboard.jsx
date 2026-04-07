import { useState } from 'react';
import CandlestickChart from './CandlestickChart';
import TimeframeSelector from './TimeframeSelector';
import useStockData from '../hooks/useStockData';

const Dashboard = () => {
  const [selectedTimeframe, setSelectedTimeframe] = useState('1h');
  const [selectedSymbol, setSelectedSymbol] = useState('AAPL');
  const { data, loading, error } = useStockData(selectedSymbol, selectedTimeframe);

  const handleTimeframeChange = (timeframe) => {
    setSelectedTimeframe(timeframe);
  };

  const handleSymbolChange = (symbol) => {
    setSelectedSymbol(symbol);
  };

  return (
    <div className="h-screen bg-[#0a0a0a] text-[#b2b5be] flex flex-col">
      {/* Top Toolbar - TradingView Style */}
      <div className="bg-[#1a1a1a] border-b border-[#2a2e39] px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <select
            value={selectedSymbol}
            onChange={(e) => handleSymbolChange(e.target.value)}
            className="bg-[#0a0a0a] border border-[#2a2e39] text-[#d1d4dc] px-3 py-1 text-sm focus:outline-none focus:border-[#2962FF]"
          >
            <option value="AAPL">AAPL</option>
            <option value="GOOGL">GOOGL</option>
            <option value="MSFT">MSFT</option>
            <option value="TSLA">TSLA</option>
            <option value="AMZN">AMZN</option>
          </select>
          <TimeframeSelector
            selectedTimeframe={selectedTimeframe}
            onTimeframeChange={handleTimeframeChange}
          />
        </div>
      </div>

      {/* Chart Area - Full Screen */}
      <div className="flex-1 relative">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-[#758696]">Loading chart data...</div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-full">
            <div className="text-[#FF1744]">Error loading data: {error}</div>
          </div>
        )}

        {!loading && !error && data.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-[#758696]">No data available</div>
          </div>
        )}

        {!loading && !error && data.length > 0 && (
          <CandlestickChart
            data={data}
            height="100%"
          />
        )}
      </div>
    </div>
  );
};

export default Dashboard;
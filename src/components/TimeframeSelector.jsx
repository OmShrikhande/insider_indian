const TimeframeSelector = ({ selectedTimeframe, onTimeframeChange }) => {
  const timeframes = [
    { label: '1m', value: '1m' },
    { label: '5m', value: '5m' },
    { label: '15m', value: '15m' },
    { label: '30m', value: '30m' },
    { label: '1h', value: '1h' },
    { label: '4h', value: '4h' },
    { label: '1d', value: '1d' },
  ];

  // Map frontend timeframe to backend timeframe for API calls
  const getBackendTimeframe = (frontendTimeframe) => {
    return frontendTimeframe === '1d' ? 'daily' : 'hourly';
  };

  return (
    <div className="flex gap-1">
      {timeframes.map((timeframe) => (
        <button
          key={timeframe.value}
          onClick={() => onTimeframeChange(timeframe.value)}
          className={`px-2 py-1 text-xs font-medium transition-colors ${
            selectedTimeframe === timeframe.value
              ? 'bg-[#2962FF] text-white'
              : 'text-[#b2b5be] hover:text-[#d1d4dc] hover:bg-[#2a2e39]'
          }`}
        >
          {timeframe.label}
        </button>
      ))}
    </div>
  );
};

export default TimeframeSelector;
import { useEffect, useRef, useState } from 'react';
import { createChart, CrosshairMode } from 'lightweight-charts';

const CandlestickChart = ({ data, width = 800, height = 600 }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const [tooltipData, setTooltipData] = useState(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const containerWidth = chartContainerRef.current.clientWidth || width;
    const containerHeight = typeof height === 'string' && height === '100%'
      ? chartContainerRef.current.clientHeight
      : height;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#0a0a0a' },
        textColor: '#b2b5be',
      },
      grid: {
        vertLines: { color: '#1a1a1a' },
        horzLines: { color: '#1a1a1a' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          width: 1,
          color: '#758696',
          style: 0,
        },
        horzLine: {
          width: 1,
          color: '#758696',
          style: 0,
        },
      },
      rightPriceScale: {
        borderColor: '#2a2e39',
        textColor: '#b2b5be',
      },
      timeScale: {
        borderColor: '#2a2e39',
        textColor: '#b2b5be',
        timeVisible: true,
        secondsVisible: false,
      },
      width: containerWidth,
      height: containerHeight,
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    // Create candlestick series
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#00C853',
      downColor: '#FF1744',
      borderVisible: false,
      wickUpColor: '#00C853',
      wickDownColor: '#FF1744',
    });

    // Add crosshair move handler for tooltips
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData.size) {
        setTooltipData(null);
        return;
      }

      const candlestickData = param.seriesData.get(candlestickSeries);
      if (candlestickData) {
        setTooltipData({
          time: param.time,
          open: candlestickData.open,
          high: candlestickData.high,
          low: candlestickData.low,
          close: candlestickData.close,
          volume: candlestickData.volume || 0,
        });
      }
    });

    chartRef.current = { chart, candlestickSeries };

    return () => {
      chart.remove();
    };
  }, [width, height]);

  useEffect(() => {
    if (!chartRef.current || !data) return;

    const { candlestickSeries } = chartRef.current;
    candlestickSeries.setData(data);
  }, [data]);

  return (
    <div className="relative w-full h-full">
      <div
        ref={chartContainerRef}
        className="bg-[#0a0a0a] w-full h-full"
      />
      {tooltipData && (
        <div className="absolute top-4 left-4 bg-[#1a1a1a] text-[#b2b5be] p-3 rounded border border-[#2a2e39] shadow-lg z-10">
          <div className="text-sm font-medium mb-2 text-[#d1d4dc]">
            {new Date(tooltipData.time * 1000).toLocaleString()}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>Open: <span className="font-mono text-[#00C853]">{tooltipData.open.toFixed(2)}</span></div>
            <div>High: <span className="font-mono text-[#00C853]">{tooltipData.high.toFixed(2)}</span></div>
            <div>Low: <span className="font-mono text-[#FF1744]">{tooltipData.low.toFixed(2)}</span></div>
            <div>Close: <span className="font-mono">{tooltipData.close.toFixed(2)}</span></div>
            {tooltipData.volume > 0 && (
              <div className="col-span-2">
                Volume: <span className="font-mono text-[#b2b5be]">{tooltipData.volume.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CandlestickChart;
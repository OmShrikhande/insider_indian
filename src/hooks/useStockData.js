import { useState, useEffect, useCallback } from 'react';
import apiService from '../services/apiService';

const useStockData = (symbol = 'AAPL', timeframe = '1h') => {
  const [data, setData] = useState([]);
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [stockRes, newsRes] = await Promise.all([
        apiService.getStockData(symbol, timeframe),
        apiService.getLatestNews(symbol)
      ]);

      if (!stockRes.success) {
        throw new Error(stockRes.error || 'Failed to fetch stock data');
      }

      setData(stockRes.data || []);
      setNews(newsRes.data || []);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching stock data:', err);
      setData([]); 
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!symbol) return undefined;

    const streamUrl = apiService.getStockStreamUrl(symbol, timeframe, 3000);
    const eventSource = new EventSource(streamUrl);

    eventSource.addEventListener('stock_snapshot', (event) => {
      try {
        const payload = JSON.parse(event.data);
        setData(payload.data || []);
        setError(null);
        setLoading(false);
      } catch (err) {
        console.error('Failed to parse stock stream payload:', err);
      }
    });

    eventSource.addEventListener('error', () => {
      // Keep UI stable and reconnect automatically through EventSource.
    });

    return () => eventSource.close();
  }, [symbol, timeframe]);

  return { data, news, loading, error, refetch: fetchData };
};

export default useStockData;
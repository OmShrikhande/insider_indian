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

  return { data, news, loading, error, refetch: fetchData };
};

export default useStockData;
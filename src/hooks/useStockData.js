import { useState, useEffect, useCallback } from 'react';
import apiService from '../services/apiService';

const useStockData = (symbol = 'AAPL', timeframe = '1h') => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiService.getStockData(symbol, timeframe);

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch stock data');
      }

      // Data is already transformed by backend to match lightweight-charts format
      setData(response.data || []);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching stock data:', err);
      setData([]); // Clear data on error
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
};

export default useStockData;
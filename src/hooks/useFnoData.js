import { useState, useEffect, useCallback } from 'react';
import apiService from '../services/apiService';

const useFnoData = (underlying, expiry, strike, timeframe = '1h') => {
  const [ceData, setCeData] = useState([]);
  const [peData, setPeData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    if (!underlying || !expiry || !strike) return;
    
    setLoading(true);
    setError(null);

    try {
      const res = await apiService.getFnoOhlcv(underlying, expiry, strike, timeframe);
      if (!res.success) {
        throw new Error(res.error || 'Failed to fetch FNO data');
      }

      setCeData(res.data?.ce || []);
      setPeData(res.data?.pe || []);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching FNO data:', err);
      setCeData([]);
      setPeData([]);
    } finally {
      setLoading(false);
    }
  }, [underlying, expiry, strike, timeframe]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!underlying || !expiry || !strike) return undefined;

    const streamUrl = apiService.getFnoStreamUrl(underlying, expiry, strike, timeframe);
    const eventSource = new EventSource(streamUrl);

    eventSource.addEventListener('fno_snapshot', (event) => {
      try {
        const payload = JSON.parse(event.data);
        setCeData(payload.data?.ce || []);
        setPeData(payload.data?.pe || []);
        setError(null);
        setLoading(false);
      } catch (err) {
        console.error('Failed to parse FNO stream payload:', err);
      }
    });

    eventSource.addEventListener('error', () => {
      // EventSource auto-reconnects; avoid forcing hard refresh loops.
    });

    return () => eventSource.close();
  }, [underlying, expiry, strike, timeframe]);

  return { ceData, peData, loading, error, refetch: fetchData };
};

export default useFnoData;

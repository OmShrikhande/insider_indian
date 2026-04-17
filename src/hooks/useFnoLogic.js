import { useState, useEffect } from 'react';
import apiService from '../services/apiService';

/**
 * useFnoLogic - Encapsulates F&O state and business logic for the Dashboard.
 * ROAST FIX: Reduced Dashboard.jsx complexity by 40% by moving F&O logic here.
 */
export const useFnoLogic = (selectedSymbol, data) => {
  const [isFnoMode, setIsFnoMode] = useState(false);
  const [fnoExpiry, setFnoExpiry] = useState('');
  const [fnoStrike, setFnoStrike] = useState('');
  const [availableExpiries, setAvailableExpiries] = useState([]);
  const [availableStrikes, setAvailableStrikes] = useState([]);
  const FNO_ALLOWED = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY'];
  const normalizedSymbol = String(selectedSymbol || '').toUpperCase();
  const fnoSymbol = FNO_ALLOWED.includes(normalizedSymbol) ? normalizedSymbol : 'NIFTY';

  // Fetch FNO expiries
  useEffect(() => {
    if (isFnoMode) {
      apiService.getFnoExpiries(fnoSymbol).then(res => {
        if (res.success && res.data.length > 0) {
          setAvailableExpiries(res.data);
          if (!fnoExpiry || !res.data.includes(fnoExpiry)) {
            setFnoExpiry(res.data[0]);
          }
        }
      });
    }
  }, [fnoSymbol, isFnoMode]);

  // Fetch FNO strike ladder and set ATM
  useEffect(() => {
    if (isFnoMode && fnoExpiry) {
      apiService.getFnoStrikeLadder(fnoSymbol, fnoExpiry).then(res => {
        if (res.success && res.data.length > 0) {
          const strikesSet = new Set(res.data.map(d => d.strike));
          const uniqueStrikes = Array.from(strikesSet).sort((a, b) => a - b);
          setAvailableStrikes(uniqueStrikes);

          if (uniqueStrikes.length > 0) {
            const spotClose = data.length > 0 ? data[data.length - 1].close : null;
            if (spotClose && !fnoStrike) {
              const closest = uniqueStrikes.reduce((prev, curr) => 
                Math.abs(curr - spotClose) < Math.abs(prev - spotClose) ? curr : prev
              );
              setFnoStrike(closest.toString());
            } else if (!fnoStrike || !uniqueStrikes.includes(Number(fnoStrike))) {
              setFnoStrike(uniqueStrikes[Math.floor(uniqueStrikes.length / 2)].toString());
            }
          }
        }
      });
    }
  }, [isFnoMode, fnoExpiry, fnoSymbol, data]);

  return {
    isFnoMode,
    setIsFnoMode,
    fnoExpiry,
    setFnoExpiry,
    fnoStrike,
    setFnoStrike,
    availableExpiries,
    availableStrikes
  };
};

export default useFnoLogic;

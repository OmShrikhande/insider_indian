/**
 * Volume Profile (VP) Calculation Utility
 * Calculates volume distribution at price levels
 */

export const calculateVolumeProfile = (data, bins = 50) => {
  if (!data || data.length === 0) return [];

  const prices = data.map(d => d.close);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const range = maxPrice - minPrice;
  const binSize = range / bins;

  const profile = Array.from({ length: bins }, (_, i) => ({
    price: minPrice + (i * binSize),
    volume: 0,
    buyVolume: 0,
    sellVolume: 0
  }));

  data.forEach(d => {
    const binIndex = Math.min(Math.floor((d.close - minPrice) / binSize), bins - 1);
    profile[binIndex].volume += d.volume;
    if (d.close >= d.open) {
      profile[binIndex].buyVolume += d.volume;
    } else {
      profile[binIndex].sellVolume += d.volume;
    }
  });

  // Calculate POC (Point of Control)
  let maxVol = 0;
  let pocPrice = minPrice;
  profile.forEach(p => {
    if (p.volume > maxVol) {
      maxVol = p.volume;
      pocPrice = p.price;
    }
  });

  return {
    profile: profile.map(p => ({
      time: data[data.length - 1].time, // Align with chart time for overlay
      value: p.price,
      volume: p.volume,
      buyVolume: p.buyVolume,
      sellVolume: p.sellVolume
    })),
    poc: pocPrice,
    maxVolume: maxVol
  };
};

const express = require('express');

const router = express.Router();

const templates = [
  {
    id: 'breakout',
    name: 'Breakout',
    description: 'Trade momentum continuation above resistance with volume confirmation.',
    checklist: ['Price above range high', 'Volume > 20-period average', 'Trend filter positive', 'Defined stop-loss below breakout base'],
  },
  {
    id: 'reversal',
    name: 'Reversal',
    description: 'Capture exhaustion and mean transition at key support/resistance zones.',
    checklist: ['Pattern confirmation (engulfing/pin bar)', 'Divergence on momentum oscillator', 'Risk-reward >= 1:2', 'Invalidation level defined'],
  },
  {
    id: 'mean_reversion',
    name: 'Mean Reversion',
    description: 'Trade return-to-mean when price stretches from statistical baseline.',
    checklist: ['Price outside volatility band', 'Re-entry trigger candle', 'No major event risk nearby', 'Tight stop and reduced size'],
  },
];

router.get('/templates', (req, res) => {
  res.json({ success: true, data: templates });
});

module.exports = router;

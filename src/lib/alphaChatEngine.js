/**
 * Local, deterministic “pro” trading assistant — no network calls.
 * Uses pattern matching + context (symbol, FNO mode) for structured answers.
 */

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^\w\s?.,\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function riskBlurb() {
  return [
    'RISK_FRAMEWORK (local):',
    '1) Define max loss per trade as % of capital (e.g. 0.25–1%).',
    '2) Position size from stop distance: size = risk$ / |entry − stop|.',
    '3) Avoid averaging down without a new invalidation rule.',
    '4) For options: theta and IV crush are path risks — size smaller than spot.',
  ].join('\n');
}

function fnoBlurb(symbol, expiry) {
  const e = expiry ? `Expiry context: ${expiry}. ` : '';
  return [
    `${e}F&O_CHECKLIST:`,
    '• Align strike with intent: directional → slightly ITM/ATM; premium selling → defined risk spreads.',
    '• Watch PCR + OI build at strikes (cluster = magnet / barrier).',
    '• ATM moves with spot; re-check delta/gamma if spot gaps.',
    '• Liquidity: wide spreads → reduce size or avoid.',
  ].join('\n');
}

/**
 * @param {string} message
 * @param {{ selectedSymbol?: string, isFnoMode?: boolean, fnoExpiry?: string }} ctx
 */
export function alphaChatReply(message, ctx = {}) {
  const m = norm(message);
  const sym = String(ctx.selectedSymbol || '—').toUpperCase();
  const fno = Boolean(ctx.isFnoMode);
  const exp = ctx.fnoExpiry || '';

  if (!m) {
    return 'ALPHA // input empty. Type help for command matrix.';
  }

  if (m === 'help' || m === '?' || m === 'commands') {
    return [
      'ALPHA_LOCAL v1 // command matrix',
      '• help — this screen',
      '• risk — position sizing & drawdown discipline',
      '• fno — options checklist (uses FNO context if enabled)',
      '• pcr / oi / iv / theta / delta — concise definitions + how to read',
      '• smc / structure — liquidity / BOS framing (conceptual)',
      '• journal — post-trade review template',
      `• context: symbol=${sym} fno=${fno ? 'ON' : 'OFF'}${exp ? ` expiry=${exp}` : ''}`,
    ].join('\n');
  }

  if (m.includes('hello') || m.includes('hi ') || m === 'hi') {
    return `ALPHA // link established. Symbol ${sym}. ${fno ? 'FNO mode active.' : 'Spot mode.'} Say help for commands.`;
  }

  if (m.includes('risk') || m.includes('size') || m.includes('drawdown')) {
    return riskBlurb();
  }

  if (m.includes('fno') || m.includes('option') || m.includes('strike') || m.includes('expiry')) {
    return fnoBlurb(sym, exp);
  }

  if (m.includes('pcr')) {
    return 'PCR = put OI / call OI (or volume variant). High PCR often read as bearish positioning or hedging; low PCR the opposite. Always pair with price action and strike OI clusters — never in isolation.';
  }

  if (m.includes('oi') && (m.includes('open interest') || m.includes('oi'))) {
    return 'Open interest rises on new positions; falls on closes. Max pain / OI walls can act as magnets near expiry. Compare changes day-over-day at strikes, not absolute only.';
  }

  if (m.includes('iv ') || m.includes('implied vol')) {
    return 'IV reflects option premium richness. Rising IV → long premium harder unless move exceeds IV expansion. Selling premium needs IV percentile + risk caps.';
  }

  if (m.includes('theta')) {
    return 'Theta is daily time decay per option. ATM options decay nonlinearly into expiry. Short premium = collect theta; long premium = fight theta — need directional or IV edge.';
  }

  if (m.includes('delta')) {
    return 'Delta ≈ hedge ratio vs underlying. ATM ~0.5 (calls). Use delta to think probability proxy (rough) and to scale hedge, not as gospel.';
  }

  if (m.includes('gamma')) {
    return 'Gamma is delta sensitivity. High gamma near ATM into expiry → small spot moves swing delta fast; risk-manage size and stops accordingly.';
  }

  if (m.includes('smc') || m.includes('liquidity') || m.includes('structure')) {
    return 'SMC-style read (conceptual): map swing highs/lows, identify liquidity pools (equal highs/lows), anticipate sweeps vs reversals. Confirm with volume and higher-timeframe bias.';
  }

  if (m.includes('journal')) {
    return [
      'POST_TRADE_TEMPLATE:',
      '1) Setup name + timeframe',
      '2) Entry trigger + invalidation',
      '3) Actual vs planned R',
      '4) Emotional note (1 line)',
      '5) One improvement for next trade',
    ].join('\n');
  }

  if (m.includes('thank')) {
    return 'ALPHA // acknowledged. Stay mechanical; protect capital.';
  }

  // Symbol-specific generic
  if (sym && sym.length <= 32) {
    return [
      `ALPHA // query not in local lexicon. Context: ${sym}, FNO=${fno ? 'on' : 'off'}.`,
      'Try: help | risk | fno | pcr | iv | theta | journal',
      'Tip: ask short, precise keywords — this engine is rule-based (no external models).',
    ].join('\n');
  }

  return 'ALPHA // unrecognized. Type help.';
}

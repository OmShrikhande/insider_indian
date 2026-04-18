import { describe, it, expect } from 'vitest';
import { alphaChatReply } from './alphaChatEngine';

describe('alphaChatEngine', () => {
  it('returns help matrix', () => {
    const text = alphaChatReply('help', { selectedSymbol: 'NIFTY', isFnoMode: true, fnoExpiry: '2026-04-30' });
    expect(text).toContain('ALPHA_LOCAL v1');
    expect(text).toContain('context: symbol=NIFTY');
  });

  it('returns risk guidance', () => {
    const text = alphaChatReply('risk');
    expect(text).toContain('RISK_FRAMEWORK');
  });
});

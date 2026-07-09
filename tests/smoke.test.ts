import { describe, it, expect } from 'vitest';
import Decimal from 'break_infinity.js';

// Phase 0 sanity: the test harness runs and the big-number lib behaves.
describe('smoke', () => {
  it('runs the test harness', () => {
    expect(1 + 1).toBe(2);
  });

  it('handles numbers well beyond Number.MAX_VALUE', () => {
    const huge = new Decimal('1e400').times('1e400');
    expect(huge.toExponential(0)).toBe('1e+800');
    expect(Number.isFinite(Number('1e400'))).toBe(false); // native overflows; Decimal does not
  });
});

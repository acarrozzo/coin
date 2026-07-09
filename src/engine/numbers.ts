import Decimal from 'break_infinity.js';

export { Decimal };

export type Numeric = Decimal | number | string;

/** Coerce anything numeric into a Decimal. */
export const D = (v: Numeric = 0): Decimal => (v instanceof Decimal ? v : new Decimal(v));

export const ZERO: Decimal = new Decimal(0);
export const ONE: Decimal = new Decimal(1);

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

/**
 * Human-friendly number formatting for the UI.
 * < 1000 shows a floored integer; larger values use K/M/B… suffixes;
 * beyond the suffix table falls back to scientific notation.
 */
export function formatNumber(value: Numeric): string {
  const d = D(value);
  if (d.lt(0)) return '0';
  if (d.lt(1000)) {
    const n = d.toNumber();
    if (Number.isInteger(n)) return n.toString();
    // Show a couple of decimals for small fractional values (e.g. metals),
    // but floor once the whole part dominates.
    if (n < 10) return trimZeros(n.toFixed(2));
    return Math.floor(n).toString();
  }

  const tier = Math.floor(d.exponent / 3);
  if (tier < SUFFIXES.length) {
    const scaled = d.div(D(1000).pow(tier));
    const decimals = scaled.gte(100) ? 0 : scaled.gte(10) ? 1 : 2;
    return `${scaled.toFixed(decimals)}${SUFFIXES[tier]}`;
  }
  return d.toExponential(2).replace('e+', 'e');
}

/** Format a per-second rate, e.g. "2/s" or "1.5/s". */
export function formatRate(perSec: Numeric): string {
  const n = D(perSec).toNumber();
  const str = Number.isInteger(n) ? n.toString() : trimZeros(n.toFixed(2));
  return `${str}/s`;
}

/** Strip trailing zeros (and a dangling decimal point) from a fixed string. */
function trimZeros(s: string): string {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

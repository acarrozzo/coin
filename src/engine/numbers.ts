import Decimal from 'break_infinity.js';

export { Decimal };

export type Numeric = Decimal | number | string;

/** Coerce anything numeric into a Decimal. */
export const D = (v: Numeric = 0): Decimal => (v instanceof Decimal ? v : new Decimal(v));

export const ZERO: Decimal = new Decimal(0);
export const ONE: Decimal = new Decimal(1);

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

/**
 * Whether large numbers are collapsed to K/M/B… suffixes ("rounding"). Off by
 * default so numbers render in full (1112, not 1.1K). Wired to a reactive UI
 * store at runtime via `setRoundingSource`; the default keeps this module pure
 * and node-safe for engine tests, which never touch the store or localStorage.
 */
let roundingSource: () => boolean = () => false;
export function setRoundingSource(fn: () => boolean): void {
  roundingSource = fn;
}

/**
 * Human-friendly number formatting for the UI.
 * < 1000 shows a floored integer; larger values use K/M/B… suffixes when
 * rounding is enabled (beyond the suffix table falls back to scientific
 * notation). With rounding off, values ≥ 1000 render in full digits.
 */
export function formatNumber(value: Numeric, minDecimals = 0): string {
  const d = D(value);
  // Amounts may legitimately dip negative (an input deducted at cycle end after
  // it was spent elsewhere) — show the sign rather than hiding it as "0".
  if (d.lt(0)) return `-${formatNumber(d.neg(), minDecimals)}`;
  if (d.lt(1000)) {
    const n = d.toNumber();
    // Fractional resources (minDecimals > 0) always show their gather precision
    // at every quantity — "70.00 steel", "0.12300 coin" — so the decimal point
    // is never dropped, even for whole or large-in-range amounts.
    if (minDecimals > 0) return n.toFixed(minDecimals);
    if (Number.isInteger(n)) return n.toString();
    // Show extra precision for the tiny fractional metals (iron 0.1 … adamantium
    // 0.0001) so they don't read as "0", but floor once the whole part dominates.
    if (n < 10) {
      const decimals = n < 0.001 ? 5 : n < 0.01 ? 4 : n < 1 ? 3 : 2;
      return trimZeros(n.toFixed(decimals));
    }
    return Math.floor(n).toString();
  }

  // Rounding off: show the whole number in full digits, no suffix. Fractional
  // resources keep their gather precision; everything else floors to an integer.
  if (!roundingSource()) {
    return minDecimals > 0 ? d.toFixed(minDecimals) : d.floor().toFixed(0);
  }

  const tier = Math.floor(d.exponent / 3);
  if (tier < SUFFIXES.length) {
    const scaled = d.div(D(1000).pow(tier));
    const base = scaled.gte(100) ? 0 : scaled.gte(10) ? 1 : 2;
    // Keep a decimal point on suffixed fractional amounts too, so a large stack
    // never collapses to a bare "300K".
    const decimals = minDecimals > 0 ? Math.max(base, 2) : base;
    return `${scaled.toFixed(decimals)}${SUFFIXES[tier]}`;
  }
  return d.toExponential(2).replace('e+', 'e');
}

/**
 * Format a production rate in the line's own cycle terms, e.g. "3 gold / sec",
 * "2 iron / 3 sec". `perCycle` is the total output per cycle
 * (workers × outputPerCycle), `resourceName` the produced resource's name, and
 * `cycleSeconds` the cycle length. A 1s cycle renders as plain "/ sec".
 */
export function formatCycleRate(
  perCycle: Numeric,
  resourceName: string,
  cycleSeconds: number,
): string {
  const n = D(perCycle).toNumber();
  // Fractional producers emit tiny per-cycle amounts (the metals iron→adamantium
  // at 0.1…0.0001, coin at 0.00001). A flat toFixed(2) rounds mithril/adamantium/
  // coin to "0.00" → "0", so the rate reads as idle while gathering. Mirror
  // formatNumber's adaptive precision so the real gathered decimals show.
  let amount: string;
  if (Number.isInteger(n)) {
    amount = n.toString();
  } else {
    const decimals = n < 0.001 ? 5 : n < 0.01 ? 4 : n < 1 ? 3 : 2;
    amount = trimZeros(n.toFixed(decimals));
  }
  const per = cycleSeconds === 1 ? 'sec' : `${trimZeros(cycleSeconds.toFixed(2))} sec`;
  return `${amount} ${resourceName} / ${per}`;
}

/**
 * A signed per-second rate for a running production balance, e.g. "+4/s",
 * "-2.5/s", "0/s". The sign is always shown for a non-zero rate so a net drain
 * reads clearly; magnitude reuses formatNumber (K/M suffixes, trimmed fractions).
 */
export function formatSignedRate(value: Numeric): string {
  const d = D(value);
  if (d.eq(0)) return '0/s';
  return `${d.gt(0) ? '+' : '-'}${formatNumber(d.abs())}/s`;
}

/** Strip trailing zeros (and a dangling decimal point) from a fixed string. */
function trimZeros(s: string): string {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

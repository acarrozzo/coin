/**
 * Number-formatting preferences store.
 *
 * Owns the single "number rounding" toggle: when on, large numbers collapse to
 * K/M/B… suffixes (1.1K); when off (the default) they render in full (1112).
 *
 * The actual formatting lives in engine/numbers.ts, which stays node-safe for
 * engine tests. This store bridges the two by handing formatNumber a reactive
 * getter — because formatNumber reads it during template render, toggling here
 * re-renders every displayed number instantly, with no dependency from the
 * engine back onto the UI or localStorage.
 */
import { setRoundingSource } from '../engine/numbers';

const STORAGE_KEY = 'cc:rounding';

function createFormatStore() {
  // Default off → full numbers. Only an explicit saved "1" enables rounding.
  let rounding = $state(false);
  try {
    rounding = localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    // ignore — storage may be unavailable
  }

  // formatNumber calls this on every render, so the read is tracked and any
  // toggle invalidates the numbers currently on screen.
  setRoundingSource(() => rounding);

  function toggle(): void {
    rounding = !rounding;
    try {
      localStorage.setItem(STORAGE_KEY, rounding ? '1' : '0');
    } catch {
      // ignore
    }
  }

  return {
    get rounding() {
      return rounding;
    },
    toggle,
  };
}

export const format = createFormatStore();

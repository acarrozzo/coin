import type { GameState } from '../engine/state';
import { getProductionRate, getCapacity, unlockedResources } from '../engine/selectors';

/**
 * Advance resource stockpiles by `dt` seconds.
 * Production is linear per assigned worker and clamped to storage capacity.
 */
export function runProduction(state: GameState, dt: number): void {
  for (const id of unlockedResources(state)) {
    const rate = getProductionRate(state, id);
    if (rate.lte(0)) continue;

    const cap = getCapacity(state, id);
    const current = state.resources[id].amount;
    if (current.gte(cap)) {
      // Clamp down if capacity shrank (shouldn't happen, but keep state sane).
      if (current.gt(cap)) state.resources[id].amount = cap;
      continue;
    }

    const next = current.plus(rate.times(dt));
    state.resources[id].amount = next.gt(cap) ? cap : next;
  }
}

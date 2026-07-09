import type { GameState, ResourceId } from '../engine/state';
import { canUpgradeSettlement, getNextTier } from '../engine/selectors';

/**
 * Upgrade the settlement to the next tier if requirements are met.
 * Deducts the cost and raises the level (which lifts storage caps and unlocks
 * buildings/tiers). Returns whether it happened.
 */
export function upgradeSettlement(state: GameState): boolean {
  if (!canUpgradeSettlement(state)) return false;

  const next = getNextTier(state);
  if (!next) return false;

  for (const [rid, amount] of Object.entries(next.cost) as [ResourceId, number][]) {
    state.resources[rid].amount = state.resources[rid].amount.minus(amount);
  }
  state.level = next.level;
  return true;
}

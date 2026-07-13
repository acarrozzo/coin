import type { GameState } from '../engine/state';
import { canUpgradeSettlement, getNextTier, splitCost } from '../engine/selectors';

/**
 * Upgrade the settlement to the next tier if requirements are met.
 * Spends only the consumable resources in the cost (wood/stone/food); higher-end
 * resources are required to be held but not removed. Raises the level (which
 * lifts storage caps and unlocks buildings/tiers). Returns whether it happened.
 */
export function upgradeSettlement(state: GameState): boolean {
  if (!canUpgradeSettlement(state)) return false;

  const next = getNextTier(state);
  if (!next) return false;

  for (const [rid, amount] of splitCost(next.cost).consumed) {
    state.resources[rid].amount = state.resources[rid].amount.minus(amount);
  }
  state.level = next.level;
  return true;
}

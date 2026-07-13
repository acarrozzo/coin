import type { GameState, BuildingId } from '../engine/state';
import { canBuild, getNextBuildingLevel, splitCost } from '../engine/selectors';

/**
 * Construct the next level of a building if available and affordable.
 * Spends only the consumable resources in the cost (wood/stone/food); higher-end
 * resources are required to be held but not removed. Increments the level (which
 * raises the building's worker cap and unlocks its next production line). Returns
 * whether it happened.
 */
export function buildBuilding(state: GameState, id: BuildingId): boolean {
  if (!canBuild(state, id)) return false;

  const next = getNextBuildingLevel(state, id);
  if (!next) return false;

  for (const [rid, amount] of splitCost(next.cost).consumed) {
    state.resources[rid].amount = state.resources[rid].amount.minus(amount);
  }
  state.buildings[id].level += 1;
  return true;
}

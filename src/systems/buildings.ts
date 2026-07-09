import type { GameState, BuildingId, ResourceId } from '../engine/state';
import { canBuild, getNextBuildingLevel } from '../engine/selectors';

/**
 * Construct the next level of a building if available and affordable.
 * Deducts the cost and increments the level (which raises the building's
 * worker cap and unlocks its next production line). Returns whether it happened.
 */
export function buildBuilding(state: GameState, id: BuildingId): boolean {
  if (!canBuild(state, id)) return false;

  const next = getNextBuildingLevel(state, id);
  if (!next) return false;

  for (const [rid, amount] of Object.entries(next.cost) as [ResourceId, number][]) {
    state.resources[rid].amount = state.resources[rid].amount.minus(amount);
  }
  state.buildings[id].level += 1;
  return true;
}

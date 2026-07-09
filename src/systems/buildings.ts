import type { GameState, BuildingId, ResourceId } from '../engine/state';
import { canBuild, getNextBuildingLevel } from '../engine/selectors';

/**
 * Construct the next level of a building if affordable.
 * Deducts the cost, increments the level, and applies its effect
 * (raising settlement level; capacity multipliers are read from owned levels).
 * Returns whether the build happened.
 */
export function buildBuilding(state: GameState, id: BuildingId): boolean {
  if (!canBuild(state, id)) return false;

  const next = getNextBuildingLevel(state, id);
  if (!next) return false;

  for (const [rid, amount] of Object.entries(next.cost) as [ResourceId, number][]) {
    state.resources[rid].amount = state.resources[rid].amount.minus(amount);
  }

  state.buildings[id].level += 1;

  if (next.effect.setLevel && next.effect.setLevel > state.level) {
    state.level = next.effect.setLevel;
  }

  return true;
}

import { Decimal, D } from './numbers';
import type { GameState, ResourceId, BuildingId } from './state';
import { RESOURCES, RESOURCE_IDS } from '../content/resources';
import { BUILDINGS, BUILDING_IDS, type ResourceCost, type BuildingLevel } from '../content/buildings';

/** Is a resource available at the current settlement level? */
export function isResourceUnlocked(state: GameState, id: ResourceId): boolean {
  return state.level >= RESOURCES[id].unlockedAtLevel;
}

export function unlockedResources(state: GameState): ResourceId[] {
  return RESOURCE_IDS.filter((id) => isResourceUnlocked(state, id));
}

/** Combined capacity multiplier from every owned building level. */
export function capMultiplier(state: GameState): Decimal {
  let mult = D(1);
  for (const bid of BUILDING_IDS) {
    const owned = state.buildings[bid].level;
    const def = BUILDINGS[bid];
    for (let i = 0; i < owned; i++) {
      const capMult = def.levels[i]?.effect.capMult;
      if (capMult) mult = mult.times(capMult);
    }
  }
  return mult;
}

export function getCapacity(state: GameState, id: ResourceId): Decimal {
  return D(RESOURCES[id].baseCap).times(capMultiplier(state));
}

/** Workers not currently assigned to any resource. */
export function getAvailableWorkers(state: GameState): number {
  let used = 0;
  for (const id of RESOURCE_IDS) used += state.workers.assigned[id];
  return state.workers.total - used;
}

/** Nominal production per second (ignores capacity). */
export function getProductionRate(state: GameState, id: ResourceId): Decimal {
  if (!isResourceUnlocked(state, id)) return D(0);
  return D(state.workers.assigned[id]).times(RESOURCES[id].perWorker);
}

export function isAtCapacity(state: GameState, id: ResourceId): boolean {
  return state.resources[id].amount.gte(getCapacity(state, id));
}

/** Effective production per second (0 when storage is full). */
export function getEffectiveRate(state: GameState, id: ResourceId): Decimal {
  return isAtCapacity(state, id) ? D(0) : getProductionRate(state, id);
}

export function getNextBuildingLevel(state: GameState, id: BuildingId): BuildingLevel | null {
  const def = BUILDINGS[id];
  const owned = state.buildings[id].level;
  return owned < def.levels.length ? def.levels[owned] : null;
}

export function isBuildingMaxed(state: GameState, id: BuildingId): boolean {
  return getNextBuildingLevel(state, id) === null;
}

export function canAfford(state: GameState, cost: ResourceCost): boolean {
  for (const [rid, amount] of Object.entries(cost) as [ResourceId, number][]) {
    if (state.resources[rid].amount.lt(amount)) return false;
  }
  return true;
}

export function canBuild(state: GameState, id: BuildingId): boolean {
  const next = getNextBuildingLevel(state, id);
  return next !== null && canAfford(state, next.cost);
}

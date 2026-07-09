import { Decimal, D } from './numbers';
import type { GameState, ResourceId, BuildingId } from './state';
import { RESOURCE_IDS } from '../content/resources';
import { BUILDINGS } from '../content/buildings';
import { PRODUCERS, type StructureId } from '../content/producers';
import { getTier, SETTLEMENT_TIERS, type ResourceCost } from '../content/settlement';
import { ASSAULT, HEX, UNIT_IDS, UNIT_POWER, WARD_POWER, type ThreatConfig } from '../content/combat';

// ---------- Structures ----------

export function getStructureLevel(state: GameState, structure: StructureId): number {
  return structure === 'settlement' ? state.level : state.buildings[structure].level;
}

// ---------- Producers / resources ----------

export function isResourceUnlocked(state: GameState, id: ResourceId): boolean {
  const p = PRODUCERS[id];
  return p !== undefined && getStructureLevel(state, p.structure) >= p.minLevel;
}

export function unlockedResources(state: GameState): ResourceId[] {
  return RESOURCE_IDS.filter((id) => isResourceUnlocked(state, id));
}

/** Absolute storage capacity, or null if the resource is uncapped. */
export function getCapacity(state: GameState, id: ResourceId): Decimal | null {
  const cap = getTier(state.level)?.caps[id];
  return cap === undefined ? null : D(cap);
}

export function isAtCapacity(state: GameState, id: ResourceId): boolean {
  const cap = getCapacity(state, id);
  return cap !== null && state.resources[id].amount.gte(cap);
}

/** Nominal production per second (workers × rate; ignores inputs and caps). */
export function getProductionRate(state: GameState, id: ResourceId): Decimal {
  const p = PRODUCERS[id];
  if (!p || !isResourceUnlocked(state, id)) return D(0);
  const perWorker = p.outputPerCycle / p.cycleSeconds;
  return D(state.workers.assigned[id]).times(perWorker);
}

// ---------- Workers ----------

export function getTotalWorkers(state: GameState): number {
  return state.workers.trained + state.workers.bonus;
}

export function getAssignedTotal(state: GameState): number {
  let used = 0;
  for (const id of RESOURCE_IDS) used += state.workers.assigned[id];
  return used;
}

export function getAvailableWorkers(state: GameState): number {
  return getTotalWorkers(state) - getAssignedTotal(state);
}

/** Max workers assignable to a single line. */
export function getMaxWorkers(state: GameState, id: ResourceId): number {
  const p = PRODUCERS[id];
  if (!p) return 0;
  return p.workerCap === 'pool' ? getTotalWorkers(state) : getStructureLevel(state, p.structure);
}

/** Food cost to train the next worker (floor(trained² / 2), from the original). */
export function getWorkerCost(state: GameState): Decimal {
  const n = state.workers.trained;
  return D(Math.floor((n * n) / 2));
}

export function canTrainWorker(state: GameState): boolean {
  return state.resources.food.amount.gte(getWorkerCost(state));
}

// ---------- Affordability ----------

export function canAfford(state: GameState, cost: ResourceCost): boolean {
  for (const [rid, amount] of Object.entries(cost) as [ResourceId, number][]) {
    if (state.resources[rid].amount.lt(amount)) return false;
  }
  return true;
}

// ---------- Buildings ----------

export function isBuildingAvailable(state: GameState, id: BuildingId): boolean {
  return state.level >= BUILDINGS[id].availableAtLevel;
}

export function getNextBuildingLevel(state: GameState, id: BuildingId) {
  const def = BUILDINGS[id];
  const owned = state.buildings[id].level;
  return owned < def.levels.length ? def.levels[owned] : null;
}

export function isBuildingMaxed(state: GameState, id: BuildingId): boolean {
  return getNextBuildingLevel(state, id) === null;
}

export function canBuild(state: GameState, id: BuildingId): boolean {
  if (!isBuildingAvailable(state, id)) return false;
  const next = getNextBuildingLevel(state, id);
  return next !== null && canAfford(state, next.cost);
}

// ---------- Settlement ----------

export function getNextTier(state: GameState) {
  return SETTLEMENT_TIERS.find((t) => t.level === state.level + 1) ?? null;
}

export function canUpgradeSettlement(state: GameState): boolean {
  const next = getNextTier(state);
  if (!next) return false;
  if (next.workersRequired && state.workers.trained < next.workersRequired) return false;
  return canAfford(state, next.cost);
}

// ---------- Combat ----------

export function isCombatUnlocked(state: GameState): boolean {
  return state.level >= ASSAULT.unlockLevel;
}

export function isHexUnlocked(state: GameState): boolean {
  return state.level >= HEX.unlockLevel;
}

/** Total combat power of the standing army. */
export function getArmyPower(state: GameState): Decimal {
  let power = D(0);
  for (const id of UNIT_IDS) {
    power = power.plus(state.resources[id].amount.times(UNIT_POWER[id] ?? 0));
  }
  return power;
}

/** Total defensive power of your wards (vs hexes). */
export function getWardPower(state: GameState): Decimal {
  return state.resources.ward.amount.times(WARD_POWER);
}

/** Threat power at a given wave for a threat track. */
export function getThreatPower(cfg: ThreatConfig, wave: number): Decimal {
  return D(cfg.basePower).times(Math.pow(cfg.growth, wave));
}

export function getNextAssaultPower(state: GameState): Decimal {
  return getThreatPower(ASSAULT, state.combat.assault.wave);
}

export function getNextHexPower(state: GameState): Decimal {
  return getThreatPower(HEX, state.combat.hex.wave);
}

/** Would the current army repel the next assault? (UI forecast) */
export function willRepelAssault(state: GameState): boolean {
  return getArmyPower(state).gte(getNextAssaultPower(state));
}

export function willBreakHex(state: GameState): boolean {
  return getWardPower(state).gte(getNextHexPower(state));
}

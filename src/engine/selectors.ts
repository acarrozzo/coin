import { Decimal, D } from './numbers';
import type { GameState, ResourceId, BuildingId } from './state';
import { RESOURCE_IDS, isConsumableResource } from '../content/resources';
import { BUILDINGS } from '../content/buildings';
import { PRODUCERS, PRODUCER_IDS, type StructureId } from '../content/producers';
import { getTier, SETTLEMENT_TIERS, type ResourceCost } from '../content/settlement';
import { ASSAULT, HEX, type ThreatConfig } from '../content/combat';

/** Stat resources whose cap comes from a building level, not a settlement tier. */
const BUILDING_CAP_SOURCES: Partial<
  Record<ResourceId, { building: BuildingId; key: 'defenseMax' | 'wardMax' | 'coinMax' }>
> = {
  defense: { building: 'castle', key: 'defenseMax' },
  ward: { building: 'wizardtower', key: 'wardMax' },
  coin: { building: 'bank', key: 'coinMax' },
};

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

/**
 * Absolute storage capacity, or null if the resource is uncapped.
 * wood/stone/food are capped by the settlement tier; defense/ward/coin by the
 * building that sets them (0 until that building is built).
 */
export function getCapacity(state: GameState, id: ResourceId): Decimal | null {
  const source = BUILDING_CAP_SOURCES[id];
  if (source) {
    const level = state.buildings[source.building].level;
    if (level <= 0) return D(0);
    return D(BUILDINGS[source.building].levels[level - 1].sets?.[source.key] ?? 0);
  }
  const cap = getTier(state.level)?.caps[id];
  return cap === undefined ? null : D(cap);
}

export function isAtCapacity(state: GameState, id: ResourceId): boolean {
  const cap = getCapacity(state, id);
  return cap !== null && state.resources[id].amount.gte(cap);
}

/**
 * Whether a production line may BEGIN a fresh cycle right now.
 *
 * Two gates, both checked only at cycle start (the atomic model):
 *  1. Inputs — all-or-nothing: every ingredient must be present in full for all
 *     N assigned workers (N × inputs[rid]); a partially-fed line makes nothing.
 *  2. Capacity — there must be at least some room for the output; a line at cap
 *     stays idle rather than burning inputs for nothing.
 *
 * The check is start-only: once a cycle is committed it runs to completion even
 * if inputs are spent elsewhere in the meantime (that deduction is allowed to go
 * negative — see production.ts).
 */
export function canStartCycle(state: GameState, id: ResourceId): boolean {
  const p = PRODUCERS[id];
  if (!p) return false;
  const workers = state.workers.assigned[id];
  if (workers <= 0 || !isResourceUnlocked(state, id)) return false;

  const cap = getCapacity(state, id);
  if (cap !== null && cap.minus(state.resources[id].amount).lte(0)) return false;

  if (p.inputs) {
    for (const [rid, qty] of Object.entries(p.inputs) as [ResourceId, number][]) {
      if (state.resources[rid].amount.lt(workers * qty)) return false;
    }
  }
  return true;
}

/** Nominal production per second (workers × rate; ignores inputs and caps). */
export function getProductionRate(state: GameState, id: ResourceId): Decimal {
  const p = PRODUCERS[id];
  if (!p || !isResourceUnlocked(state, id)) return D(0);
  const perWorker = p.outputPerCycle / p.cycleSeconds;
  return D(state.workers.assigned[id]).times(perWorker);
}

/**
 * Net nominal rate for a resource per second: what its own line produces minus
 * what every staffed line across the economy consumes it as an input. Nominal —
 * it counts each staffed worker at full throughput, ignoring input starvation and
 * capacity gating, so it reads as the intended running balance rather than the
 * instantaneous gated rate. Used by the Core Resources rows to show the overall
 * +/- rate of wood/stone/food as production and consumption shift.
 */
export function getNetProductionRate(state: GameState, id: ResourceId): Decimal {
  let rate = getProductionRate(state, id);
  for (const pid of PRODUCER_IDS) {
    const qty = PRODUCERS[pid]?.inputs?.[id];
    if (!qty) continue;
    const workers = state.workers.assigned[pid];
    if (workers <= 0) continue;
    rate = rate.minus(D(workers).times(qty).div(PRODUCERS[pid]!.cycleSeconds));
  }
  return rate;
}

/**
 * Live net rate: the per-second balance the simulation will actually apply right
 * now, honoring the same gating a real tick does. Two differences from the
 * nominal getNetProductionRate:
 *  - Consumers are counted only if they can currently start a cycle — a line
 *    starved on another input, or whose own output is at cap, draws nothing, so
 *    it isn't subtracted (the nominal figure subtracts it regardless).
 *  - A resource sitting at its cap can't climb, so a surplus reads as stable
 *    (0/s) rather than the "+X" its producers would nominally add. A genuine
 *    deficit at cap still shows the negative rate it will fall at.
 * This is what the Core rows show as the headline number; the nominal rate rides
 * beneath it as the "if every staffed line ran at full" target.
 */
export function getLiveNetProductionRate(state: GameState, id: ResourceId): Decimal {
  let rate = getProductionRate(state, id);
  for (const pid of PRODUCER_IDS) {
    const qty = PRODUCERS[pid]?.inputs?.[id];
    if (!qty) continue;
    const workers = state.workers.assigned[pid];
    if (workers <= 0 || !canStartCycle(state, pid)) continue;
    rate = rate.minus(D(workers).times(qty).div(PRODUCERS[pid]!.cycleSeconds));
  }
  // At cap the amount can't rise: a surplus is really "holding steady", not "+X".
  if (rate.gt(0) && isAtCapacity(state, id)) return D(0);
  return rate;
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
  if (typeof p.workerCap === 'number') return p.workerCap;
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

/**
 * Partition a cost into what is spent vs. what is only required to be held.
 * Consumed entries are deducted on purchase; required entries are gated by
 * canAfford but never removed from inventory.
 */
export function splitCost(cost: ResourceCost): {
  consumed: [ResourceId, number][];
  required: [ResourceId, number][];
} {
  const consumed: [ResourceId, number][] = [];
  const required: [ResourceId, number][] = [];
  for (const entry of Object.entries(cost) as [ResourceId, number][]) {
    (isConsumableResource(entry[0]) ? consumed : required).push(entry);
  }
  return { consumed, required };
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
  if (!next) return false;
  if (next.requiresLevel && state.level < next.requiresLevel) return false;
  return canAfford(state, next.cost);
}

// ---------- Settlement ----------

export function getNextTier(state: GameState) {
  return SETTLEMENT_TIERS.find((t) => t.level === state.level + 1) ?? null;
}

/** Standing thresholds (not consumed) are met — e.g. defense ≥ 5. */
export function meetsRequirements(state: GameState, req: ResourceCost | undefined): boolean {
  if (!req) return true;
  for (const [rid, amount] of Object.entries(req) as [ResourceId, number][]) {
    if (state.resources[rid].amount.lt(amount)) return false;
  }
  return true;
}

export function canUpgradeSettlement(state: GameState): boolean {
  const next = getNextTier(state);
  if (!next) return false;
  if (next.workersRequired && state.workers.trained < next.workersRequired) return false;
  if (!meetsRequirements(state, next.requires)) return false;
  return canAfford(state, next.cost);
}

// ---------- Combat ----------

export function isCombatUnlocked(state: GameState): boolean {
  return state.level >= ASSAULT.unlockLevel;
}

export function isHexUnlocked(state: GameState): boolean {
  return state.level >= HEX.unlockLevel;
}

/** Current value of the stat that defends against a threat (defense / ward). */
export function getDefenseStat(state: GameState, cfg: ThreatConfig): Decimal {
  return state.resources[cfg.defenseStat].amount;
}

/** Attack power at a given wave for a threat track. */
export function getThreatPower(cfg: ThreatConfig, wave: number): Decimal {
  return D(cfg.basePower).times(Math.pow(cfg.growth, wave));
}

export function getNextAssaultPower(state: GameState): Decimal {
  return getThreatPower(ASSAULT, state.combat.assault.wave);
}

export function getNextHexPower(state: GameState): Decimal {
  return getThreatPower(HEX, state.combat.hex.wave);
}

/** Would the current defense repel the next assault? (UI forecast) */
export function willRepelAssault(state: GameState): boolean {
  return getDefenseStat(state, ASSAULT).gte(getNextAssaultPower(state));
}

export function willBreakHex(state: GameState): boolean {
  return getDefenseStat(state, HEX).gte(getNextHexPower(state));
}

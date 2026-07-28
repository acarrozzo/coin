import { Decimal, D } from './numbers';
import type { GameState, ResourceId, BuildingId } from './state';
import { RESOURCE_IDS, isConsumableResource } from '../content/resources';
import { BUILDINGS } from '../content/buildings';
import { PRODUCERS, PRODUCER_INPUTS, getConsumers, type StructureId } from '../content/producers';
import { getTier, SETTLEMENT_TIERS, type ResourceCost } from '../content/settlement';
import { ASSAULT, HEX, type ThreatConfig } from '../content/combat';
import {
  SELL_OFFERS,
  SELLABLE_RESOURCES,
  RATE_UNLOCK_COST,
  RATE_UNLOCK_RESOURCES,
  WORKER_CONTRACTS,
  WORKER_CONTRACT_IDS,
  FOOD_PURCHASE_COST,
  FULL_MARKET_LEVEL,
  type SellableResource,
  type SellOffer,
  type RateUnlockResource,
  type WorkerContractId,
} from '../content/market';
import { PRESTIGE_UNLOCK_LEVEL, getPrestigeTier, type PrestigeTier } from '../content/prestige';

/** Stat resources whose cap comes from a building level, not a settlement tier. */
const BUILDING_CAP_SOURCES: Partial<
  Record<ResourceId, { building: BuildingId; key: 'defenseMax' | 'wardMax' }>
> = {
  defense: { building: 'castle', key: 'defenseMax' },
  ward: { building: 'wizardtower', key: 'wardMax' },
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
 * Capacities are content constants, so the same handful of numbers is re-wrapped
 * as a Decimal thousands of times a second (every tick's cycle gate, every
 * resource row). Cache one Decimal per distinct value and hand out the shared
 * instance — safe because Decimal arithmetic is non-mutating throughout
 * (numbers.ts wraps break_infinity, whose ops all return new instances), so no
 * caller can write through the reference.
 */
const capCache = new Map<number, Decimal>();
function cachedCap(value: number): Decimal {
  let d = capCache.get(value);
  if (!d) {
    d = D(value);
    capCache.set(value, d);
  }
  return d;
}

/**
 * Absolute storage capacity, or null if the resource is uncapped.
 * wood/stone/food are capped by the settlement tier; defense/ward by the
 * building that sets them (0 until that building is built). Coin is uncapped.
 */
export function getCapacity(state: GameState, id: ResourceId): Decimal | null {
  const source = BUILDING_CAP_SOURCES[id];
  if (source) {
    const level = state.buildings[source.building].level;
    if (level <= 0) return cachedCap(0);
    return cachedCap(BUILDINGS[source.building].levels[level - 1].sets?.[source.key] ?? 0);
  }
  const cap = getTier(state.level)?.caps[id];
  return cap === undefined ? null : cachedCap(cap);
}

export function isAtCapacity(state: GameState, id: ResourceId): boolean {
  const cap = getCapacity(state, id);
  return cap !== null && state.resources[id].amount.gte(cap);
}

/**
 * Display-facing "storage full": at capacity AND that capacity is real. A cap of
 * 0 (defense/ward before their building exists) is at-capacity for production
 * purposes but shouldn't read as "full" to the player.
 */
export function isStorageFull(state: GameState, id: ResourceId): boolean {
  const cap = getCapacity(state, id);
  return cap !== null && cap.gt(0) && state.resources[id].amount.gte(cap);
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

  for (const [rid, qty] of PRODUCER_INPUTS[id]) {
    if (state.resources[rid].amount.lt(workers * qty)) return false;
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
  for (const c of getConsumers(id)) {
    const workers = state.workers.assigned[c.id];
    if (workers <= 0) continue;
    rate = rate.minus(D(workers).times(c.qty).div(c.cycleSeconds));
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
  for (const c of getConsumers(id)) {
    const workers = state.workers.assigned[c.id];
    if (workers <= 0 || !canStartCycle(state, c.id)) continue;
    rate = rate.minus(D(workers).times(c.qty).div(c.cycleSeconds));
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

/**
 * Food cost to train the next worker. Worker 1 is free (n=0 → 0). Worker 2
 * costs 1 food (floor(1/2)=0 naturally, so we floor the minimum to 1 for n≥1).
 * Above that the original floor(n²/2) curve applies.
 */
export function getWorkerCost(state: GameState): Decimal {
  const n = state.workers.trained;
  return D(n === 0 ? 0 : Math.max(1, Math.floor((n * n) / 2)));
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

/**
 * The next level exists but is locked behind a settlement tier you haven't
 * reached (its `requiresLevel`). The UI hides such an upgrade outright rather
 * than dangling an unpressable button — settlement level is not something you
 * can act on from a building card, so there is nothing to work toward there.
 * Distinct from the building's own `availableAtLevel` gate, which still shows.
 */
export function isNextBuildingLevelGated(state: GameState, id: BuildingId): boolean {
  const next = getNextBuildingLevel(state, id);
  return !!next?.requiresLevel && state.level < next.requiresLevel;
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

/**
 * Does a threat track need supplying? True when its stat sits below the cap its
 * building allows, or when its line isn't fully staffed — either way the player
 * has slack to take up. A cap of 0 (building not yet raised) returns false:
 * there's nothing actionable on the line until the structure exists.
 */
export function needsThreatSupply(state: GameState, stat: 'defense' | 'ward'): boolean {
  const gaps = threatSupplyGaps(state, stat);
  return gaps.belowCap || gaps.understaffed;
}

/**
 * The two separate reasons a threat track can be under-supplied. Split out
 * because they call for different actions — feed the stat, or staff the line —
 * and the alert dots name which one is actually wrong.
 */
export function threatSupplyGaps(
  state: GameState,
  stat: 'defense' | 'ward',
): { belowCap: boolean; understaffed: boolean } {
  const cap = getCapacity(state, stat);
  // A cap of 0 (building not yet raised) means nothing is actionable yet.
  if (cap === null || cap.lte(0)) return { belowCap: false, understaffed: false };
  return {
    belowCap: state.resources[stat].amount.lt(cap),
    understaffed: (state.workers.assigned[stat] ?? 0) < getMaxWorkers(state, stat),
  };
}

/**
 * The inputs a threat line couldn't cover at FULL staffing — the things you'd
 * have to make before putting anyone on it would achieve anything. Defense is
 * built from archers, ward from mages and troll skulls; without them the line
 * is blocked however well staffed it is.
 *
 * Deliberately measured against getMaxWorkers rather than current staffing: an
 * empty line with no archers should report the archers, not the empty slot, or
 * you fix the staffing and only then discover the real problem.
 *
 * Empty before the capping building exists — nothing on this track is
 * actionable until there's somewhere to put the stat.
 */
export function threatInputGaps(state: GameState, stat: 'defense' | 'ward'): ResourceId[] {
  const cap = getCapacity(state, stat);
  if (cap === null || cap.lte(0)) return [];
  const workers = getMaxWorkers(state, stat);
  if (workers <= 0) return [];
  return PRODUCER_INPUTS[stat]
    .filter(([rid, qty]) => state.resources[rid].amount.lt(workers * qty))
    .map(([rid]) => rid);
}

// ---------- Market ----------

/** A resource's sale, or null once it has been taken. One per resource, ever. */
export function getSellOffer(state: GameState, id: SellableResource): SellOffer | null {
  return state.market.sold[id] ? null : SELL_OFFERS[id];
}

/** Can the sale be made — still unsold and the stock is on hand. */
export function canSell(state: GameState, id: SellableResource): boolean {
  const offer = getSellOffer(state, id);
  return offer !== null && state.resources[id].amount.gte(offer.amount);
}

/** Whether a core resource's overall-rate display has been unlocked. */
export function isRateUnlocked(state: GameState, id: ResourceId): boolean {
  return (
    (RATE_UNLOCK_RESOURCES as readonly ResourceId[]).includes(id) &&
    state.market.rateUnlocks[id as RateUnlockResource]
  );
}

/** Can a core rate display be unlocked — not already owned and coin on hand. */
export function canBuyRateUnlock(state: GameState, id: RateUnlockResource): boolean {
  return !state.market.rateUnlocks[id] && state.resources.coin.amount.gte(RATE_UNLOCK_COST);
}

/** Can a Worker Contract be signed — not already signed and coin is on hand. */
export function canBuyWorkerContract(state: GameState, id: WorkerContractId): boolean {
  return !state.market.contracts[id] && state.resources.coin.amount.gte(WORKER_CONTRACTS[id].cost);
}

/** Can the food purchase be made — not already bought and coin is on hand. */
export function canBuyFood(state: GameState): boolean {
  return !state.market.foodBought && state.resources.coin.amount.gte(FOOD_PURCHASE_COST);
}

/** Whether the level-gated half of the Market (rates, contracts) is open yet. */
export function isFullMarketOpen(state: GameState): boolean {
  return state.level >= FULL_MARKET_LEVEL;
}

/** Whether a sale is past its level gate — it may still be unaffordable. */
export function isSellUnlocked(state: GameState, id: SellableResource): boolean {
  return state.level >= SELL_OFFERS[id].minLevel;
}

/**
 * Sales that can be completed right now: unsold, past their level gate, and
 * with the stock on hand. Drives the Market's Sell tab badge.
 */
export function countSellOpportunities(state: GameState): number {
  return SELLABLE_RESOURCES.filter((id) => isSellUnlocked(state, id) && canSell(state, id)).length;
}

/**
 * Purchases that can be made right now: unbought, past their level gate, and
 * affordable. Drives the Market's Buy tab badge.
 */
export function countBuyOpportunities(state: GameState): number {
  // The food supply is the one purchase available before the full Market opens.
  let n = canBuyFood(state) ? 1 : 0;
  if (isFullMarketOpen(state)) {
    n += RATE_UNLOCK_RESOURCES.filter((id) => canBuyRateUnlock(state, id)).length;
    n += WORKER_CONTRACT_IDS.filter((id) => canBuyWorkerContract(state, id)).length;
  }
  return n;
}

/**
 * Everything actionable in the Market right now — the main Market tab's badge.
 * By construction it is exactly the sum of the two sub-tab badges, so the number
 * on the outside always equals the two you find inside.
 */
export function countMarketOpportunities(state: GameState): number {
  return countSellOpportunities(state) + countBuyOpportunities(state);
}

/**
 * True if any Market action is currently available. Derived from the same count
 * the tab badges use, so no two places can disagree about whether there's
 * something to do.
 */
export function hasMarketOpportunity(state: GameState): boolean {
  return countMarketOpportunities(state) > 0;
}

// ---------- Prestige ----------

/**
 * The Prestige zone is visible from the unlock level onward — and stays visible
 * for anyone who has ever prestiged, since a prestige drops them back to level 0
 * and the tab must not vanish out from under them.
 */
export function isPrestigeUnlocked(state: GameState): boolean {
  return state.level >= PRESTIGE_UNLOCK_LEVEL || state.prestige.level > 0;
}

/** The tier a prestige would grant next, or null once they're all taken. */
export function getNextPrestigeTier(state: GameState): PrestigeTier | null {
  return getPrestigeTier(state.prestige.level + 1) ?? null;
}

/**
 * Whether the player can prestige right now: a tier is left, they're at the
 * unlock level, and they *hold* its thresholds. Nothing is deducted — the
 * requirement is standing, like a settlement tier's `requires`.
 */
export function canPrestige(state: GameState): boolean {
  if (state.level < PRESTIGE_UNLOCK_LEVEL) return false;
  const next = getNextPrestigeTier(state);
  return next !== null && meetsRequirements(state, next.requires);
}

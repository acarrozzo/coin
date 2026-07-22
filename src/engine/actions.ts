import type { GameState, ResourceId } from './state';
import {
  getAvailableWorkers,
  getMaxWorkers,
  isResourceUnlocked,
  canTrainWorker,
  getWorkerCost,
  getCapacity,
  canSellTier,
  canBuyRateUnlock,
  canBuyWorkerContract,
} from './selectors';
import {
  SELL_TIERS,
  RATE_UNLOCK_COST,
  WORKER_CONTRACTS,
  type SellableResource,
  type RateUnlockResource,
} from '../content/market';

/**
 * Move workers on/off a production line. `delta` is typically +1 / -1.
 * Clamps to [0, min(line cap, assigned + available pool)].
 */
export function assignWorker(state: GameState, id: ResourceId, delta: number): void {
  if (delta === 0 || !isResourceUnlocked(state, id)) return;

  const current = state.workers.assigned[id];

  if (delta > 0) {
    const available = getAvailableWorkers(state);
    if (available <= 0) return;
    const headroom = getMaxWorkers(state, id) - current;
    if (headroom <= 0) return;
    state.workers.assigned[id] = current + Math.min(delta, available, headroom);
  } else {
    state.workers.assigned[id] = Math.max(0, current + delta);
  }
}

/** Train one worker, paying the current food cost. Returns whether it happened. */
export function trainWorker(state: GameState): boolean {
  if (!canTrainWorker(state)) return false;
  state.resources.food.amount = state.resources.food.amount.minus(getWorkerCost(state));
  state.workers.trained += 1;
  return true;
}

// ---------- Manual early game ----------
//
// The very first resources come from working by hand, before you have the
// workforce/buildings to automate. Foraging is always available; chopping and
// mining need a hatchet/pickaxe. (coin-old gated these behind a coin economy
// that was never finished, so we use a small coherent food/wood cost instead.)

const TOOL_COST = { hatchet: { food: 5 }, pickaxe: { wood: 5 } } as const;

/** Add one unit of a gathered resource by hand, respecting storage caps. */
function gatherByHand(state: GameState, id: ResourceId): boolean {
  const cap = getCapacity(state, id);
  if (cap !== null && state.resources[id].amount.gte(cap)) return false;
  state.resources[id].amount = state.resources[id].amount.plus(1);
  return true;
}

export function forage(state: GameState): boolean {
  return gatherByHand(state, 'food');
}

export function chopWood(state: GameState): boolean {
  if (!state.flags.hatchet) return false;
  return gatherByHand(state, 'wood');
}

export function mineStone(state: GameState): boolean {
  if (!state.flags.pickaxe) return false;
  return gatherByHand(state, 'stone');
}

/** Buy an early-game tool, unlocking a manual gathering action. */
export function buyTool(state: GameState, tool: 'hatchet' | 'pickaxe'): boolean {
  if (state.flags[tool]) return false;
  const cost = TOOL_COST[tool];
  for (const [rid, amount] of Object.entries(cost) as [ResourceId, number][]) {
    if (state.resources[rid].amount.lt(amount)) return false;
  }
  for (const [rid, amount] of Object.entries(cost) as [ResourceId, number][]) {
    state.resources[rid].amount = state.resources[rid].amount.minus(amount);
  }
  state.flags[tool] = true;
  return true;
}

// ---------- Market ----------
//
// Coin is earned only here, by selling weapons in three one-time, escalating
// tiers (see content/market.ts). It is then spent on rate-display unlocks and
// Worker Contracts. See selectors.ts for the affordability/availability reads.

/**
 * Sell the next available tier of a weapon: consume the stock, pay out coin, and
 * advance that weapon's tier. Returns whether the sale happened.
 */
export function sellResourceTier(state: GameState, id: SellableResource): boolean {
  if (!canSellTier(state, id)) return false;
  const tier = SELL_TIERS[state.market.sellTier[id]];
  state.resources[id].amount = state.resources[id].amount.minus(tier.amount);
  state.resources.coin.amount = state.resources.coin.amount.plus(tier.coin);
  state.market.coinEarned = state.market.coinEarned.plus(tier.coin);
  state.market.sellTier[id] += 1;
  return true;
}

/** Reveal a core resource's overall-rate display, paying 10 coin. */
export function buyRateUnlock(state: GameState, id: RateUnlockResource): boolean {
  if (!canBuyRateUnlock(state, id)) return false;
  state.resources.coin.amount = state.resources.coin.amount.minus(RATE_UNLOCK_COST);
  state.market.rateUnlocks[id] = true;
  return true;
}

/** Buy the next Worker Contract, adding its bonus workers to the pool. */
export function buyWorkerContract(state: GameState): boolean {
  if (!canBuyWorkerContract(state)) return false;
  const contract = WORKER_CONTRACTS[state.market.workerContract];
  state.resources.coin.amount = state.resources.coin.amount.minus(contract.cost);
  state.workers.bonus += contract.workers;
  state.market.workerContract += 1;
  return true;
}

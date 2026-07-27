import type { GameState, ResourceId } from './state';
import {
  getAvailableWorkers,
  getMaxWorkers,
  isResourceUnlocked,
  canTrainWorker,
  getWorkerCost,
  canSell,
  canBuyRateUnlock,
  canBuyWorkerContract,
  canBuyFood,
} from './selectors';
import {
  SELL_OFFERS,
  RATE_UNLOCK_COST,
  WORKER_CONTRACTS,
  FOOD_PURCHASE_COST,
  FOOD_PURCHASE_AMOUNT,
  type SellableResource,
  type RateUnlockResource,
  type WorkerContractId,
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

// ---------- Market ----------
//
// Coin is earned only here, by selling resources — each sellable resource has
// exactly one sale, taken once (see content/market.ts). Coin is then spent on
// the food purchase, rate-display unlocks, and Worker Contracts, all equally
// one-and-done. See selectors.ts for the affordability/availability reads.

/**
 * Take a resource's sale: consume the stock, pay out coin, and mark it sold.
 * That resource can never be sold again. Returns whether the sale happened.
 */
export function sellResource(state: GameState, id: SellableResource): boolean {
  if (!canSell(state, id)) return false;
  const offer = SELL_OFFERS[id];
  state.resources[id].amount = state.resources[id].amount.minus(offer.amount);
  state.resources.coin.amount = state.resources.coin.amount.plus(offer.coin);
  state.market.coinEarned = state.market.coinEarned.plus(offer.coin);
  state.market.sold[id] = true;
  return true;
}

/** Reveal a core resource's overall-rate display, paying RATE_UNLOCK_COST coin. */
export function buyRateUnlock(state: GameState, id: RateUnlockResource): boolean {
  if (!canBuyRateUnlock(state, id)) return false;
  state.resources.coin.amount = state.resources.coin.amount.minus(RATE_UNLOCK_COST);
  state.market.rateUnlocks[id] = true;
  return true;
}

/** Sign a Worker Contract, adding its bonus workers to the pool permanently. */
export function buyWorkerContract(state: GameState, id: WorkerContractId): boolean {
  if (!canBuyWorkerContract(state, id)) return false;
  const contract = WORKER_CONTRACTS[id];
  state.resources.coin.amount = state.resources.coin.amount.minus(contract.cost);
  state.workers.bonus += contract.workers;
  state.market.contracts[id] = true;
  return true;
}

/**
 * Make the one-time food purchase: spend FOOD_PURCHASE_COST coin, gain
 * FOOD_PURCHASE_AMOUNT food. Returns whether it happened.
 */
export function buyFood(state: GameState): boolean {
  if (!canBuyFood(state)) return false;
  state.resources.coin.amount = state.resources.coin.amount.minus(FOOD_PURCHASE_COST);
  state.resources.food.amount = state.resources.food.amount.plus(FOOD_PURCHASE_AMOUNT);
  state.market.foodBought = true;
  return true;
}

/**
 * The Market — coin economy, as data.
 *
 * Coin is earned only through the Market. Four resources can be sold in
 * one-time escalating tiers:
 *   - wood and stone: 1 tier each (3 → 1 coin), available from level 1
 *   - arrows and spears: 5 tiers each (100–1,000,000 → 10–100,000 coin)
 *
 * Lifetime coin ceiling = sum of all sell tiers across all sellable resources.
 * Everything bought here is priced within that budget.
 *
 * Food can also be purchased with coin (2 one-time purchases of 10 food for
 * 1 coin each), bridging the early game before the Farm comes online.
 */
import type { ResourceId } from './resources';

/** Resources that can be sold for coin at the Market. */
export const SELLABLE_RESOURCES = ['wood', 'stone', 'arrow', 'spear'] as const;
export type SellableResource = (typeof SELLABLE_RESOURCES)[number];

export interface SellTier {
  /** Stock consumed to complete this sale. */
  amount: number;
  /** Coin paid out. */
  coin: number;
}

/**
 * Per-resource sell tier definitions.
 * wood and stone have a single early-game tier; arrow and spear have five.
 * All tiers are one-time sales — consumed in order.
 */
export const SELL_TIER_DEFS: Record<SellableResource, readonly SellTier[]> = {
  wood: [{ amount: 3, coin: 1 }],
  stone: [{ amount: 3, coin: 1 }],
  arrow: [
    { amount: 100, coin: 10 },
    { amount: 1_000, coin: 100 },
    { amount: 10_000, coin: 1_000 },
    { amount: 100_000, coin: 10_000 },
    { amount: 1_000_000, coin: 100_000 },
  ],
  spear: [
    { amount: 100, coin: 10 },
    { amount: 1_000, coin: 100 },
    { amount: 10_000, coin: 1_000 },
    { amount: 100_000, coin: 10_000 },
    { amount: 1_000_000, coin: 100_000 },
  ],
};

/** Lifetime coin ceiling: every sell tier, every resource. */
export const MAX_COIN_EARNED = SELLABLE_RESOURCES.reduce(
  (sum, id) => sum + SELL_TIER_DEFS[id].reduce((s, t) => s + t.coin, 0),
  0,
);

/** Core resources whose overall-rate display is unlocked at the Market. */
export const RATE_UNLOCK_RESOURCES = ['wood', 'stone', 'food'] as const satisfies readonly ResourceId[];
export type RateUnlockResource = (typeof RATE_UNLOCK_RESOURCES)[number];

/** Roman-numeral label per rate unlock, in resource order (wood I, stone II, food III). */
export const RATE_UNLOCK_NUMERAL: Record<RateUnlockResource, string> = {
  wood: 'I',
  stone: 'II',
  food: 'III',
};

/** Each core rate display costs a flat 10 coin to reveal; buyable in any order. */
export const RATE_UNLOCK_COST = 10;

export interface WorkerContract {
  /** Bonus workers this contract grants. */
  workers: number;
  /** Coin cost. */
  cost: number;
}

/**
 * Worker Contracts I / II / III — sold in order, each a one-time purchase that
 * adds permanent bonus workers to the pool.
 */
export const WORKER_CONTRACTS: readonly WorkerContract[] = [
  { workers: 1, cost: 10 },
  { workers: 2, cost: 100 },
  { workers: 3, cost: 1_000 },
];

/**
 * Early-game food purchases — a one-time bootstrap before the Farm comes online.
 * Each purchase costs FOOD_PURCHASE_COST coin and grants FOOD_PURCHASE_AMOUNT food.
 * Can be bought at most FOOD_PURCHASE_COUNT times (tracked by market.foodBought).
 */
export const FOOD_PURCHASE_COST = 1;
export const FOOD_PURCHASE_AMOUNT = 5;
export const FOOD_PURCHASE_COUNT = 2;

/**
 * The Market — coin economy, as data.
 *
 * Coin is no longer minted; it is earned once and only through the Market. Two
 * weapons (arrows and spears) can be sold in five escalating, one-time tiers.
 * That makes the coin supply finite: 5 tiers × 2 weapons, worth 1 + 10 + 100 +
 * 1,000 + 10,000 each, is a hard lifetime ceiling of 22,222 coin
 * (`MAX_COIN_EARNED`). Everything bought here is priced within that budget.
 */
import type { ResourceId } from './resources';

/** Weapons that can be sold for coin at the Market. */
export const SELLABLE_RESOURCES = ['arrow', 'spear'] as const;
export type SellableResource = (typeof SELLABLE_RESOURCES)[number];

export interface SellTier {
  /** Stock consumed to complete this sale. */
  amount: number;
  /** Coin paid out. */
  coin: number;
}

/**
 * The five sell tiers, sold in order (tier N unlocks only after tier N−1).
 * Each is a one-time sale — ten sales total across arrows + spears.
 */
export const SELL_TIERS: readonly SellTier[] = [
  { amount: 100, coin: 10 },
  { amount: 1_000, coin: 100 },
  { amount: 10_000, coin: 1_000 },
  { amount: 100_000, coin: 10_000 },
  { amount: 1_000_000, coin: 100_000 },
];

/** Lifetime coin ceiling: every sell tier, both weapons. */
export const MAX_COIN_EARNED = SELLABLE_RESOURCES.length *
  SELL_TIERS.reduce((sum, t) => sum + t.coin, 0);

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
 * adds permanent bonus workers to the pool (replaces the old arrow-paid recruit).
 */
export const WORKER_CONTRACTS: readonly WorkerContract[] = [
  { workers: 1, cost: 10 },
  { workers: 2, cost: 100 },
  { workers: 3, cost: 1_000 },
];

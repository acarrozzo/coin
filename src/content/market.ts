/**
 * The Market — coin economy, as data.
 *
 * Every Market offer is one-and-done: it can be taken exactly once, then it is
 * spent for good. There are no tiers, chains, or repeat purchases anywhere here.
 *
 * Coin is earned only by selling, and only four resources sell:
 *   wood and stone (3 → 1 coin) from level 1, arrows (100 → 10) and spears
 *   (10 → 10) once the full Market opens.
 *
 * That fixes the lifetime coin ceiling at MAX_COIN_EARNED = 22, and every
 * purchase below is priced so the sinks total *exactly* 22. A player who takes
 * every sale can afford every purchase, with nothing left over and nothing
 * wasted — the coin economy closes perfectly.
 *
 *   earn   wood 1 + stone 1 + arrow 10 + spear 10      = 22
 *   spend  food 1 + rates 3×2 + contracts (3 + 5 + 7)  = 22
 */
import type { ResourceId } from './resources';

/** The Market (coin economy) unlocks at this settlement level. */
export const MARKET_UNLOCK_LEVEL = 1;
/**
 * Rate displays, Worker Contracts, and the weapon sales are held back to this
 * level. Lives here rather than in the UI because the engine needs it too: a
 * level-gated offer must not count as an available opportunity.
 */
export const FULL_MARKET_LEVEL = 3;

/** Resources that can be sold for coin at the Market. */
export const SELLABLE_RESOURCES = ['wood', 'stone', 'arrow', 'spear'] as const;
export type SellableResource = (typeof SELLABLE_RESOURCES)[number];

export interface SellOffer {
  /** Stock consumed to complete this sale. */
  amount: number;
  /** Coin paid out. */
  coin: number;
  /**
   * How the goods are named in copy — "100 arrows", "3 wood". Spelled out per
   * resource rather than pluralised with a blanket "s", because wood and stone
   * are mass nouns ("3 wood", not "3 woods").
   */
  noun: string;
  /** Settlement level before which this sale is offered but locked. */
  minLevel: number;
}

/** The single sale available per resource. Once taken, that resource is done. */
export const SELL_OFFERS: Record<SellableResource, SellOffer> = {
  wood: { amount: 3, coin: 1, noun: 'wood', minLevel: MARKET_UNLOCK_LEVEL },
  stone: { amount: 3, coin: 1, noun: 'stone', minLevel: MARKET_UNLOCK_LEVEL },
  arrow: { amount: 100, coin: 10, noun: 'arrows', minLevel: FULL_MARKET_LEVEL },
  spear: { amount: 10, coin: 10, noun: 'spears', minLevel: FULL_MARKET_LEVEL },
};

/** Lifetime coin ceiling: every sale, once. */
export const MAX_COIN_EARNED = SELLABLE_RESOURCES.reduce(
  (sum, id) => sum + SELL_OFFERS[id].coin,
  0,
);

/** Core resources whose overall-rate display is unlocked at the Market. */
export const RATE_UNLOCK_RESOURCES = [
  'wood',
  'stone',
  'food',
] as const satisfies readonly ResourceId[];
export type RateUnlockResource = (typeof RATE_UNLOCK_RESOURCES)[number];

/** Each core rate display costs a flat 2 coin to reveal; buyable in any order. */
export const RATE_UNLOCK_COST = 2;

/**
 * Worker Contracts — three independent one-and-done hires, not a chain. All
 * three are offered at once and may be signed in any order; each adds its
 * bonus workers to the pool permanently.
 */
export const WORKER_CONTRACT_IDS = ['i', 'ii', 'iii'] as const;
export type WorkerContractId = (typeof WORKER_CONTRACT_IDS)[number];

export interface WorkerContract {
  /** Roman numeral shown in the offer's name. */
  numeral: string;
  /** Bonus workers this contract grants. */
  workers: number;
  /** Coin cost. */
  cost: number;
}

export const WORKER_CONTRACTS: Record<WorkerContractId, WorkerContract> = {
  i: { numeral: 'I', workers: 1, cost: 3 },
  ii: { numeral: 'II', workers: 2, cost: 5 },
  iii: { numeral: 'III', workers: 3, cost: 7 },
};

/**
 * Early-game food purchase — a single bootstrap before the Farm comes online.
 * One purchase, once, tracked by `market.foodBought`.
 */
export const FOOD_PURCHASE_COST = 1;
export const FOOD_PURCHASE_AMOUNT = 10;

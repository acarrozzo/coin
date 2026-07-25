import { Decimal, D } from './numbers';
import { RESOURCE_IDS, type ResourceId } from '../content/resources';
import { BUILDING_IDS, type BuildingId } from '../content/buildings';
import { ASSAULT, HEX } from '../content/combat';

export type { ResourceId, BuildingId };

/** Bumped whenever the save shape changes; drives migrations (see save.ts). */
export const SAVE_VERSION = 7;

/** Trained workers the player starts with. */
export const STARTING_WORKERS = 0;

export interface ResourceState {
  amount: Decimal;
}

export interface GameState {
  version: number;
  /** Epoch ms the save was first created. */
  createdAt: number;
  /** Epoch ms of the last simulated moment; anchors offline catch-up. */
  lastTick: number;
  /** Total seconds simulated. */
  playtime: number;
  /** Settlement level — the spine of progression. */
  level: number;
  resources: Record<ResourceId, ResourceState>;
  workers: {
    /** Workers trained via food; drives the training cost curve. */
    trained: number;
    /** Bonus workers from other sources (none yet; reserved). */
    bonus: number;
    /** Workers assigned per production line (keyed by output resource). */
    assigned: Record<ResourceId, number>;
  };
  buildings: Record<BuildingId, { level: number }>;
  /**
   * Per-line cycle progress in seconds toward the current cycle. Production is
   * atomic: a line accumulates time here and only emits when a whole cycle
   * completes. Transient runtime state — deliberately not persisted (cycles are
   * ≤60s, so losing in-flight progress on reload is negligible).
   */
  production: {
    progress: Record<ResourceId, number>;
  };
  combat: {
    /** Assault track: seconds to next attack, current wave, and tallies. */
    assault: ThreatState;
    /** Hex track. */
    hex: ThreatState;
  };
  /** Market progress — the coin economy (see content/market.ts). */
  market: MarketState;
}

export interface MarketState {
  /** Lifetime coin ever earned — the "max accumulated" score (never spent down). */
  coinEarned: Decimal;
  /** Highest sell tier completed per sellable resource (0-N, sold sequentially). */
  sellTier: { wood: number; stone: number; arrow: number; spear: number };
  /** Which core-resource rate displays have been unlocked. */
  rateUnlocks: { wood: boolean; stone: boolean; food: boolean };
  /** Highest Worker Contract purchased (0–3, bought sequentially). */
  workerContract: number;
  /** How many one-time food purchases have been made (0–2). */
  foodBought: number;
}

export interface ThreatState {
  timer: number;
  wave: number;
  wins: number;
  losses: number;
}

/** A fresh game. `now` is injected so tests stay deterministic. */
export function createInitialState(now: number): GameState {
  const resources = {} as Record<ResourceId, ResourceState>;
  const assigned = {} as Record<ResourceId, number>;
  const progress = {} as Record<ResourceId, number>;
  for (const id of RESOURCE_IDS) {
    resources[id] = { amount: D(0) };
    assigned[id] = 0;
    progress[id] = 0;
  }

  const buildings = {} as Record<BuildingId, { level: number }>;
  for (const id of BUILDING_IDS) {
    buildings[id] = { level: 0 };
  }

  return {
    version: SAVE_VERSION,
    createdAt: now,
    lastTick: now,
    playtime: 0,
    level: 0,
    resources,
    workers: { trained: STARTING_WORKERS, bonus: 0, assigned },
    buildings,
    production: { progress },
    combat: {
      assault: { timer: ASSAULT.intervalSeconds, wave: 0, wins: 0, losses: 0 },
      hex: { timer: HEX.intervalSeconds, wave: 0, wins: 0, losses: 0 },
    },
    market: {
      coinEarned: D(0),
      sellTier: { wood: 0, stone: 0, arrow: 0, spear: 0 },
      rateUnlocks: { wood: false, stone: false, food: false },
      workerContract: 0,
      foodBought: 0,
    },
  };
}

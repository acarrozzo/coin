import { Decimal, D } from './numbers';
import { RESOURCE_IDS, type ResourceId } from '../content/resources';
import { BUILDING_IDS, type BuildingId } from '../content/buildings';

export type { ResourceId, BuildingId };

/** Bumped whenever the save shape changes; drives migrations (see save.ts). */
export const SAVE_VERSION = 1;

/** Workers the player starts with. */
export const STARTING_WORKERS = 3;

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
  /** Settlement level — gates resource/building unlocks. */
  level: number;
  resources: Record<ResourceId, ResourceState>;
  workers: {
    total: number;
    assigned: Record<ResourceId, number>;
  };
  buildings: Record<BuildingId, { level: number }>;
}

/** A fresh game. `now` is injected so tests stay deterministic. */
export function createInitialState(now: number): GameState {
  const resources = {} as Record<ResourceId, ResourceState>;
  const assigned = {} as Record<ResourceId, number>;
  for (const id of RESOURCE_IDS) {
    resources[id] = { amount: D(0) };
    assigned[id] = 0;
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
    level: 1,
    resources,
    workers: { total: STARTING_WORKERS, assigned },
    buildings,
  };
}

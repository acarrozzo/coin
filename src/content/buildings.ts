/**
 * Building content — constructions and their per-level cost/effects, as data.
 * A generic building system (systems/buildings.ts) interprets these entries;
 * adding a building or level is a pure data edit.
 */
import type { ResourceId } from './resources';

export type BuildingId = 'cabin';

export type ResourceCost = Partial<Record<ResourceId, number>>;

export interface BuildingEffect {
  /** Raise the settlement level to this value (unlocks gated content). */
  setLevel?: number;
  /** Multiply all resource capacities (stacks across owned levels). */
  capMult?: number;
}

export interface BuildingLevel {
  cost: ResourceCost;
  effect: BuildingEffect;
  /** What this level does, for the UI. */
  summary: string;
}

export interface BuildingDef {
  name: string;
  blurb: string;
  /** Levels in order; index 0 is the first build. */
  levels: BuildingLevel[];
}

export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  cabin: {
    name: 'Cabin',
    blurb: 'A humble start — and room to grow.',
    levels: [
      {
        cost: { wood: 10 },
        effect: { setLevel: 2 },
        summary: 'Settle in. Unlocks stone quarrying.',
      },
      {
        cost: { wood: 30, stone: 15 },
        effect: { capMult: 1.5 },
        summary: '+50% storage capacity.',
      },
    ],
  },
};

export const BUILDING_IDS = Object.keys(BUILDINGS) as BuildingId[];

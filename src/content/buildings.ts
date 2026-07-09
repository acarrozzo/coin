/**
 * Building content — constructions and their per-level cost/effects, as data.
 * A building's level also caps how many workers can staff each of its
 * production lines (see producers.ts). Buildings become available at a
 * settlement level.
 */
import type { ResourceCost } from './settlement';

export type BuildingId = 'farm' | 'deepmine' | 'blacksmith' | 'hunterscabin' | 'wizardtower' | 'barracks';

export interface BuildingLevel {
  cost: ResourceCost;
  /** What this level unlocks/does, for the UI. */
  summary: string;
}

export interface BuildingDef {
  name: string;
  blurb: string;
  /** Minimum settlement level before this building can be built. */
  availableAtLevel: number;
  /** Levels in order; index 0 is the first build. */
  levels: BuildingLevel[];
}

export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  farm: {
    name: 'Farm',
    blurb: 'Turns labor into food.',
    availableAtLevel: 2,
    levels: [
      { cost: { wood: 10, stone: 10 }, summary: 'Unlocks food gathering (1 farmer).' },
      { cost: { wood: 60, stone: 40 }, summary: '+1 farmer.' },
      { cost: { wood: 200, stone: 150 }, summary: '+1 farmer.' },
    ],
  },
  blacksmith: {
    name: 'Blacksmith',
    blurb: 'Forges wood and metal into arms.',
    availableAtLevel: 3,
    levels: [
      { cost: { wood: 100, stone: 100 }, summary: 'Unlocks arrow crafting.' },
      { cost: { wood: 200, stone: 200, iron: 10 }, summary: 'Unlocks sword crafting.' },
      { cost: { wood: 400, stone: 300, steel: 5 }, summary: 'Unlocks staff crafting.' },
    ],
  },
  hunterscabin: {
    name: "Hunter's Cabin",
    blurb: 'Spears, and what spears bring back.',
    availableAtLevel: 3,
    levels: [
      { cost: { wood: 100, stone: 50 }, summary: 'Unlocks spear crafting.' },
      { cost: { wood: 200, spear: 10 }, summary: 'Unlocks leather.' },
      { cost: { wood: 400, spear: 25 }, summary: 'Unlocks fur.' },
    ],
  },
  deepmine: {
    name: 'Deep Mine',
    blurb: 'Descends for iron, steel, and mithril.',
    availableAtLevel: 3,
    levels: [
      { cost: { wood: 300, stone: 200 }, summary: 'Unlocks iron (smelted from food).' },
      { cost: { wood: 600, stone: 400 }, summary: 'Unlocks steel.' },
      { cost: { wood: 1200, stone: 800, iron: 50 }, summary: 'Unlocks mithril.' },
    ],
  },
  barracks: {
    name: 'Barracks',
    blurb: 'Trains the standing army that defends your walls.',
    availableAtLevel: 5,
    levels: [
      { cost: { wood: 400, stone: 400 }, summary: 'Unlocks archers (arrows + leather).' },
      { cost: { wood: 800, stone: 800, sword: 5 }, summary: 'Unlocks warriors (swords + fur).' },
      { cost: { wood: 1600, stone: 1600, staff: 5 }, summary: 'Unlocks mages (staves + ether).' },
    ],
  },
  wizardtower: {
    name: 'Wizard Tower',
    blurb: 'Draws ether and weaves protective wards.',
    availableAtLevel: 6,
    levels: [
      { cost: { wood: 1000, stone: 500 }, summary: 'Unlocks ether (from wood).' },
      { cost: { wood: 2000, stone: 1000, mithril: 5 }, summary: 'Unlocks wards (from ether).' },
    ],
  },
};

export const BUILDING_IDS = Object.keys(BUILDINGS) as BuildingId[];

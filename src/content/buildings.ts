/**
 * Building content — constructions and their per-level cost/effects, as data.
 * A building's level also caps how many workers can staff each of its
 * production lines (see producers.ts). Buildings become available at a
 * settlement level.
 */
import type { ResourceCost } from './settlement';
import { getTier } from './settlement';

export type BuildingId = 'farm' | 'deepmine' | 'blacksmith' | 'hunterscabin' | 'wizardtower' | 'barracks';

export interface BuildingLevel {
  cost: ResourceCost;
  /** What this level unlocks/does, for the UI. */
  summary: string;
  /** Minimum settlement level required to build this level (gates upper tiers). */
  requiresLevel?: number;
}

// ---------- Farm level generation (matches the original coin-old maxes) ----------
//
// The original scaled the farm to 51 levels — and since the food line uses
// workerCap: 'level' (producers.ts), farm level == max farmers. Higher tiers
// were gated behind settlement level. We reproduce those exact thresholds and
// grow cost geometrically from the three original hand-tuned levels, keeping
// the top level under the Kingdom storage cap (50k).
const FARM_MAX_LEVEL = 51;

/** [highest farm level in band, required settlement level] — from coin-old's lvlAllRefresh. */
const FARM_GATES: Array<[number, number]> = [
  [8, 0], // levels 1–8: only need the Farm's availableAtLevel (settlement 2)
  [12, 5], // Small Village
  [16, 6], // Large Village
  [28, 7], // Town  (original Small Town 21 + Large Town 28, collapsed)
  [35, 8], // City
  [51, 9], // Kingdom
];

function farmRequires(level: number): number {
  for (const [max, req] of FARM_GATES) if (level <= max) return req;
  return 9;
}

/** Round to two significant figures for readable costs. */
function niceCost(x: number): number {
  if (x < 100) return Math.round(x / 5) * 5;
  const mag = Math.pow(10, Math.floor(Math.log10(x)) - 1);
  return Math.round(x / mag) * mag;
}

function buildFarmLevels(): BuildingLevel[] {
  const levels: BuildingLevel[] = [
    { cost: { wood: 10, stone: 10 }, summary: 'Unlocks food gathering (1 farmer).' },
    { cost: { wood: 60, stone: 40 }, summary: '+1 farmer.' },
    { cost: { wood: 200, stone: 150 }, summary: '+1 farmer.' },
  ];
  let prevReq = farmRequires(3);
  for (let level = 4; level <= FARM_MAX_LEVEL; level++) {
    const wood = niceCost(200 * Math.pow(1.11, level - 3));
    const stone = niceCost(wood * 0.7);
    const req = farmRequires(level);
    // Note the settlement gate only on the first level of each new band.
    const gateName = req > prevReq ? getTier(req)?.name : undefined;
    const summary = gateName ? `+1 farmer — requires ${gateName}.` : '+1 farmer.';
    const level_: BuildingLevel = { cost: { wood, stone }, summary };
    if (req > 0) level_.requiresLevel = req;
    levels.push(level_);
    prevReq = req;
  }
  return levels;
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
    levels: buildFarmLevels(),
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

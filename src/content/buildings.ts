/**
 * Building content — constructions and their per-level cost/effects, as data.
 * A building's level also caps how many workers can staff each of its
 * production lines (see producers.ts). Buildings become available at a
 * settlement level, and each further level is gated behind a higher settlement
 * level (`requiresLevel`) — a faithful port of coin-old's lvlAllRefresh gates.
 *
 * Some buildings also set an absolute cap on a stat resource via `sets`:
 * Castle → defenseMax, Wizard Tower → wardMax.
 */
import type { ResourceCost } from './settlement';
import { getTier } from './settlement';

export type BuildingId =
  | 'farm'
  | 'deepmine'
  | 'blacksmith'
  | 'hunterscabin'
  | 'barracks'
  | 'wizardtower'
  | 'castle'
  | 'cloudshaman';

export interface BuildingLevel {
  cost: ResourceCost;
  /** What this level unlocks/does, for the UI. */
  summary: string;
  /** Minimum settlement level required to build this level (gates upper tiers). */
  requiresLevel?: number;
  /** Absolute caps this level sets on stat resources (latest level wins). */
  sets?: { defenseMax?: number; wardMax?: number };
}

// ---------- Farm level generation (matches the original coin-old maxes) ----------
//
// The original scaled the farm to 51 levels — and since the food line uses
// workerCap: 'level' (producers.ts), farm level == max farmers. Higher tiers
// were gated behind settlement level. We reproduce those exact thresholds and
// grow cost geometrically from the three original hand-tuned levels, keeping
// the top level under the Kingdom storage cap (100k).
//
// NOTE: the original's multi-level farm was WIP scaffolding — no cost table and
// no worker cap. We keep the rewrite's completed implementation (that is the
// "fix a clear bug" clause) but restore the original settlement-level gates.
const FARM_MAX_LEVEL = 51;

/** [highest farm level in band, required settlement level] — from coin-old's lvlAllRefresh. */
const FARM_GATES: Array<[number, number]> = [
  [8, 0], // levels 1–8: only need the Farm's availableAtLevel (settlement 3)
  [12, 5], // Small Village
  [16, 6], // Large Village
  [21, 7], // Small Town
  [28, 8], // Large Town
  [35, 9], // City
  [51, 10], // Kingdom
];

function farmRequires(level: number): number {
  for (const [max, req] of FARM_GATES) if (level <= max) return req;
  return 10;
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
    { cost: { wood: 60, stone: 40 }, summary: '' },
    { cost: { wood: 200, stone: 150 }, summary: '+1 farmer.' },
  ];
  let prevReq = farmRequires(3);
  for (let level = 4; level <= FARM_MAX_LEVEL; level++) {
    const wood = niceCost(200 * Math.pow(1.11, level - 3));
    const stone = niceCost(wood * 0.7);
    const req = farmRequires(level);
    // Note the settlement gate only on the first level of each new band.
    const gateName = req > prevReq ? getTier(req)?.name : undefined;
    const summary = gateName ? `+1 farmer — requires ${gateName}.` : 'bigger farm.';
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
    availableAtLevel: 3,
    levels: buildFarmLevels(),
  },
  blacksmith: {
    name: 'Blacksmith',
    blurb: 'Forges wood and metal into arms.',
    availableAtLevel: 4,
    levels: [
      { cost: { wood: 100, stone: 100 }, summary: 'Unlocks arrow crafting.' },
      { cost: { wood: 200, stone: 200 }, summary: 'More smiths (+1 worker per line).', requiresLevel: 5 },
      { cost: { stone: 400, iron: 1 }, summary: 'Unlocks sword crafting.', requiresLevel: 6 },
      { cost: { stone: 800, steel: 1 }, summary: 'Unlocks staff crafting.', requiresLevel: 7 },
      { cost: { stone: 1600, mithril: 1 }, summary: 'Unlocks gladius crafting.', requiresLevel: 8 },
      { cost: { stone: 3200, adamantium: 1 }, summary: 'Unlocks claymore crafting.', requiresLevel: 9 },
    ],
  },
  hunterscabin: {
    name: "Hunter's Cabin",
    blurb: 'Spears, and what spears bring back.',
    availableAtLevel: 4,
    levels: [
      { cost: { wood: 100, arrow: 10 }, summary: 'Unlocks spear crafting.' },
      { cost: { wood: 200, spear: 10 }, summary: 'Unlocks leather.', requiresLevel: 5 },
      { cost: { wood: 400, spear: 100 }, summary: 'Unlocks fur.', requiresLevel: 6 },
      { cost: { wood: 800, sword: 10 }, summary: 'Unlocks troll skulls.', requiresLevel: 7 },
      { cost: { wood: 800, ether: 10 }, summary: 'Unlocks dragon bones.', requiresLevel: 8 },
      { cost: { wood: 3200, soulgem: 10 }, summary: 'More hunters (+1 worker per line).', requiresLevel: 9 },
    ],
  },
  deepmine: {
    name: 'Deep Mine',
    blurb: 'Descends for iron, steel, mithril, and adamantium.',
    availableAtLevel: 6,
    levels: [
      { cost: { wood: 600 }, summary: 'Unlocks iron (smelted from food).' },
      { cost: { wood: 900 }, summary: 'Unlocks steel.', requiresLevel: 6 },
      { cost: { wood: 1800 }, summary: 'Unlocks mithril.', requiresLevel: 7 },
      { cost: { wood: 3600 }, summary: 'Unlocks adamantium.', requiresLevel: 8 },
    ],
  },
  barracks: {
    name: 'Barracks',
    blurb: 'Trains the standing army that mans your walls.',
    availableAtLevel: 5,
    levels: [
      { cost: { stone: 300, leather: 10 }, summary: 'Unlocks archers (arrows + leather).' },
      { cost: { stone: 600, sword: 1 }, summary: 'Unlocks warriors (swords + fur).', requiresLevel: 6 },
      { cost: { stone: 1200, staff: 1 }, summary: 'Unlocks mages (staves + magic orbs).', requiresLevel: 7 },
      { cost: { stone: 2400, gladius: 1 }, summary: 'Unlocks centurions.', requiresLevel: 8 },
      { cost: { stone: 4800, claymore: 1 }, summary: 'Unlocks war generals.', requiresLevel: 9 },
    ],
  },
  wizardtower: {
    name: 'Wizard Tower',
    blurb: 'Weaves protective wards and draws ether.',
    availableAtLevel: 7,
    levels: [
      { cost: { wood: 1000, mage: 1 }, summary: 'Unlocks wards. Ward cap 5.', sets: { wardMax: 5 } },
      { cost: { wood: 1000, magicorb: 10 }, summary: 'Unlocks ether. Ward cap 10.', requiresLevel: 7, sets: { wardMax: 10 } },
    ],
  },
  castle: {
    name: 'Castle',
    blurb: 'Walls and a defensive garrison. Sets your defense cap.',
    availableAtLevel: 5,
    levels: [
      { cost: { wood: 400, archer: 5 }, summary: 'Watchtower — unlocks defense. Defense cap 5.', sets: { defenseMax: 5 } },
      { cost: { stone: 800, warrior: 5 }, summary: 'Outpost — unlocks magic orbs. Defense cap 20.', requiresLevel: 6, sets: { defenseMax: 20 } },
      { cost: { stone: 1600, mage: 1 }, summary: 'Stronghold — unlocks soul gems. Defense cap 30.', requiresLevel: 7, sets: { defenseMax: 30 } },
      { cost: { stone: 3200, centurion: 1 }, summary: 'Fortress — unlocks star metal. Defense cap 50.', requiresLevel: 8, sets: { defenseMax: 50 } },
      { cost: { stone: 6400, wargeneral: 1 }, summary: 'Castle — unlocks holy water. Defense cap 75.', requiresLevel: 9, sets: { defenseMax: 75 } },
    ],
  },
  cloudshaman: {
    name: 'Cloud Shaman',
    blurb: 'Weaves dream leaf from star metal and ether.',
    availableAtLevel: 9,
    levels: [{ cost: { ether: 100, starmetal: 1 }, summary: 'Unlocks dream leaf.' }],
  },
};

export const BUILDING_IDS = Object.keys(BUILDINGS) as BuildingId[];

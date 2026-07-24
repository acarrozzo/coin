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

// ---------- Farm level costs (hand-tuned; naturally capped by settlement storage) ----------
//
// The food line uses workerCap: 'level' (producers.ts), so farm level == max
// farmers. There is deliberately NO settlement-level gate: each level's wood ==
// stone cost is tuned so the highest level affordable within a settlement
// tier's storage cap lands exactly on that tier's intended farmer count.
// Reaching the next band simply requires the larger storage a higher tier
// grants. The costs stop at L50 (90k), reachable inside the Kingdom cap (100k).
//
//   Sett 3  (cap 50)   → L4     Sett 7  (cap 2k)   → L21
//   Sett 4  (cap 250)  → L8     Sett 8  (cap 4k)   → L28
//   Sett 5  (cap 500)  → L12    Sett 9  (cap 10k)  → L35
//   Sett 6  (cap 1k)   → L16    Sett 10 (cap 100k) → L50
const FARM_COSTS = [
  10, 20, 30, 40, 60, 100, 140, 220, 300, 360, 420, 480, 600, 720, 840, 960,
  1200, 1300, 1500, 1700, 1900, 2200, 2400, 2600, 2800, 3000, 3400, 3800, 4200,
  4800, 5400, 6000, 7000, 8000, 9000, 11000, 13000, 15000, 17000, 20000, 23000,
  26000, 30000, 35000, 40000, 50000, 60000, 70000, 80000, 90000,
];

function buildFarmLevels(): BuildingLevel[] {
  return FARM_COSTS.map((n, i) => ({
    cost: { wood: n, stone: n },
    summary: i === 0 ? 'Unlocks food gathering (1 farmer).' : '+1 farmer.',
  }));
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
    blurb: 'Descends for iron, steel, mithril, adamantium, and obsidion.',
    availableAtLevel: 6,
    levels: [
      { cost: { wood: 600 }, summary: 'Unlocks iron (smelted from food).' },
      { cost: { wood: 900 }, summary: 'Unlocks steel.', requiresLevel: 6 },
      { cost: { wood: 1800 }, summary: 'Unlocks mithril.', requiresLevel: 7 },
      { cost: { wood: 3600 }, summary: 'Unlocks adamantium.', requiresLevel: 8 },
      { cost: { wood: 72000 }, summary: 'Unlocks obsidion.', requiresLevel: 10 },
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

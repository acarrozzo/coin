/**
 * Producers — every production line, as data. This unifies gathering and
 * crafting: a producer turns optional inputs into one output resource, staffed
 * by workers, gated by a structure's level. Gathering is just a producer with
 * no inputs.
 *
 * Rates below are per worker. `outputPerCycle / cycleSeconds` = output/sec/worker.
 * Ported verbatim from coin-old: metals are food-fed and fractional; the
 * defense/ward stats and the quest items are single-slot "converters" that
 * consume units. honor/wisdom are not produced (they come from combat).
 */
import type { ResourceId, ResourceCategory } from './resources';
import type { BuildingId } from './buildings';

/** Which structure gates a producer's worker count and availability. */
export type StructureId = 'settlement' | BuildingId;

/**
 * Worker cap model:
 * - 'pool': limited only by the global worker pool
 * - 'level': limited by the gating structure's level
 * - number: a fixed maximum (single-slot converters use 1)
 */
export type WorkerCap = 'pool' | 'level' | number;

export interface ProducerDef {
  output: ResourceId;
  category: ResourceCategory;
  /** Structure whose level gates this line. */
  structure: StructureId;
  /** Structure level at which this line unlocks. */
  minLevel: number;
  workerCap: WorkerCap;
  /** Output produced per cycle per worker. */
  outputPerCycle: number;
  /** Seconds per production cycle. */
  cycleSeconds: number;
  /** Inputs consumed per cycle per worker (empty for gathering). */
  inputs?: Partial<Record<ResourceId, number>>;
}

// Ordered upstream → downstream so a chain settles within a single small tick.
export const PRODUCERS: Partial<Record<ResourceId, ProducerDef>> = {
  // Base gathering
  wood: { output: 'wood', category: 'base', structure: 'settlement', minLevel: 1, workerCap: 'pool', outputPerCycle: 1, cycleSeconds: 1 },
  stone: { output: 'stone', category: 'base', structure: 'settlement', minLevel: 1, workerCap: 'pool', outputPerCycle: 1, cycleSeconds: 2 },
  food: { output: 'food', category: 'base', structure: 'farm', minLevel: 1, workerCap: 'level', outputPerCycle: 1, cycleSeconds: 3 },

  // Deep Mine — metals smelted directly from food, fractional yields (coin-old)
  iron: { output: 'iron', category: 'metal', structure: 'deepmine', minLevel: 1, workerCap: 'level', outputPerCycle: 0.1, cycleSeconds: 1, inputs: { food: 1 } },
  steel: { output: 'steel', category: 'metal', structure: 'deepmine', minLevel: 2, workerCap: 'level', outputPerCycle: 0.01, cycleSeconds: 2, inputs: { food: 2 } },
  mithril: { output: 'mithril', category: 'metal', structure: 'deepmine', minLevel: 3, workerCap: 'level', outputPerCycle: 0.001, cycleSeconds: 3, inputs: { food: 3 } },
  adamantium: { output: 'adamantium', category: 'metal', structure: 'deepmine', minLevel: 4, workerCap: 'level', outputPerCycle: 0.0001, cycleSeconds: 4, inputs: { food: 4 } },
  obsidion: { output: 'obsidion', category: 'metal', structure: 'deepmine', minLevel: 5, workerCap: 'level', outputPerCycle: 0.00001, cycleSeconds: 5, inputs: { food: 5 } },

  // Blacksmith — weapons (arrow @1, sword @3, staff @4, gladius @5, claymore @6)
  arrow: { output: 'arrow', category: 'weapon', structure: 'blacksmith', minLevel: 1, workerCap: 'level', outputPerCycle: 1, cycleSeconds: 0.5, inputs: { wood: 2, stone: 1 } },
  sword: { output: 'sword', category: 'weapon', structure: 'blacksmith', minLevel: 3, workerCap: 'level', outputPerCycle: 1, cycleSeconds: 10, inputs: { wood: 10, iron: 2 } },
  staff: { output: 'staff', category: 'weapon', structure: 'blacksmith', minLevel: 4, workerCap: 'level', outputPerCycle: 1, cycleSeconds: 10, inputs: { wood: 50, steel: 1 } },
  gladius: { output: 'gladius', category: 'weapon', structure: 'blacksmith', minLevel: 5, workerCap: 'level', outputPerCycle: 1, cycleSeconds: 30, inputs: { dragonbone: 5, mithril: 1 } },
  claymore: { output: 'claymore', category: 'weapon', structure: 'blacksmith', minLevel: 6, workerCap: 'level', outputPerCycle: 1, cycleSeconds: 45, inputs: { starmetal: 5, adamantium: 1 } },

  // Hunter's Cabin — spears, goods, hunt trophies
  spear: { output: 'spear', category: 'weapon', structure: 'hunterscabin', minLevel: 1, workerCap: 'level', outputPerCycle: 1, cycleSeconds: 2, inputs: { wood: 8, stone: 4 } },
  leather: { output: 'leather', category: 'good', structure: 'hunterscabin', minLevel: 2, workerCap: 'level', outputPerCycle: 1, cycleSeconds: 5, inputs: { spear: 1 } },
  fur: { output: 'fur', category: 'good', structure: 'hunterscabin', minLevel: 3, workerCap: 'level', outputPerCycle: 1, cycleSeconds: 5, inputs: { spear: 1 } },
  trollskull: { output: 'trollskull', category: 'good', structure: 'hunterscabin', minLevel: 4, workerCap: 'level', outputPerCycle: 1, cycleSeconds: 30, inputs: { sword: 1, spear: 10 } },
  dragonbone: { output: 'dragonbone', category: 'good', structure: 'hunterscabin', minLevel: 5, workerCap: 'level', outputPerCycle: 1, cycleSeconds: 30, inputs: { staff: 1, ether: 10 } },

  // Wizard Tower — ward stat (@1) and ether (@2)
  ward: { output: 'ward', category: 'magic', structure: 'wizardtower', minLevel: 1, workerCap: 1, outputPerCycle: 1, cycleSeconds: 5, inputs: { mage: 1, trollskull: 10 } },
  ether: { output: 'ether', category: 'magic', structure: 'wizardtower', minLevel: 2, workerCap: 'level', outputPerCycle: 1, cycleSeconds: 1, inputs: { wood: 100 } },

  // Barracks — the standing army
  archer: { output: 'archer', category: 'unit', structure: 'barracks', minLevel: 1, workerCap: 'level', outputPerCycle: 1, cycleSeconds: 10, inputs: { arrow: 50, leather: 5 } },
  warrior: { output: 'warrior', category: 'unit', structure: 'barracks', minLevel: 2, workerCap: 'level', outputPerCycle: 1, cycleSeconds: 10, inputs: { sword: 1, fur: 4 } },
  mage: { output: 'mage', category: 'unit', structure: 'barracks', minLevel: 3, workerCap: 'level', outputPerCycle: 1, cycleSeconds: 20, inputs: { staff: 1, magicorb: 5 } },
  centurion: { output: 'centurion', category: 'unit', structure: 'barracks', minLevel: 4, workerCap: 'level', outputPerCycle: 1, cycleSeconds: 30, inputs: { gladius: 1, soulgem: 5 } },
  wargeneral: { output: 'wargeneral', category: 'unit', structure: 'barracks', minLevel: 5, workerCap: 'level', outputPerCycle: 1, cycleSeconds: 45, inputs: { claymore: 1, trollskull: 300 } },

  // Castle-gated converters & quests
  defense: { output: 'defense', category: 'stat', structure: 'castle', minLevel: 1, workerCap: 1, outputPerCycle: 1, cycleSeconds: 1, inputs: { archer: 1 } },
  magicorb: { output: 'magicorb', category: 'quest', structure: 'castle', minLevel: 2, workerCap: 'level', outputPerCycle: 1, cycleSeconds: 15, inputs: { archer: 2, warrior: 3 } },
  soulgem: { output: 'soulgem', category: 'quest', structure: 'castle', minLevel: 3, workerCap: 1, outputPerCycle: 1, cycleSeconds: 30, inputs: { mage: 1, warrior: 2 } },
  starmetal: { output: 'starmetal', category: 'quest', structure: 'castle', minLevel: 4, workerCap: 1, outputPerCycle: 1, cycleSeconds: 45, inputs: { centurion: 1, mage: 5 } },
  holywater: { output: 'holywater', category: 'quest', structure: 'castle', minLevel: 5, workerCap: 1, outputPerCycle: 1, cycleSeconds: 60, inputs: { wargeneral: 1, centurion: 5 } },

  // Cloud Shaman — dream leaf
  dreamleaf: { output: 'dreamleaf', category: 'quest', structure: 'cloudshaman', minLevel: 1, workerCap: 'level', outputPerCycle: 1, cycleSeconds: 30, inputs: { starmetal: 1, ether: 10 } },
};

/** Ids of producible resources (honor/wisdom excluded — they come from combat). */
export const PRODUCER_IDS = Object.keys(PRODUCERS) as ResourceId[];

/**
 * Resources allowed to hold decimal amounts — the "handful". Derived, not a
 * hand-kept list: a resource is fractional iff its producer emits less than one
 * whole unit per cycle (the metals iron→adamantium at 0.1…0.0001). Every other
 * line emits whole units per cycle, so with atomic cycles
 * its amount never leaves the integers. Used by the save migration to know which
 * resources to floor.
 */
export const FRACTIONAL_RESOURCE_IDS = new Set<ResourceId>(
  PRODUCER_IDS.filter((id) => (PRODUCERS[id]?.outputPerCycle ?? 1) < 1),
);

export const isFractionalResource = (id: ResourceId): boolean =>
  FRACTIONAL_RESOURCE_IDS.has(id);

/**
 * How many decimal places a fractional resource is gathered in — its display
 * precision. Derived from the producer's per-cycle step (iron 0.1 → 1, steel
 * 0.01 → 2, mithril 0.001 → 3, adamantium 0.0001 → 4).
 * Whole-unit producers (and non-producers, e.g. coin) return 0.
 */
export function resourceDecimals(id: ResourceId): number {
  const step = PRODUCERS[id]?.outputPerCycle ?? 1;
  if (step >= 1) return 0;
  return Math.round(-Math.log10(step));
}

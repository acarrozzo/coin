/**
 * Producers — every production line, as data. This unifies gathering and
 * crafting: a producer turns optional inputs into one output resource, staffed
 * by workers, gated by a structure's level. Gathering is just a producer with
 * no inputs.
 *
 * Rates below are per worker. `outputPerCycle / cycleSeconds` = output/sec/worker.
 * Numbers adapted from the original's auto-loop yields and tick durations.
 */
import type { ResourceId, ResourceCategory } from './resources';
import type { BuildingId } from './buildings';

/** Which structure gates a producer's worker count and availability. */
export type StructureId = 'settlement' | BuildingId;

export interface ProducerDef {
  /** Output resource (also the producer's key). */
  output: ResourceId;
  category: ResourceCategory;
  /** Structure whose level gates this line. */
  structure: StructureId;
  /** Structure level at which this line unlocks. */
  minLevel: number;
  /**
   * Worker cap model:
   * - 'pool': limited only by the global worker pool
   * - 'level': limited by the gating structure's level
   */
  workerCap: 'pool' | 'level';
  /** Output produced per cycle per worker. */
  outputPerCycle: number;
  /** Seconds per production cycle. */
  cycleSeconds: number;
  /** Inputs consumed per cycle per worker (empty for gathering). */
  inputs?: Partial<Record<ResourceId, number>>;
}

export const PRODUCERS: Record<ResourceId, ProducerDef> = {
  // Base gathering (settlement-gated, pool-limited)
  wood: { output: 'wood', category: 'base', structure: 'settlement', minLevel: 1, workerCap: 'pool', outputPerCycle: 1, cycleSeconds: 1 },
  stone: { output: 'stone', category: 'base', structure: 'settlement', minLevel: 1, workerCap: 'pool', outputPerCycle: 1, cycleSeconds: 2 },
  food: { output: 'food', category: 'base', structure: 'farm', minLevel: 1, workerCap: 'level', outputPerCycle: 1, cycleSeconds: 2 },

  // Deep mine — a smelting chain (food → iron → steel → mithril)
  iron: { output: 'iron', category: 'metal', structure: 'deepmine', minLevel: 1, workerCap: 'level', outputPerCycle: 1, cycleSeconds: 2, inputs: { food: 2 } },
  steel: { output: 'steel', category: 'metal', structure: 'deepmine', minLevel: 2, workerCap: 'level', outputPerCycle: 1, cycleSeconds: 4, inputs: { iron: 2 } },
  mithril: { output: 'mithril', category: 'metal', structure: 'deepmine', minLevel: 3, workerCap: 'level', outputPerCycle: 1, cycleSeconds: 8, inputs: { steel: 2 } },

  // Blacksmith — weapons
  arrow: { output: 'arrow', category: 'weapon', structure: 'blacksmith', minLevel: 1, workerCap: 'level', outputPerCycle: 1, cycleSeconds: 1, inputs: { wood: 2, stone: 1 } },
  sword: { output: 'sword', category: 'weapon', structure: 'blacksmith', minLevel: 2, workerCap: 'level', outputPerCycle: 1, cycleSeconds: 5, inputs: { wood: 10, iron: 2 } },
  staff: { output: 'staff', category: 'weapon', structure: 'blacksmith', minLevel: 3, workerCap: 'level', outputPerCycle: 1, cycleSeconds: 8, inputs: { wood: 20, steel: 1 } },

  // Hunter's Cabin — spears and goods
  spear: { output: 'spear', category: 'weapon', structure: 'hunterscabin', minLevel: 1, workerCap: 'level', outputPerCycle: 1, cycleSeconds: 2, inputs: { wood: 8, stone: 4 } },
  leather: { output: 'leather', category: 'good', structure: 'hunterscabin', minLevel: 2, workerCap: 'level', outputPerCycle: 1, cycleSeconds: 5, inputs: { spear: 1 } },
  fur: { output: 'fur', category: 'good', structure: 'hunterscabin', minLevel: 3, workerCap: 'level', outputPerCycle: 1, cycleSeconds: 5, inputs: { spear: 1 } },
};

/** Every resource has exactly one producer (enforced by the Record type above). */
export const PRODUCER_IDS = Object.keys(PRODUCERS) as ResourceId[];

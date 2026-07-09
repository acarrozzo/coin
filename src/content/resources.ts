/**
 * Resource content — the game's gatherable materials as data.
 * Adding a resource is a data edit here plus its id in the union below.
 */

export type ResourceId = 'wood' | 'stone';

export interface ResourceDef {
  /** Display name. */
  name: string;
  /** Base storage capacity before building multipliers. */
  baseCap: number;
  /** Units produced per assigned worker per second. */
  perWorker: number;
  /** Settlement level at which this resource becomes available. */
  unlockedAtLevel: number;
  /** Short flavor line for the UI. */
  blurb: string;
}

export const RESOURCES: Record<ResourceId, ResourceDef> = {
  wood: {
    name: 'Wood',
    baseCap: 50,
    perWorker: 1,
    unlockedAtLevel: 1,
    blurb: 'Chopped from the treeline.',
  },
  stone: {
    name: 'Stone',
    baseCap: 50,
    perWorker: 1,
    unlockedAtLevel: 2,
    blurb: 'Quarried from the hills.',
  },
};

export const RESOURCE_IDS = Object.keys(RESOURCES) as ResourceId[];

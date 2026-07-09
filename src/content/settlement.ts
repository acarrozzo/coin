/**
 * Settlement tiers — the spine of progression, as data.
 * Each tier is a level the player upgrades into; it costs resources (and
 * sometimes a minimum worker count) and sets absolute storage caps.
 *
 * Ported/adapted from the original's upgradeLvlN chain. Combat-gated upper
 * tiers (which require defense/honor/wisdom) arrive with Phase 4.
 */
import type { ResourceId } from './resources';

export type ResourceCost = Partial<Record<ResourceId, number>>;

export interface SettlementTier {
  /** The settlement level this tier represents. */
  level: number;
  name: string;
  /** Cost to upgrade *into* this tier (empty for the starting tier). */
  cost: ResourceCost;
  /** Minimum trained workers required to upgrade in. */
  workersRequired?: number;
  /** Absolute storage caps applied while at this tier. */
  caps: Partial<Record<ResourceId, number>>;
  blurb: string;
}

export const SETTLEMENT_TIERS: SettlementTier[] = [
  {
    level: 1,
    name: 'Small Shack',
    cost: {},
    caps: { wood: 25, stone: 25, food: 25 },
    blurb: 'Four walls and a hope.',
  },
  {
    level: 2,
    name: 'Large Shack',
    cost: { wood: 20, stone: 20 },
    caps: { wood: 50, stone: 50, food: 50 },
    blurb: 'Room to store more than scraps.',
  },
  {
    level: 3,
    name: 'Small Cabin',
    cost: { wood: 60, stone: 60 },
    workersRequired: 4,
    caps: { wood: 250, stone: 250, food: 250 },
    blurb: 'A proper home — and a proper workforce.',
  },
  {
    level: 4,
    name: 'Large Cabin',
    cost: { wood: 200, stone: 200, food: 100 },
    workersRequired: 6,
    caps: { wood: 500, stone: 500, food: 500 },
    blurb: 'The beginnings of a holding.',
  },
  {
    level: 5,
    name: 'Small Village',
    cost: { wood: 600, stone: 600, food: 300, steel: 20 },
    workersRequired: 10,
    caps: { wood: 1000, stone: 1000, food: 1000 },
    blurb: 'Smoke from many chimneys. Time to raise a Barracks.',
  },
  {
    level: 6,
    name: 'Large Village',
    cost: { wood: 1500, stone: 1500, food: 800, mithril: 5 },
    workersRequired: 14,
    caps: { wood: 3000, stone: 3000, food: 3000 },
    blurb: 'Prosperous — and now a target. Raiders will come.',
  },
  {
    level: 7,
    name: 'Town',
    cost: { wood: 3000, stone: 3000, honor: 5 },
    workersRequired: 18,
    caps: { wood: 6000, stone: 6000, food: 6000 },
    blurb: 'Walls, gates, and a name worth defending.',
  },
  {
    level: 8,
    name: 'City',
    cost: { wood: 6000, stone: 6000, honor: 15 },
    workersRequired: 24,
    caps: { wood: 12000, stone: 12000, food: 12000 },
    blurb: 'A seat of power — and of envy. Dark hexes gather.',
  },
  {
    level: 9,
    name: 'Kingdom',
    cost: { wood: 12000, stone: 12000, honor: 30, wisdom: 5 },
    workersRequired: 30,
    caps: { wood: 50000, stone: 50000, food: 50000 },
    blurb: 'Long may it reign.',
  },
];

export const MAX_SETTLEMENT_LEVEL = SETTLEMENT_TIERS[SETTLEMENT_TIERS.length - 1].level;

export function getTier(level: number): SettlementTier | undefined {
  return SETTLEMENT_TIERS.find((t) => t.level === level);
}

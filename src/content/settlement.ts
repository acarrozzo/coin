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
    workersRequired: 2,
    caps: { wood: 50, stone: 50, food: 50 },
    blurb: 'Room to store more than scraps.',
  },
  {
    level: 3,
    name: 'Small Cabin',
    cost: { wood: 30, stone: 30, food: 15 },
    workersRequired: 3,
    caps: { wood: 250, stone: 250, food: 250 },
    blurb: 'A proper home — and a proper workforce.',
  },
  {
    level: 4,
    name: 'Large Cabin',
    cost: { wood: 200, stone: 200, food: 100 },
    workersRequired: 8,
    caps: { wood: 500, stone: 500, food: 500 },
    blurb: 'The beginnings of a holding.',
  },
  {
    level: 5,
    name: 'Small Village',
    cost: { wood: 400, stone: 400, food: 200 },
    workersRequired: 10,
    caps: { wood: 1000, stone: 1000, food: 1000 },
    blurb: 'Smoke from many chimneys. Time to raise a Barracks.',
  },
  {
    level: 6,
    name: 'Large Village',
    cost: { wood: 800, stone: 800, food: 400 },
    workersRequired: 14,
    caps: { wood: 3000, stone: 3000, food: 3000 },
    blurb: 'Prosperous — and now a target. Raiders will come.',
  },
  {
    level: 7,
    name: 'Town',
    cost: { wood: 1600, stone: 1600, food: 800, mithril: 5, honor: 5 },
    workersRequired: 18,
    caps: { wood: 6000, stone: 6000, food: 6000 },
    blurb: 'Walls, gates, and a name worth defending.',
  },
  {
    level: 8,
    name: 'City',
    cost: { wood: 3200, stone: 3200, food: 3200, honor: 15 },
    workersRequired: 24,
    caps: { wood: 12000, stone: 12000, food: 12000 },
    blurb: 'A seat of power — and of envy. Dark hexes gather.',
  },
  {
    level: 9,
    name: 'Kingdom',
    cost: { wood: 9000, stone: 9000, food: 9000, honor: 30, wisdom: 5 },
    workersRequired: 30,
    caps: { wood: 50000, stone: 50000, food: 50000 },
    blurb: 'Long may it reign.',
  },
];

export const MAX_SETTLEMENT_LEVEL = SETTLEMENT_TIERS[SETTLEMENT_TIERS.length - 1].level;

export function getTier(level: number): SettlementTier | undefined {
  return SETTLEMENT_TIERS.find((t) => t.level === level);
}

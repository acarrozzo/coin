/**
 * Settlement tiers — the spine of progression, as data.
 * Each tier is a level the player upgrades into; it costs resources (and
 * sometimes a minimum worker count or a stat threshold) and sets absolute
 * storage caps.
 *
 * Faithful port of coin-old's upgradeLvl1…10 chain (10 tiers). Two kinds of
 * gate, matching the original:
 *   - `cost`: resources actually deducted (wood/stone/food + consumable quest
 *     items like mithril/magic orb/soul gem/star metal/holy water).
 *   - `requires`: standing thresholds that are checked but NOT consumed
 *     (defense at L6/L7, honor/ward at L8, wisdom at L9).
 */
import type { ResourceId } from './resources';

export type ResourceCost = Partial<Record<ResourceId, number>>;

export interface SettlementTier {
  /** The settlement level this tier represents. */
  level: number;
  name: string;
  /** Cost to upgrade *into* this tier — deducted (empty for the starting tier). */
  cost: ResourceCost;
  /** Standing thresholds required but not consumed (e.g. defense ≥ 5). */
  requires?: ResourceCost;
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
    caps: { wood: 3, stone: 3, food: 3 },
    blurb: 'Four walls and a hope. Chop and forage by hand to get going.',
  },
  {
    level: 2,
    name: 'Large Shack',
    cost: { wood: 3, stone: 3 },
    caps: { wood: 25, stone: 25, food: 25 },
    blurb: 'Room to store more than scraps — and to put workers to task.',
  },
  {
    level: 3,
    name: 'Small Cabin',
    cost: { wood: 20, stone: 20 },
    workersRequired: 2,
    caps: { wood: 50, stone: 50, food: 50 },
    blurb: 'A proper home — raise a Farm to feed the work.',
  },
  {
    level: 4,
    name: 'Large Cabin',
    cost: { wood: 30, stone: 30, food: 15 },
    workersRequired: 3,
    caps: { wood: 250, stone: 250, food: 250 },
    blurb: 'The beginnings of a holding. A Blacksmith and Hunter’s Cabin follow.',
  },
  {
    level: 5,
    name: 'Small Village',
    cost: { wood: 200, stone: 200, food: 100 },
    workersRequired: 8,
    caps: { wood: 500, stone: 500, food: 500 },
    blurb: 'Smoke from many chimneys. Raise a Barracks and a Castle.',
  },
  {
    level: 6,
    name: 'Large Village',
    cost: { wood: 400, stone: 400, food: 200 },
    requires: { defense: 5 },
    caps: { wood: 1000, stone: 1000, food: 1000 },
    blurb: 'Prosperous — and now a target. Dig a Deep Mine.',
  },
  {
    level: 7,
    name: 'Small Town',
    cost: { wood: 800, stone: 800, food: 400, magicorb: 1 },
    requires: { defense: 10 },
    caps: { wood: 2000, stone: 2000, food: 2000 },
    blurb: 'Walls worth defending. Raiders assault the gates now.',
  },
  {
    level: 8,
    name: 'Large Town',
    cost: { wood: 1600, stone: 1600, food: 800, mithril: 1, soulgem: 1 },
    requires: { honor: 1, ward: 1 },
    caps: { wood: 4000, stone: 4000, food: 4000 },
    blurb: 'A seat of power — and of envy. Dark hexes gather.',
  },
  {
    level: 9,
    name: 'City',
    cost: { wood: 3200, stone: 3200, food: 3200, starmetal: 1 },
    requires: { wisdom: 1 },
    caps: { wood: 10000, stone: 10000, food: 10000 },
    blurb: 'A city of renown. Court a Cloud Shaman.',
  },
  {
    level: 10,
    name: 'Kingdom',
    cost: { wood: 9000, stone: 9000, food: 9000, holywater: 1 },
    caps: { wood: 100000, stone: 100000, food: 100000 },
    blurb: 'Long may it reign.',
  },
];

export const MAX_SETTLEMENT_LEVEL = SETTLEMENT_TIERS[SETTLEMENT_TIERS.length - 1].level;

export function getTier(level: number): SettlementTier | undefined {
  return SETTLEMENT_TIERS.find((t) => t.level === level);
}

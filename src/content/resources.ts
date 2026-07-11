/**
 * Resource content — every material in the economy, as data.
 * Adding a resource is a data edit here (plus its id in the union) and, if it's
 * producible, a matching producer in producers.ts.
 *
 * This roster is a faithful port of the original coin-old game: the full metal
 * chain (iron→adamantium), the weapon tiers (arrow→claymore), the unit ladder
 * (archer→war general), the quest-item web (orb/gem/starmetal/holy water/dream
 * leaf), coin, and the defense/ward stats.
 */

export type ResourceId =
  // base
  | 'wood'
  | 'stone'
  | 'food'
  // metals (food-fed, fractional)
  | 'iron'
  | 'steel'
  | 'mithril'
  | 'adamantium'
  // weapons
  | 'arrow'
  | 'spear'
  | 'sword'
  | 'staff'
  | 'gladius'
  | 'claymore'
  // goods
  | 'leather'
  | 'fur'
  | 'trollskull'
  | 'dragonbone'
  // magic
  | 'ether'
  | 'ward'
  // units
  | 'archer'
  | 'warrior'
  | 'mage'
  | 'centurion'
  | 'wargeneral'
  // quest items
  | 'magicorb'
  | 'soulgem'
  | 'starmetal'
  | 'holywater'
  | 'dreamleaf'
  // currency
  | 'coin'
  // stats
  | 'defense'
  | 'honor'
  | 'wisdom';

export type ResourceCategory =
  | 'base'
  | 'metal'
  | 'weapon'
  | 'good'
  | 'magic'
  | 'unit'
  | 'quest'
  | 'currency'
  | 'stat';

export interface ResourceDef {
  name: string;
  category: ResourceCategory;
  blurb: string;
}

export const RESOURCES: Record<ResourceId, ResourceDef> = {
  wood: { name: 'Wood', category: 'base', blurb: 'Chopped from the treeline.' },
  stone: { name: 'Stone', category: 'base', blurb: 'Quarried from the hills.' },
  food: { name: 'Food', category: 'base', blurb: 'Feeds and trains your workers.' },

  iron: { name: 'Iron', category: 'metal', blurb: 'Smelted slowly from food and grit.' },
  steel: { name: 'Steel', category: 'metal', blurb: 'Iron, folded and hardened.' },
  mithril: { name: 'Mithril', category: 'metal', blurb: 'Light, strong, and rare.' },
  adamantium: { name: 'Adamantium', category: 'metal', blurb: 'The hardest metal known.' },

  arrow: { name: 'Arrow', category: 'weapon', blurb: 'Fletched by the dozen.' },
  spear: { name: 'Spear', category: 'weapon', blurb: 'Simple, reliable, deadly.' },
  sword: { name: 'Sword', category: 'weapon', blurb: 'A soldier’s blade.' },
  staff: { name: 'Staff', category: 'weapon', blurb: 'Channels the arcane.' },
  gladius: { name: 'Gladius', category: 'weapon', blurb: 'A legionnaire’s short sword.' },
  claymore: { name: 'Claymore', category: 'weapon', blurb: 'A greatsword for a champion.' },

  leather: { name: 'Leather', category: 'good', blurb: 'Cured hide for armor.' },
  fur: { name: 'Fur', category: 'good', blurb: 'Warmth against the cold.' },
  trollskull: { name: 'Troll Skull', category: 'good', blurb: 'A grisly hunting trophy.' },
  dragonbone: { name: 'Dragon Bone', category: 'good', blurb: 'Bone harder than steel.' },

  ether: { name: 'Ether', category: 'magic', blurb: 'Raw arcane essence.' },
  ward: { name: 'Ward', category: 'magic', blurb: 'Turns aside dark magic.' },

  archer: { name: 'Archer', category: 'unit', blurb: 'Rains arrows from the walls.' },
  warrior: { name: 'Warrior', category: 'unit', blurb: 'Holds the line.' },
  mage: { name: 'Mage', category: 'unit', blurb: 'Unleashes devastation.' },
  centurion: { name: 'Centurion', category: 'unit', blurb: 'Commands the legion.' },
  wargeneral: { name: 'War General', category: 'unit', blurb: 'Leads the whole host.' },

  magicorb: { name: 'Magic Orb', category: 'quest', blurb: 'Won by sending soldiers questing.' },
  soulgem: { name: 'Soul Gem', category: 'quest', blurb: 'A gem humming with captured souls.' },
  starmetal: { name: 'Star Metal', category: 'quest', blurb: 'Fallen from the heavens.' },
  holywater: { name: 'Holy Water', category: 'quest', blurb: 'Blessed by the highest order.' },
  dreamleaf: { name: 'Dream Leaf', category: 'quest', blurb: 'Woven from cloud and dream.' },

  coin: { name: 'Coin', category: 'currency', blurb: 'Minted slowly at the Bank.' },

  defense: { name: 'Defense', category: 'stat', blurb: 'Archers manning the walls. Repels assaults.' },
  honor: { name: 'Honor', category: 'stat', blurb: 'Won by repelling assaults.' },
  wisdom: { name: 'Wisdom', category: 'stat', blurb: 'Won by breaking hexes.' },
};

export const RESOURCE_IDS = Object.keys(RESOURCES) as ResourceId[];

/**
 * Resource content — every material in the economy, as data.
 * Adding a resource is a data edit here (plus its id in the union) and a
 * matching producer in producers.ts.
 */

export type ResourceId =
  | 'wood'
  | 'stone'
  | 'food'
  | 'iron'
  | 'steel'
  | 'mithril'
  | 'arrow'
  | 'spear'
  | 'sword'
  | 'staff'
  | 'leather'
  | 'fur';

export type ResourceCategory = 'base' | 'metal' | 'weapon' | 'good';

export interface ResourceDef {
  name: string;
  category: ResourceCategory;
  blurb: string;
}

export const RESOURCES: Record<ResourceId, ResourceDef> = {
  wood: { name: 'Wood', category: 'base', blurb: 'Chopped from the treeline.' },
  stone: { name: 'Stone', category: 'base', blurb: 'Quarried from the hills.' },
  food: { name: 'Food', category: 'base', blurb: 'Feeds and trains your workers.' },

  iron: { name: 'Iron', category: 'metal', blurb: 'Smelted from ore and grit.' },
  steel: { name: 'Steel', category: 'metal', blurb: 'Iron, folded and hardened.' },
  mithril: { name: 'Mithril', category: 'metal', blurb: 'Light, strong, and rare.' },

  arrow: { name: 'Arrow', category: 'weapon', blurb: 'Fletched by the dozen.' },
  spear: { name: 'Spear', category: 'weapon', blurb: 'Simple, reliable, deadly.' },
  sword: { name: 'Sword', category: 'weapon', blurb: 'A soldier’s blade.' },
  staff: { name: 'Staff', category: 'weapon', blurb: 'Channels the arcane.' },

  leather: { name: 'Leather', category: 'good', blurb: 'Cured hide for armor.' },
  fur: { name: 'Fur', category: 'good', blurb: 'Warmth against the cold.' },
};

export const RESOURCE_IDS = Object.keys(RESOURCES) as ResourceId[];

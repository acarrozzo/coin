/**
 * Shared resource → icon map, used by any panel that renders a producer row
 * (ResourcePanel's structure cards and ThreatPanel's stat line). Kept in one
 * place so the two stay in sync.
 *
 * Most icons come from Lucide. The handful Lucide has no good glyph for are
 * vendored from Tabler/Phosphor in ./icons — see that folder's README.
 *
 * The map is a *total* Record, not a Partial: every ResourceId must have an
 * icon, so adding one to the union is a compile error until it gets a glyph.
 * (Honor and Wisdom silently rendered blank for exactly this reason.)
 */
import type { Component } from 'svelte';
import type { ResourceId } from '../content/resources';

import TreePine from '@lucide/svelte/icons/tree-pine';
import Mountain from '@lucide/svelte/icons/mountain';
import Wheat from '@lucide/svelte/icons/wheat';
import Gem from '@lucide/svelte/icons/gem';
import Sword from '@lucide/svelte/icons/sword';
import Wand2 from '@lucide/svelte/icons/wand-2';
import Shirt from '@lucide/svelte/icons/shirt';
import Skull from '@lucide/svelte/icons/skull';
import Bone from '@lucide/svelte/icons/bone';
import Shield from '@lucide/svelte/icons/shield';
import ShieldHalf from '@lucide/svelte/icons/shield-half';
import BowArrow from '@lucide/svelte/icons/bow-arrow';
import ChessBishop from '@lucide/svelte/icons/chess-bishop';
import Orbit from '@lucide/svelte/icons/orbit';
import FlaskRound from '@lucide/svelte/icons/flask-round';
import Leaf from '@lucide/svelte/icons/leaf';
import Star from '@lucide/svelte/icons/star';

// Vendored (see ./icons/README.md). TablerSword is aliased because Lucide's
// own Sword is still in use above.
import Cube from './icons/Cube.svelte';
import RectangularPrism from './icons/RectangularPrism.svelte';
import Octahedron from './icons/Octahedron.svelte';
import HexagonalPrism from './icons/HexagonalPrism.svelte';
import Hexagon3d from './icons/Hexagon3d.svelte';
import Needle from './icons/Needle.svelte';
import Trident from './icons/Trident.svelte';
import TablerSword from './icons/Sword.svelte';
import Spiral from './icons/Spiral.svelte';
import ShieldChevron from './icons/ShieldChevron.svelte';
import MilitaryRank from './icons/MilitaryRank.svelte';
import MilitaryAward from './icons/MilitaryAward.svelte';
import Texture from './icons/Texture.svelte';
import NorthStar from './icons/NorthStar.svelte';
import Book from './icons/Book.svelte';
import Coins from './icons/Coins.svelte';

export const RESOURCE_ICON: Record<ResourceId, Component> = {
  // base
  wood: TreePine,
  stone: Mountain,
  food: Wheat,

  // metals — Tabler's 3D solids, gaining faces as the chain gets rarer
  iron: Cube,
  steel: RectangularPrism,
  mithril: Octahedron,
  adamantium: HexagonalPrism,
  obsidion: Hexagon3d,

  // weapons
  arrow: Needle,
  spear: Trident,
  sword: Sword,
  staff: Wand2,
  // NOTE: gladius and claymore share a glyph — flagged for a follow-up pass.
  gladius: TablerSword,
  claymore: TablerSword,

  // goods
  leather: Shirt,
  fur: Texture,
  trollskull: Skull,
  dragonbone: Bone,

  // magic
  ether: Spiral,
  ward: ShieldHalf,

  // units
  archer: BowArrow,
  warrior: ShieldChevron,
  mage: ChessBishop,
  centurion: MilitaryRank,
  wargeneral: MilitaryAward,

  // quest items
  magicorb: Orbit,
  soulgem: Gem,
  starmetal: NorthStar,
  holywater: FlaskRound,
  dreamleaf: Leaf,

  // currency
  coin: Coins,

  // stats
  defense: Shield,
  honor: Star,
  wisdom: Book,
};

// jumpToResource moved to ./nav.svelte.ts — following a recipe link now has to
// switch tabs before it can scroll, which makes it navigation, not iconography.

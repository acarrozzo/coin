/**
 * Shared resource → Lucide icon map, used by any panel that renders a producer
 * row (ResourcePanel's structure cards and CombatPanel's Defense line). Kept in
 * one place so the two stay in sync.
 */
import type { Component } from 'svelte';
import type { ResourceId } from '../content/resources';

import TreePine from '@lucide/svelte/icons/tree-pine';
import Mountain from '@lucide/svelte/icons/mountain';
import Wheat from '@lucide/svelte/icons/wheat';
import Blocks from '@lucide/svelte/icons/blocks';
import Layers from '@lucide/svelte/icons/layers';
import Gem from '@lucide/svelte/icons/gem';
import Feather from '@lucide/svelte/icons/feather';
import Swords from '@lucide/svelte/icons/swords';
import Sword from '@lucide/svelte/icons/sword';
import Wand2 from '@lucide/svelte/icons/wand-2';
import Shirt from '@lucide/svelte/icons/shirt';
import PawPrint from '@lucide/svelte/icons/paw-print';
import Sparkles from '@lucide/svelte/icons/sparkles';
import Shield from '@lucide/svelte/icons/shield';
import Target from '@lucide/svelte/icons/target';
import ShieldHalf from '@lucide/svelte/icons/shield-half';
import WandSparkles from '@lucide/svelte/icons/wand-sparkles';
import Coins from '@lucide/svelte/icons/coins';
import Skull from '@lucide/svelte/icons/skull';
import Bone from '@lucide/svelte/icons/bone';
import Orbit from '@lucide/svelte/icons/orbit';
import Diamond from '@lucide/svelte/icons/diamond';
import Hexagon from '@lucide/svelte/icons/hexagon';
import Star from '@lucide/svelte/icons/star';
import Droplet from '@lucide/svelte/icons/droplet';
import Leaf from '@lucide/svelte/icons/leaf';
import Crown from '@lucide/svelte/icons/crown';
import Flag from '@lucide/svelte/icons/flag';

export const RESOURCE_ICON: Partial<Record<ResourceId, Component>> = {
  wood: TreePine,
  stone: Mountain,
  food: Wheat,
  iron: Blocks,
  steel: Layers,
  mithril: Gem,
  adamantium: Diamond,
  obsidion: Hexagon,
  arrow: Feather,
  spear: Swords,
  sword: Sword,
  staff: Wand2,
  gladius: Sword,
  claymore: Swords,
  leather: Shirt,
  fur: PawPrint,
  trollskull: Skull,
  dragonbone: Bone,
  ether: Sparkles,
  ward: Shield,
  archer: Target,
  warrior: ShieldHalf,
  mage: WandSparkles,
  centurion: Crown,
  wargeneral: Flag,
  magicorb: Orbit,
  soulgem: Gem,
  starmetal: Star,
  holywater: Droplet,
  dreamleaf: Leaf,
  coin: Coins,
  defense: Shield,
};

/** Scroll to a resource's producer row and briefly call it out (see [data-res]). */
export function jumpToResource(rid: ResourceId, onHighlight: (rid: ResourceId) => void): void {
  const el = document.querySelector<HTMLElement>(`[data-res="${rid}"]`);
  if (!el) return;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  onHighlight(rid);
}

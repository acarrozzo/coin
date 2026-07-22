/**
 * Single source of truth for the main-content sections, shared by ResourcePanel
 * (which renders them) and App's left "jump" rail (which navigates to them).
 * Keeping the group list and visibility rules here means the rail can never
 * drift out of sync with what's actually on screen.
 */
import type { Component } from 'svelte';
import type { GameState } from '../engine/state';
import type { ResourceId } from '../content/resources';
import { PRODUCERS, type StructureId } from '../content/producers';
import type { BuildingId } from '../content/buildings';
import {
  unlockedResources,
  isBuildingAvailable,
  isCombatUnlocked,
  isHexUnlocked,
  canBuild,
  canUpgradeSettlement,
  canTrainWorker,
  getTotalWorkers,
  willRepelAssault,
  willBreakHex,
} from '../engine/selectors';

// Structure header icons (also used as the rail's section icons).
import Trees from '@lucide/svelte/icons/trees';
import Pickaxe from '@lucide/svelte/icons/pickaxe';
import Hammer from '@lucide/svelte/icons/hammer';
import House from '@lucide/svelte/icons/house';
import TowerControl from '@lucide/svelte/icons/tower-control';
import Castle from '@lucide/svelte/icons/castle';
import Cloud from '@lucide/svelte/icons/cloud';
import Swords from '@lucide/svelte/icons/swords';
// Rail-only icons for the non-resource sections.
import Home from '@lucide/svelte/icons/home';
import Shield from '@lucide/svelte/icons/shield';
import Store from '@lucide/svelte/icons/store';

/** The Market (coin economy) unlocks at settlement level 5. */
export const MARKET_UNLOCK_LEVEL = 5;
export function isMarketUnlocked(gs: GameState): boolean {
  return gs.level >= MARKET_UNLOCK_LEVEL;
}

// Each group is a structure card: a header (name + level + upgrade), the
// resources it produces as single rows, and — for Core Resources — the Farm
// upgrade as a footer (it blends settlement gathering + the Farm).
export interface GroupDef {
  key: string;
  label: string;
  icon: Component;
  /** Building whose upgrade this group owns (null = no upgrade, e.g. pure gathering). */
  building: BuildingId | null;
  /** Structures whose producers appear in this group, in row order. */
  structures: StructureId[];
  /** Core blends structures; its upgrade sits in a footer, not the header. */
  upgradeInFooter?: boolean;
}

export const GROUP_DEFS: GroupDef[] = [
  {
    key: 'core',
    label: 'Core Resources',
    icon: Trees,
    building: 'farm',
    structures: ['settlement', 'farm'],
    upgradeInFooter: true,
  },
  {
    key: 'hunterscabin',
    label: "Hunter's Cabin",
    icon: House,
    building: 'hunterscabin',
    structures: ['hunterscabin'],
  },
  {
    key: 'blacksmith',
    label: 'Blacksmith',
    icon: Hammer,
    building: 'blacksmith',
    structures: ['blacksmith'],
  },
  {
    key: 'barracks',
    label: 'Barracks',
    icon: Swords,
    building: 'barracks',
    structures: ['barracks'],
  },
  {
    key: 'castle',
    label: 'Castle',
    icon: Castle,
    building: 'castle',
    structures: ['castle'],
  },
  {
    key: 'wizardtower',
    label: 'Wizard Tower',
    icon: TowerControl,
    building: 'wizardtower',
    structures: ['wizardtower'],
  },
  {
    key: 'cloudshaman',
    label: 'Cloud Shaman',
    icon: Cloud,
    building: 'cloudshaman',
    structures: ['cloudshaman'],
  },
  {
    key: 'deepmine',
    label: 'Deep Mine',
    icon: Pickaxe,
    building: 'deepmine',
    structures: ['deepmine'],
  },
];

export interface ResourceGroup extends GroupDef {
  /** Producer resource ids shown in this group, in row order. */
  ids: ResourceId[];
}

/**
 * The resource groups currently on screen, with their live producer rows.
 * Mirrors exactly what ResourcePanel renders.
 */
export function getResourceGroups(gs: GameState): ResourceGroup[] {
  const unlocked = unlockedResources(gs);
  const combatUnlocked = isCombatUnlocked(gs);
  const hexUnlocked = isHexUnlocked(gs);

  return GROUP_DEFS.map((g) => ({
    ...g,
    // Once assault unlocks, Defense leaves the Castle card for the Assault
    // panel; likewise Ward leaves the Wizard Tower for the Hex panel.
    ids: unlocked.filter(
      (id) =>
        g.structures.includes(PRODUCERS[id]?.structure as StructureId) &&
        !(id === 'defense' && combatUnlocked) &&
        !(id === 'ward' && hexUnlocked),
    ),
  })).filter(
    // Show a group once its resources exist, or once its building can be
    // built/upgraded. Core is always present.
    (g) =>
      g.key === 'core' ||
      g.ids.length > 0 ||
      (g.building !== null && isBuildingAvailable(gs, g.building)),
  );
}

/** A navigable section in the main content, rendered as a left-rail button. */
export interface NavSection {
  /** Matches the target element's `data-nav` attribute. */
  id: string;
  label: string;
  icon: Component;
  /** Workers assigned to this section (0 = hide the badge). */
  count: number;
  /** 'good' = an affordable build/upgrade waits here; 'bad' = combat danger. */
  alert: 'good' | 'bad' | null;
  /** Render a divider before this button — separates the shop from the main sections. */
  separated?: boolean;
}

/**
 * The ordered list of jump-rail sections for the current state: Settlement,
 * Combat (once unlocked), then each visible resource group — each carrying a
 * worker count and an opportunity/danger indicator.
 */
export function getNavSections(gs: GameState): NavSection[] {
  const sections: NavSection[] = [];

  sections.push({
    id: 'settlement',
    label: 'Settlement',
    icon: Home,
    count: getTotalWorkers(gs),
    // Flag either affordable action in this section: a settlement upgrade or
    // training the next worker (both live in SettlementPanel).
    alert: canUpgradeSettlement(gs) || canTrainWorker(gs) ? 'good' : null,
  });

  if (isCombatUnlocked(gs)) {
    const hex = isHexUnlocked(gs);
    const count = (gs.workers.assigned.defense ?? 0) + (hex ? (gs.workers.assigned.ward ?? 0) : 0);
    const danger = !willRepelAssault(gs) || (hex && !willBreakHex(gs));
    sections.push({
      id: 'combat',
      label: 'Defense',
      icon: Shield,
      count,
      alert: danger ? 'bad' : null,
    });
  }

  for (const g of getResourceGroups(gs)) {
    const count = g.ids.reduce((n, id) => n + (gs.workers.assigned[id] ?? 0), 0);
    sections.push({
      id: `group:${g.key}`,
      label: g.label,
      icon: g.icon,
      count,
      alert: g.building && canBuild(gs, g.building) ? 'good' : null,
    });
  }

  // The Market is the final section, set apart from the resource groups.
  if (isMarketUnlocked(gs)) {
    sections.push({
      id: 'market',
      label: 'Market',
      icon: Store,
      count: 0,
      alert: null,
      separated: true,
    });
  }

  return sections;
}

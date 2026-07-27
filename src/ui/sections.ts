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
  needsThreatSupply,
  hasMarketOpportunity,
} from '../engine/selectors';

// Structure header icons (also used as the rail's section icons).
import Trees from '@lucide/svelte/icons/trees';
import Pickaxe from '@lucide/svelte/icons/pickaxe';
import Anvil from '@lucide/svelte/icons/anvil';
import House from '@lucide/svelte/icons/house';
import TowerControl from '@lucide/svelte/icons/tower-control';
import Castle from '@lucide/svelte/icons/castle';
import Cloud from '@lucide/svelte/icons/cloud';
import Deer from './icons/Deer.svelte';
import UsersGroup from './icons/UsersGroup.svelte';
// Rail-only icons for the non-resource sections.
import Swords from '@lucide/svelte/icons/swords';
import Skull from '@lucide/svelte/icons/skull';
import BuildingStore from './icons/BuildingStore.svelte';

// The Market's level gates are content (content/market.ts); re-exported here
// because the nav rail and the Market panel both reach for them via sections.
import { MARKET_UNLOCK_LEVEL } from '../content/market';
export { MARKET_UNLOCK_LEVEL, FULL_MARKET_LEVEL } from '../content/market';
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
    icon: Deer,
    building: 'hunterscabin',
    structures: ['hunterscabin'],
  },
  {
    key: 'blacksmith',
    label: 'Blacksmith',
    icon: Anvil,
    building: 'blacksmith',
    structures: ['blacksmith'],
  },
  {
    key: 'barracks',
    label: 'Barracks',
    icon: UsersGroup,
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
 * Group keys belonging to the Quests zone rather than the Settlement zone. The
 * Castle is named "Quest Lands" and produces most of the quest-item chain
 * (magic orbs, soul gems, star metal, holy water); the Cloud Shaman weaves the
 * last one, dream leaf, so both sit here.
 */
export const QUEST_GROUP_KEYS: readonly string[] = ['castle', 'cloudshaman'];

/**
 * Every visible resource group, across all tabs. Prefer getSettlementGroups /
 * getQuestGroups — those say which tab they belong to.
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
    // built/upgraded. Core shows only after the first worker is trained.
    (g) => {
      if (g.key === 'core') return gs.workers.trained >= 1;
      return g.ids.length > 0 || (g.building !== null && isBuildingAvailable(gs, g.building));
    },
  );
}

/** The groups in the Settlement zone — everything not claimed by Quests. */
export function getSettlementGroups(gs: GameState): ResourceGroup[] {
  return getResourceGroups(gs).filter((g) => !QUEST_GROUP_KEYS.includes(g.key));
}

/** The groups in the Quests zone. */
export function getQuestGroups(gs: GameState): ResourceGroup[] {
  return getResourceGroups(gs).filter((g) => QUEST_GROUP_KEYS.includes(g.key));
}

/** The Quests zone appears only once it has something in it. */
export function isQuestsUnlocked(gs: GameState): boolean {
  return getQuestGroups(gs).length > 0;
}

/** Whether an affordable build/upgrade is waiting in the Quests zone. */
export function hasQuestsOpportunity(gs: GameState): boolean {
  return getQuestGroups(gs).some((g) => g.building !== null && canBuild(gs, g.building));
}

/** The three top-level zones of the single scrolling page. */
export type Zone = 'settlement' | 'quests' | 'market';

/** A navigable section in the main content, rendered as a left-rail button. */
export interface NavSection {
  /** Matches the target element's `data-nav` attribute. */
  id: string;
  label: string;
  icon: Component;
  /** Workers assigned to this section (0 = hide the badge). */
  count: number;
  /**
   * 'good' = an affordable build/upgrade waits here; 'warn' = a threat track is
   * under-supplied (stat below cap, or line unstaffed); 'bad' = danger.
   */
  alert: 'good' | 'warn' | 'bad' | null;
  /** Which page zone this section falls in — the rail rules a line between zones. */
  zone: Zone;
}

/**
 * The ordered list of jump-rail sections for the current state, in page order:
 * the Settlement zone (settlement, combat, its resource groups), then the
 * Quests zone, then the Market — each carrying a worker count and an
 * opportunity/danger indicator.
 *
 * Everything on the page is listed. The tabs jump between the three coarse
 * zones; the rail is the fine-grained table of contents inside them.
 */
export function getNavSections(gs: GameState): NavSection[] {
  const sections: NavSection[] = [];

  sections.push({
    id: 'settlement',
    label: 'Settlement',
    icon: House,
    count: getTotalWorkers(gs),
    // Flag either affordable action in this section: a settlement upgrade or
    // training the next worker (both live in SettlementPanel).
    alert: canUpgradeSettlement(gs) || canTrainWorker(gs) ? 'good' : null,
    zone: 'settlement',
  });

  // The two threat tracks share one panel but get their own rail buttons — each
  // flags only its own supply problem, so the player knows which one to feed.
  if (isCombatUnlocked(gs)) {
    sections.push({
      id: 'combat:assault',
      label: 'Assault',
      icon: Swords,
      count: gs.workers.assigned.defense ?? 0,
      alert: needsThreatSupply(gs, 'defense') ? 'warn' : null,
      zone: 'settlement',
    });
  }

  if (isHexUnlocked(gs)) {
    sections.push({
      id: 'combat:hex',
      label: 'Hex',
      icon: Skull,
      count: gs.workers.assigned.ward ?? 0,
      alert: needsThreatSupply(gs, 'ward') ? 'warn' : null,
      zone: 'settlement',
    });
  }

  const groupSection = (g: ResourceGroup, zone: Zone): NavSection => ({
    id: `group:${g.key}`,
    label: g.label,
    icon: g.icon,
    count: g.ids.reduce((n, id) => n + (gs.workers.assigned[id] ?? 0), 0),
    alert: g.building && canBuild(gs, g.building) ? 'good' : null,
    zone,
  });

  for (const g of getSettlementGroups(gs)) sections.push(groupSection(g, 'settlement'));
  for (const g of getQuestGroups(gs)) sections.push(groupSection(g, 'quests'));

  if (isMarketUnlocked(gs)) {
    sections.push({
      id: 'market',
      label: 'Market',
      icon: BuildingStore,
      count: 0,
      alert: hasMarketOpportunity(gs) ? 'good' : null,
      zone: 'market',
    });
  }

  return sections;
}

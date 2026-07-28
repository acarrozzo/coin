/**
 * Single source of truth for the main-content tabs and the sections inside
 * them, shared by App (which renders the tab bar and the left rail) and
 * ResourcePanel (which renders a tab's structure cards).
 *
 * Content is split across real tabs: only the selected tab's panels are
 * mounted. Every group knows which tab it belongs to, so the bar, the rail and
 * the rendered content can never drift apart.
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
  isPrestigeUnlocked,
  canPrestige,
} from '../engine/selectors';

export { isPrestigeUnlocked, canPrestige } from '../engine/selectors';

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
import Crown from '@lucide/svelte/icons/crown';
// Tab-bar icons for the tabs holding more than one structure, which therefore
// have no glyph of their own (Crafting borrows the Blacksmith's anvil).
import Boxes from '@lucide/svelte/icons/boxes';
import Sparkles from '@lucide/svelte/icons/sparkles';
import ScrollText from '@lucide/svelte/icons/scroll-text';

// The Market's level gates are content (content/market.ts); re-exported here
// because the nav rail and the Market panel both reach for them via sections.
import { MARKET_UNLOCK_LEVEL } from '../content/market';
export { MARKET_UNLOCK_LEVEL, FULL_MARKET_LEVEL } from '../content/market';
export function isMarketUnlocked(gs: GameState): boolean {
  return gs.level >= MARKET_UNLOCK_LEVEL;
}

/** The top-level content tabs, in bar order. */
export type TabId =
  | 'settlement'
  | 'resources'
  | 'crafting'
  | 'mysticism'
  | 'quests'
  | 'market'
  | 'prestige';

// Each group is a structure card: a header (name + level + upgrade), the
// resources it produces as single rows, and — for Core Resources — the Farm
// upgrade as a footer (it blends settlement gathering + the Farm).
export interface GroupDef {
  key: string;
  label: string;
  icon: Component;
  /** Which tab renders this card. */
  tab: TabId;
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
    tab: 'resources',
    building: 'farm',
    structures: ['settlement', 'farm'],
    upgradeInFooter: true,
  },
  {
    key: 'deepmine',
    label: 'Deep Mine',
    icon: Pickaxe,
    tab: 'resources',
    building: 'deepmine',
    structures: ['deepmine'],
  },
  {
    key: 'hunterscabin',
    label: "Hunter's Cabin",
    icon: Deer,
    tab: 'crafting',
    building: 'hunterscabin',
    structures: ['hunterscabin'],
  },
  {
    key: 'blacksmith',
    label: 'Blacksmith',
    icon: Anvil,
    tab: 'crafting',
    building: 'blacksmith',
    structures: ['blacksmith'],
  },
  {
    key: 'barracks',
    label: 'Barracks',
    icon: UsersGroup,
    tab: 'crafting',
    building: 'barracks',
    structures: ['barracks'],
  },
  {
    key: 'wizardtower',
    label: 'Wizard Tower',
    icon: TowerControl,
    tab: 'mysticism',
    building: 'wizardtower',
    structures: ['wizardtower'],
  },
  {
    key: 'cloudshaman',
    label: 'Cloud Shaman',
    icon: Cloud,
    tab: 'mysticism',
    building: 'cloudshaman',
    structures: ['cloudshaman'],
  },
  {
    key: 'castle',
    // The building id is `castle`; the place is the Quest Hall.
    label: 'Quest Hall',
    icon: Castle,
    tab: 'quests',
    building: 'castle',
    structures: ['castle'],
  },
];

export interface ResourceGroup extends GroupDef {
  /** Producer resource ids shown in this group, in row order. */
  ids: ResourceId[];
}

/**
 * Every visible resource group, across all tabs. Prefer getGroupsForTab — it
 * says which tab the cards belong to.
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

/** The visible groups belonging to one tab, in card order. */
export function getGroupsForTab(gs: GameState, tab: TabId): ResourceGroup[] {
  return getResourceGroups(gs).filter((g) => g.tab === tab);
}

/**
 * Which tab shows a resource's producer row — used to follow a recipe/cost link
 * across the tab split. Defense and Ward move to the Combat panel (Settlement
 * tab) once their track is live, exactly as getResourceGroups drops them.
 */
export function tabForResource(gs: GameState, id: ResourceId): TabId | null {
  // Defense and Ward leave their structure card for the Combat panel, which
  // lives on the Settlement tab.
  if (id === 'defense' && isCombatUnlocked(gs)) return 'settlement';
  if (id === 'ward' && isHexUnlocked(gs)) return 'settlement';
  const structure = PRODUCERS[id]?.structure;
  if (!structure) return null;
  return GROUP_DEFS.find((g) => g.structures.includes(structure))?.tab ?? null;
}

/** An opportunity/danger signal. 'bad' outranks 'warn', which outranks 'good'. */
export type Alert = 'good' | 'warn' | 'bad';
const ALERT_RANK: Record<Alert, number> = { good: 0, warn: 1, bad: 2 };

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
  alert: Alert | null;
  /** Which tab this section lives on — the rail only shows the active tab's. */
  tab: TabId;
}

/**
 * Every visible section for the current state, in page order, each carrying a
 * worker count and an opportunity/danger indicator.
 *
 * This is the whole map of the game's content: App filters it by the active tab
 * for the rail, and derives the tab bar itself from which tabs appear in it.
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
    tab: 'settlement',
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
      tab: 'settlement',
    });
  }

  if (isHexUnlocked(gs)) {
    sections.push({
      id: 'combat:hex',
      label: 'Hex',
      icon: Skull,
      count: gs.workers.assigned.ward ?? 0,
      alert: needsThreatSupply(gs, 'ward') ? 'warn' : null,
      tab: 'settlement',
    });
  }

  for (const g of getResourceGroups(gs)) {
    sections.push({
      id: `group:${g.key}`,
      label: g.label,
      icon: g.icon,
      count: g.ids.reduce((n, id) => n + (gs.workers.assigned[id] ?? 0), 0),
      alert: g.building && canBuild(gs, g.building) ? 'good' : null,
      tab: g.tab,
    });
  }

  if (isMarketUnlocked(gs)) {
    sections.push({
      id: 'market',
      label: 'Market',
      icon: BuildingStore,
      count: 0,
      alert: hasMarketOpportunity(gs) ? 'good' : null,
      tab: 'market',
    });
  }

  if (isPrestigeUnlocked(gs)) {
    sections.push({
      id: 'prestige',
      label: gs.prestige.level > 0 ? `Prestige Lvl ${gs.prestige.level}` : 'Prestige',
      icon: Crown,
      count: 0,
      alert: canPrestige(gs) ? 'good' : null,
      tab: 'prestige',
    });
  }

  return sections;
}

export interface TabDef {
  id: TabId;
  label: string;
  /** Used below 560px, where the full label is too long. */
  shortLabel?: string;
  icon: Component;
  /** The most severe alert among the sections on this tab. */
  alert?: Alert | null;
}

/**
 * The tab bar, in bar order. Every tab is listed; getTabs() drops the ones with
 * nothing in them yet.
 */
export const TAB_DEFS: readonly TabDef[] = [
  { id: 'settlement', label: 'Settlement', icon: House },
  { id: 'resources', label: 'Resources', icon: Boxes },
  { id: 'crafting', label: 'Crafting', icon: Anvil },
  { id: 'mysticism', label: 'Mysticism', shortLabel: 'Mystic', icon: Sparkles },
  { id: 'quests', label: 'Quests', icon: ScrollText },
  { id: 'market', label: 'Market', icon: BuildingStore },
  { id: 'prestige', label: 'Prestige', icon: Crown },
];

/**
 * The tabs that currently have content, each with the most severe alert among
 * its sections. Derived from getNavSections rather than from its own gate list,
 * so a tab can never appear empty or hide something the rail would have shown.
 *
 * Because only one tab's content is mounted at a time, the dot is the player's
 * only signal that something is waiting on a tab they aren't looking at.
 */
export function getTabs(gs: GameState): TabDef[] {
  const sections = getNavSections(gs);

  return TAB_DEFS.filter((t) => sections.some((s) => s.tab === t.id)).map((t) => {
    let alert: Alert | null = null;
    for (const s of sections) {
      if (s.tab !== t.id || s.alert === null) continue;
      if (alert === null || ALERT_RANK[s.alert] > ALERT_RANK[alert]) alert = s.alert;
    }
    return {
      ...t,
      // Wears its level once earned — but stays a bare "Prestige" before the
      // first one, when there's no level to show.
      label:
        t.id === 'prestige' && gs.prestige.level > 0
          ? `Prestige Lvl ${gs.prestige.level}`
          : t.label,
      alert,
    };
  });
}

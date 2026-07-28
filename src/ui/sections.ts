/**
 * Single source of truth for the main-content tabs and the sections inside
 * them, shared by App (which renders the tab bar and the left rail) and
 * ResourcePanel (which renders a tab's structure cards).
 *
 * Every tab's content is mounted at once, in one long scroll — the "tabs" are
 * regions of that page, not alternatives to it. Every group still knows which
 * tab it belongs to, which is what lets the bar, the rail and the page order
 * agree: getNavSections returns the sections in PAGE order, so grouping them by
 * `tab` gives the regions, and the first section of a region is what its tab
 * scrolls to.
 *
 * That makes page order load-bearing (see assertTabContiguity's test): the tab
 * bar can only be a set of jump targets while each tab's sections form one
 * unbroken run, in TAB_DEFS order.
 */
import type { Component } from 'svelte';
import type { GameState } from '../engine/state';
import { RESOURCES, type ResourceId } from '../content/resources';
import { PRODUCERS, type StructureId } from '../content/producers';
import { BUILDINGS, type BuildingId } from '../content/buildings';
import {
  unlockedResources,
  isBuildingAvailable,
  isCombatUnlocked,
  isHexUnlocked,
  canBuild,
  canUpgradeSettlement,
  canTrainWorker,
  getTotalWorkers,
  threatSupplyGaps,
  threatInputGaps,
  getStructureLevel,
  hasMarketOpportunity,
  countMarketOpportunities,
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
import Shield from '@lucide/svelte/icons/shield';
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
  | 'threats'
  | 'resources'
  | 'crafting'
  | 'quests'
  | 'mysticism'
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
    key: 'castle',
    // The building id is `castle`; the place is the Quest Hall.
    label: 'Quest Hall',
    icon: Castle,
    tab: 'quests',
    building: 'castle',
    structures: ['castle'],
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
    // panel over on Threats; likewise Ward leaves the Wizard Tower for the Hex
    // panel.
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

/** How urgent an alert is. 'bad' outranks 'warn', which outranks 'good'. */
export type Severity = 'good' | 'warn' | 'bad';
const SEVERITY_RANK: Record<Severity, number> = { good: 0, warn: 1, bad: 2 };

/**
 * Something waiting in a section, and — crucially — what it is. The reason is
 * what turns a coloured dot from "look somewhere in here" into an answer.
 */
export interface Alert {
  severity: Severity;
  /** Human sentence naming what's waiting, shown in the dot's flyout. */
  reason: string;
}

/** An alert plus the section it belongs to, for a tab listing all of its own. */
export interface TabAlert extends Alert {
  /** The section's rail id, so the listing can key on it. */
  id: string;
  label: string;
}

/** What's affordable in the settlement panel: an upgrade, a worker, or both. */
function settlementAlert(gs: GameState): Alert | null {
  const upgrade = canUpgradeSettlement(gs);
  const worker = canTrainWorker(gs);
  if (!upgrade && !worker) return null;
  const reason =
    upgrade && worker
      ? 'Upgrade and new worker affordable'
      : upgrade
        ? 'Settlement upgrade affordable'
        : 'New worker affordable';
  return { severity: 'good', reason };
}

/**
 * A threat track's alert.
 *
 * Deliberately says nothing about whether the next wave will be repelled. Waves
 * outgrow your walls as a matter of course, and a dot telling you about a loss
 * you cannot prevent is noise — the panel's own verdict line still forecasts it
 * for anyone reading the track itself.
 *
 * What it does report is the three things you can act on, worst first:
 *
 *   red    the line is BLOCKED — you lack the archers/mages/skulls it consumes,
 *          so no amount of staffing produces anything
 *   red    the stat is below its cap — you are not as defended as you could be
 *   amber  the line is simply unstaffed, with everything else in order
 *
 * Quiet at cap with the line staffed: the converter is idle by design there, so
 * missing inputs aren't yet a problem worth raising.
 */
function threatAlert(gs: GameState, stat: 'defense' | 'ward'): Alert | null {
  const { belowCap, understaffed } = threatSupplyGaps(gs, stat);
  if (!belowCap && !understaffed) return null;

  const name = RESOURCES[stat].name;

  // The blocking problem outranks the others: it's the one that makes fixing
  // them pointless.
  const missing = threatInputGaps(gs, stat);
  if (missing.length > 0) {
    const names = missing.map((id) => RESOURCES[id].name);
    const list =
      names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
    return { severity: 'bad', reason: `No ${list} to raise ${name}` };
  }

  if (belowCap) {
    return {
      severity: 'bad',
      reason: understaffed ? `${name} below cap, line unstaffed` : `${name} below cap`,
    };
  }
  return { severity: 'warn', reason: `${name} line unstaffed` };
}

/** An affordable build or upgrade on a structure card. */
function buildAlert(gs: GameState, building: BuildingId | null): Alert | null {
  if (!building || !canBuild(gs, building)) return null;
  const level = getStructureLevel(gs, building);
  return {
    severity: 'good',
    reason: level === 0 ? `Build ${BUILDINGS[building].name}` : `Upgrade to level ${level + 1}`,
  };
}

/** A navigable section in the main content, rendered as a left-rail button. */
export interface NavSection {
  /** Matches the target element's `data-nav` attribute. */
  id: string;
  label: string;
  icon: Component;
  /** Workers assigned to this section (0 = hide the badge). */
  count: number;
  /**
   * What's waiting here, or null. 'good' = an affordable build/upgrade; 'warn' =
   * a threat track you can top up; 'bad' = one you cannot (see threatAlert).
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
    alert: settlementAlert(gs),
    tab: 'settlement',
  });

  // The two threat tracks share one panel, on their own tab, but get their own
  // rail buttons — each flags only its own supply problem, so the player knows
  // which one to feed. Splitting them off Settlement also stops an amber
  // under-supplied warning being masked by a gold "you can upgrade" dot.
  if (isCombatUnlocked(gs)) {
    sections.push({
      id: 'combat:assault',
      label: 'Assault',
      icon: Swords,
      count: gs.workers.assigned.defense ?? 0,
      alert: threatAlert(gs, 'defense'),
      tab: 'threats',
    });
  }

  if (isHexUnlocked(gs)) {
    sections.push({
      id: 'combat:hex',
      label: 'Hex',
      icon: Skull,
      count: gs.workers.assigned.ward ?? 0,
      alert: threatAlert(gs, 'ward'),
      tab: 'threats',
    });
  }

  for (const g of getResourceGroups(gs)) {
    sections.push({
      id: `group:${g.key}`,
      label: g.label,
      icon: g.icon,
      count: g.ids.reduce((n, id) => n + (gs.workers.assigned[id] ?? 0), 0),
      alert: buildAlert(gs, g.building),
      tab: g.tab,
    });
  }

  if (isMarketUnlocked(gs)) {
    sections.push({
      id: 'market',
      label: 'Market',
      icon: BuildingStore,
      count: 0,
      alert: hasMarketOpportunity(gs)
        ? {
            severity: 'good',
            // One section, but it can hold several trades — so unlike every
            // other alert its reason carries its own count.
            reason: `${countMarketOpportunities(gs)} offers ready`,
          }
        : null,
      tab: 'market',
    });
  }

  if (isPrestigeUnlocked(gs)) {
    sections.push({
      id: 'prestige',
      label: gs.prestige.level > 0 ? `Prestige Lvl ${gs.prestige.level}` : 'Prestige',
      icon: Crown,
      count: 0,
      alert: canPrestige(gs) ? { severity: 'good', reason: 'Prestige available' } : null,
      tab: 'prestige',
    });
  }

  return sections;
}

/**
 * The first section of a tab's region — where its tab-bar button scrolls to.
 * Null when the tab has no content yet (getTabs would have dropped it).
 */
export function firstSectionForTab(gs: GameState, tab: TabId): NavSection | null {
  return getNavSections(gs).find((s) => s.tab === tab) ?? null;
}

/**
 * Which tab region a section id belongs to — the scroll-spy's lookup, turning
 * "the section under the header line" into "the tab to highlight".
 */
export function tabForSection(gs: GameState, id: string): TabId | null {
  return getNavSections(gs).find((s) => s.id === id)?.tab ?? null;
}

export interface TabDef {
  id: TabId;
  label: string;
  icon: Component;
  /**
   * Everything waiting on this tab, most severe first — so the dot can colour
   * itself from the worst one, count them, and name them all on hover.
   */
  alerts?: TabAlert[];
}

/**
 * The tab bar, in bar order. Every tab is listed; getTabs() drops the ones with
 * nothing in them yet.
 */
export const TAB_DEFS: readonly TabDef[] = [
  { id: 'settlement', label: 'Settlement', icon: House },
  { id: 'threats', label: 'Threats', icon: Shield },
  { id: 'resources', label: 'Resources', icon: Boxes },
  { id: 'crafting', label: 'Crafting', icon: Anvil },
  { id: 'quests', label: 'Quests', icon: ScrollText },
  { id: 'mysticism', label: 'Mysticism', icon: Sparkles },
  { id: 'market', label: 'Market', icon: BuildingStore },
  { id: 'prestige', label: 'Prestige', icon: Crown },
];

/** A tab's display name — used to label the jump rail's matching cluster. */
export function tabLabel(id: TabId): string {
  return TAB_DEFS.find((t) => t.id === id)?.label ?? id;
}

/**
 * The tabs that currently have content, each carrying every alert among its own
 * sections. Derived from getNavSections rather than from its own gate list, so a
 * tab can never appear empty or hide something the rail would have shown.
 *
 * The whole list is kept, not just the worst one: the dot takes its colour from
 * the most severe, its count from how many there are, and its flyout names each
 * one — which is what saves scrolling the region to find out what it meant.
 */
export function getTabs(gs: GameState): TabDef[] {
  const sections = getNavSections(gs);

  return TAB_DEFS.filter((t) => sections.some((s) => s.tab === t.id)).map((t) => ({
    ...t,
    alerts: sections
      .filter((s) => s.tab === t.id && s.alert !== null)
      // Worst first. Array#sort is stable, so equally severe alerts stay in
      // page order — the order you'd meet them scrolling the region.
      .map((s) => ({ id: s.id, label: s.label, ...s.alert! }))
      .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]),
  }));
}

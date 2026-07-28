/**
 * Which content tab the player is currently *looking at*.
 *
 * Every tab's content is mounted at once, in one long scroll — the tab bar
 * navigates rather than filters. So this is an OUTPUT of the scroll position,
 * not an input to rendering: App's scroll-spy writes it from whichever section
 * currently sits under the sticky chrome, and MainTabs reads it to decide which
 * tab is highlighted. Nothing mounts or unmounts because of it.
 *
 * It still lives outside App because MainTabs and the spy are on opposite sides
 * of the component, and because it survives a re-render of either.
 *
 * Deliberately not part of GameState: it's view state, not simulation state, so
 * it stays out of the save file and resets to Settlement on load.
 */
import type { ResourceId } from '../content/resources';
import type { GameState } from '../engine/state';
import { isResourceUnlocked } from '../engine/selectors';
import type { TabId } from './sections';

/** How long a jumped-to row stays called out, in ms. */
const HIGHLIGHT_MS = 1600;

class Nav {
  tab = $state<TabId>('settlement');

  /**
   * The row a jump just landed on, called out for a moment so the landing is
   * visible. Shared rather than per-component because the link and the row it
   * points at are almost never rendered by the same component — a settlement
   * cost chip points at a ResourcePanel row, a recipe pill at a row in another
   * card entirely. Whoever renders the row reads this; whoever holds the link
   * only calls jumpToResource.
   */
  jumped = $state<ResourceId | null>(null);
  #timer: ReturnType<typeof setTimeout> | undefined;

  select(tab: TabId): void {
    this.tab = tab;
  }

  highlight(rid: ResourceId): void {
    this.jumped = rid;
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => (this.jumped = null), HIGHLIGHT_MS);
  }
}

export const nav = new Nav();

/**
 * Follow a recipe/cost link to a resource's producer row: scroll it into view
 * and briefly call it out (see [data-res] and nav.jumped).
 *
 * No tab switching any more — every producer row is mounted all the time, so
 * the row an ingredient link points at is always already in the document, even
 * when it belongs to a different part of the page than the recipe naming it.
 */
export function jumpToResource(rid: ResourceId): void {
  const el = document.querySelector<HTMLElement>(`[data-res="${rid}"]`);
  if (!el) return;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  nav.highlight(rid);
}

/**
 * Whether a cost/requirement chip naming this resource has anywhere to jump to.
 *
 * A row exists only for an unlocked producer, so honor and wisdom (won in
 * combat, never produced) never have one — chips naming them stay plain text
 * rather than becoming buttons that do nothing.
 */
export function hasResourceRow(gs: GameState, rid: ResourceId): boolean {
  return isResourceUnlocked(gs, rid);
}

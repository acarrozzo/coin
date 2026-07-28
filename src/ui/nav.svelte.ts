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
import type { TabId } from './sections';

class Nav {
  tab = $state<TabId>('settlement');

  select(tab: TabId): void {
    this.tab = tab;
  }
}

export const nav = new Nav();

/**
 * Follow a recipe/cost link to a resource's producer row: scroll it into view
 * and briefly call it out (see [data-res]).
 *
 * No tab switching any more — every producer row is mounted all the time, so
 * the row an ingredient link points at is always already in the document, even
 * when it belongs to a different part of the page than the recipe naming it.
 */
export function jumpToResource(rid: ResourceId, onHighlight: (rid: ResourceId) => void): void {
  const el = document.querySelector<HTMLElement>(`[data-res="${rid}"]`);
  if (!el) return;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  onHighlight(rid);
}

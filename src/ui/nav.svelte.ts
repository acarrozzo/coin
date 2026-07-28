/**
 * Which content tab is showing. Lives outside App because two places need it:
 * App (renders the bar and the tab's panels) and ResourcePanel (whose cost and
 * recipe links point at resources that now sit on *other* tabs — following one
 * has to switch tabs before it can scroll).
 *
 * Deliberately not part of GameState: it's view state, not simulation state, so
 * it stays out of the save file and resets to Settlement on load.
 */
import { tick } from 'svelte';
import type { GameState } from '../engine/state';
import type { ResourceId } from '../content/resources';
import { tabForResource, type TabId } from './sections';

class Nav {
  tab = $state<TabId>('settlement');

  select(tab: TabId): void {
    this.tab = tab;
  }
}

export const nav = new Nav();

/**
 * Follow a recipe/cost link to a resource's producer row: switch to whichever
 * tab shows it, scroll it into view and briefly call it out (see [data-res]).
 *
 * The tab hop is the whole reason this is async — most ingredients now live on
 * a different tab from the recipe that wants them (a Blacksmith recipe needs
 * wood, which is on Resources), and the row doesn't exist to scroll to until
 * that tab's content has mounted.
 */
export async function jumpToResource(
  gs: GameState,
  rid: ResourceId,
  onHighlight: (rid: ResourceId) => void,
): Promise<void> {
  const target = tabForResource(gs, rid);
  if (target && target !== nav.tab) {
    nav.select(target);
    await tick();
  }
  const el = document.querySelector<HTMLElement>(`[data-res="${rid}"]`);
  if (!el) return;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  onHighlight(rid);
}

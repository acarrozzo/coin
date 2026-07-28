<script lang="ts">
  /**
   * The app's top-level zone bar: the settlement itself, Quests, the Market, and
   * Prestige.
   *
   * These look like tabs but navigate rather than switch — the page is one
   * continuous scroll holding all three zones, and pressing one scrolls to it.
   * The active one follows the scroll position. That's why the markup is a
   * `nav` with `aria-current` rather than a `tablist`: nothing swaps panels, and
   * claiming `role="tab"` would promise screen readers a panel switch that
   * never happens.
   *
   * Purely presentational — App owns which zones exist and what they carry, so a
   * zone appears here only once its content does. Each can show an alert dot
   * when something is waiting there, matching the left rail's existing language.
   * Deliberately no numbers: a count beside "Market" reads as a coin balance,
   * and beside "Quests" as something other than the worker tally it was.
   */
  import type { Component } from 'svelte';

  export type MainTab = 'settlement' | 'quests' | 'market' | 'prestige';

  export interface TabDef {
    id: MainTab;
    label: string;
    /** Used below 560px, where the full settlement title is too long. */
    shortLabel?: string;
    icon: Component;
    /** Gold dot — something is waiting in this zone. */
    alert?: boolean;
  }

  interface Props {
    tabs: TabDef[];
    /** The zone currently under the header line, from the page's scroll-spy. */
    active: MainTab;
    onselect: (tab: MainTab) => void;
  }

  const { tabs, active, onselect }: Props = $props();
</script>

<nav class="main-tabs" aria-label="Page sections">
  {#each tabs as t (t.id)}
    {@const Icon = t.icon}
    <button
      type="button"
      id="maintab-{t.id}"
      aria-current={active === t.id ? 'true' : undefined}
      class:active={active === t.id}
      onclick={() => onselect(t.id)}
    >
      <Icon size={16} aria-hidden="true" />
      <span class="label">
        {t.label}
        {#if t.shortLabel}<span class="short">{t.shortLabel}</span>{/if}
      </span>
      {#if t.alert}
        <span class="dot" aria-label="Something is waiting here"></span>
      {/if}
    </button>
  {/each}
</nav>

<style>
  /* Stickiness lives on App's .tabbar wrapper, which owns the measurement that
     feeds --scroll-offset. This is just the bar itself. */
  .main-tabs {
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
    padding: var(--space-2) var(--space-1) 0;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
  }
  .main-tabs button {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 7px 2px 8px;
    margin-bottom: -1px;
    background: none;
    border: 0;
    border-bottom: 2px solid transparent;
    font-family: var(--font-display);
    font-size: 18px;
    color: var(--text-muted);
    cursor: pointer;
    transition:
      color var(--transition),
      border-color var(--transition);
  }
  .main-tabs button:hover {
    color: var(--text);
  }
  .main-tabs button.active {
    color: var(--text);
    border-bottom-color: var(--accent);
  }
  .main-tabs button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  /* The settlement tab's title grows with the tier ("Lvl 6 Small Town"), so the
     short form takes over on narrow screens to keep all three tabs on one line. */
  .short {
    display: none;
  }

  /* Affordable-upgrade dot, same gold as the left rail's. */
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: var(--gold);
    flex-shrink: 0;
  }

  @media (max-width: 560px) {
    .main-tabs {
      gap: var(--space-2);
    }
    .main-tabs button {
      font-size: 16px;
    }
    /* Swap the long label for the short one where one was supplied. */
    .label:has(.short) {
      font-size: 0;
    }
    .short {
      display: inline;
      font-size: 16px;
    }
  }
</style>

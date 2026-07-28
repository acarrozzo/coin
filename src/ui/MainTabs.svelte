<script lang="ts">
  /**
   * The app's content tab bar: the settlement, each major structure, the
   * Market and Prestige.
   *
   * These really are tabs — only the selected one's panels are mounted — so the
   * markup is a proper `tablist` with `aria-selected`, and the arrow keys walk
   * it. Each tab can show an alert dot when something is waiting behind it,
   * carrying the left rail's severity language (gold = an affordable upgrade,
   * amber = an under-supplied threat track). With the content hidden that dot
   * is the only signal a tab has something to do.
   *
   * Purely presentational — App owns which tabs exist and what they carry, so a
   * tab appears here only once its content does. Deliberately no numbers: a
   * count beside "Market" reads as a coin balance.
   */
  import type { TabDef, TabId } from './sections';

  interface Props {
    tabs: TabDef[];
    active: TabId;
    onselect: (tab: TabId) => void;
  }

  const { tabs, active, onselect }: Props = $props();

  let bar = $state<HTMLElement | null>(null);

  // The bar scrolls sideways on narrow screens, so the selected tab has to be
  // pulled into view — it can otherwise sit off the edge after a tab unlocks or
  // after arrow-key navigation.
  $effect(() => {
    const el = bar?.querySelector<HTMLElement>(`#maintab-${active}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  });

  /** Left/right (and Home/End) move between tabs, as a tablist should. */
  function onkeydown(e: KeyboardEvent) {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    let next = -1;
    if (delta !== 0) {
      const i = tabs.findIndex((t) => t.id === active);
      next = (i + delta + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      next = 0;
    } else if (e.key === 'End') {
      next = tabs.length - 1;
    }
    if (next < 0) return;
    e.preventDefault();
    onselect(tabs[next].id);
    bar?.querySelector<HTMLElement>(`#maintab-${tabs[next].id}`)?.focus();
  }
</script>

<div
  class="main-tabs"
  role="tablist"
  aria-label="Page sections"
  bind:this={bar}
  {onkeydown}
  tabindex="-1"
>
  {#each tabs as t (t.id)}
    {@const Icon = t.icon}
    <button
      type="button"
      role="tab"
      id="maintab-{t.id}"
      aria-selected={active === t.id}
      tabindex={active === t.id ? 0 : -1}
      class:active={active === t.id}
      onclick={() => onselect(t.id)}
    >
      <Icon size={16} aria-hidden="true" />
      <span class="label">
        {t.label}
        {#if t.shortLabel}<span class="short">{t.shortLabel}</span>{/if}
      </span>
      {#if t.alert}
        <span
          class="dot"
          class:warn={t.alert === 'warn'}
          class:bad={t.alert === 'bad'}
          aria-label="Something is waiting here"
        ></span>
      {/if}
    </button>
  {/each}
</div>

<style>
  /* Stickiness lives on App's .tabbar wrapper, which owns the measurement that
     feeds --scroll-offset. This is just the bar itself.

     One row, always: with nine tabs, wrapping would eat several lines of the
     viewport on a phone, so the bar scrolls sideways instead. */
  .main-tabs {
    display: flex;
    gap: var(--space-3);
    flex-wrap: nowrap;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
    padding: var(--space-2) var(--space-1) 0;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
  }
  .main-tabs::-webkit-scrollbar {
    display: none;
  }
  .main-tabs:focus {
    outline: none;
  }
  .main-tabs button {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    flex: 0 0 auto;
    white-space: nowrap;
    scroll-margin-inline: var(--space-4);
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

  /* Long structure names swap to a short form on narrow screens, so more of the
     bar fits before it has to be scrolled. */
  .short {
    display: none;
  }

  /* Affordable-upgrade dot, same language as the left rail's. */
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: var(--gold);
    flex-shrink: 0;
  }
  .dot.warn {
    background: var(--warn);
  }
  .dot.bad {
    background: var(--bad);
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

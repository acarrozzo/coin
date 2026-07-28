<script lang="ts">
  /**
   * The app's content tab bar: the settlement, each major structure, the
   * Market and Prestige.
   *
   * These are NOT tabs in the ARIA sense — every tab's content is mounted at
   * once in one long scroll, and clicking one scrolls to that region rather
   * than swapping what's rendered. So this is a `navigation` landmark marking
   * the current region with `aria-current`, exactly like the left jump rail;
   * calling it a `tablist` would promise a show/hide that doesn't happen.
   *
   * `active` follows the scroll position (App's scroll-spy owns it), so the
   * highlight tracks where you are whether you got there by clicking or by
   * scrolling.
   *
   * Each tab can show an alert dot when something is waiting in its region,
   * carrying the left rail's severity language (gold = an affordable upgrade,
   * amber = an under-supplied threat track). The content is reachable by
   * scrolling now, so the dot is no longer the *only* signal — it's a locator,
   * telling you how far to travel to find the thing that needs you.
   *
   * Purely presentational — App owns which tabs exist and what they carry, so a
   * tab appears here only once its content does. Deliberately no numbers: a
   * count beside "Market" reads as a coin balance.
   */
  import type { TabDef, TabId, TabAlert } from './sections';
  import AlertFlyout from './AlertFlyout.svelte';

  interface Props {
    tabs: TabDef[];
    active: TabId;
    onselect: (tab: TabId) => void;
  }

  const { tabs, active, onselect }: Props = $props();

  let bar = $state<HTMLElement | null>(null);

  // The bar scrolls sideways on narrow screens, so the current tab has to be
  // pulled into view — it can otherwise sit off the edge. This matters more now
  // than it did when the bar only moved on click: plain scrolling walks the
  // highlight along the bar, and on a phone the highlighted tab is frequently
  // one that's off-screen.
  $effect(() => {
    const el = bar?.querySelector<HTMLElement>(`#maintab-${active}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  });

  /**
   * Hover/focus flyout listing what's waiting behind a tab. Held here rather
   * than in App because the bar owns its own anchors — and it's fixed-positioned
   * (see AlertFlyout) so the bar's horizontal scroll can't clip it.
   */
  let tip = $state<{ alerts: TabAlert[]; x: number; y: number } | null>(null);

  function showTip(e: Event, alerts: TabAlert[]) {
    if (alerts.length === 0) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    // Grows downward from the tab's bottom edge, centred on it — the bar is
    // sticky at the top of the page, so there is never room above it.
    tip = { alerts, x: r.left + r.width / 2, y: r.bottom + 8 };
  }
  function hideTip() {
    tip = null;
  }

  /**
   * What a screen reader hears from the dot. The flyout is aria-hidden, so this
   * is the only spoken form of the alerts — it has to carry the whole list.
   */
  function alertSummary(alerts: TabAlert[]): string {
    const what = alerts.map((a) => `${a.label}, ${a.reason}`).join('; ');
    return alerts.length === 1
      ? `1 needs attention: ${what}`
      : `${alerts.length} need attention: ${what}`;
  }

  /**
   * Left/right (and Home/End) walk the bar. Not required of a nav landmark the
   * way it is of a tablist, but the bar scrolls sideways and is a single
   * horizontal run of controls, so arrow keys are the natural way through it.
   *
   * Movement is relative to the FOCUSED button, not to `active`. Under the old
   * tablist those were the same thing — roving tabindex meant only the selected
   * tab could hold focus. Now every button is tabbable (they're plain links to
   * regions), and `active` follows the scroll, so pressing Right on a button
   * you tabbed to would otherwise jump you somewhere else entirely.
   */
  function onkeydown(e: KeyboardEvent) {
    const from = tabs.findIndex((t) => `maintab-${t.id}` === (e.currentTarget as HTMLElement).id);
    if (from < 0) return;
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    let next = -1;
    if (delta !== 0) {
      next = (from + delta + tabs.length) % tabs.length;
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

<!-- The arrow-key handler sits on the buttons, not the <nav>: a landmark isn't
     an interactive element, and the buttons are what actually hold focus. -->
<nav class="main-tabs" aria-label="Page sections" bind:this={bar}>
  {#each tabs as t (t.id)}
    {@const Icon = t.icon}
    <button
      type="button"
      id="maintab-{t.id}"
      aria-current={active === t.id ? 'true' : undefined}
      class:active={active === t.id}
      onclick={() => onselect(t.id)}
      {onkeydown}
      onmouseenter={(e) => showTip(e, t.alerts ?? [])}
      onmouseleave={hideTip}
      onfocus={(e) => showTip(e, t.alerts ?? [])}
      onblur={hideTip}
    >
      <Icon size={16} aria-hidden="true" />
      <span class="label">
        {t.label}
        {#if t.shortLabel}<span class="short">{t.shortLabel}</span>{/if}
      </span>
      <!-- Colour from the worst thing waiting, count from how many there are.
           A dot reading "1" would be noise, so the number appears from two up. -->
      {#if t.alerts && t.alerts.length > 0}
        {@const worst = t.alerts[0].severity}
        <span
          class="dot"
          class:warn={worst === 'warn'}
          class:bad={worst === 'bad'}
          class:counted={t.alerts.length > 1}
          role="img"
          aria-label={alertSummary(t.alerts)}>{t.alerts.length > 1 ? t.alerts.length : ''}</span
        >
      {/if}
    </button>
  {/each}
</nav>

{#if tip}
  <AlertFlyout alerts={tip.alerts} x={tip.x} y={tip.y} side="right" />
{/if}

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

  /* Affordable-upgrade dot, same language as the left rail's — green for
     opportunity, amber to top up, red for structural. Grows into a small
     numbered badge when a tab has more than one thing waiting. */
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: var(--good);
    flex-shrink: 0;
  }
  .dot.counted {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: auto;
    min-width: 14px;
    height: 14px;
    padding: 0 3px;
    box-sizing: border-box;
    font-family: var(--font-body);
    font-size: 10px;
    font-weight: 700;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    /* Dark ink on every severity colour — all three are light enough that the
       theme's own --text would vanish on them in dark mode. */
    color: #1a1a1a;
  }
  .dot.warn {
    background: var(--warn);
  }
  /* The severest tier pulses as well as reddens, so it survives palettes where
     hue alone can't separate it (see the rail's matching note). */
  .dot.bad {
    background: var(--bad);
    animation: alertPulse 1.8s ease-in-out infinite;
  }
  @keyframes alertPulse {
    0%,
    100% {
      box-shadow: 0 0 0 0 color-mix(in srgb, var(--bad) 70%, transparent);
    }
    55% {
      box-shadow: 0 0 0 5px transparent;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .dot.bad {
      animation: none;
    }
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

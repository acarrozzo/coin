<script lang="ts">
  import type { Component } from 'svelte';
  import { onMount } from 'svelte';
  import { game } from './ui/gameStore.svelte';
  import { sound } from './ui/sound.svelte';
  import {
    getAvailableWorkers,
    getTotalWorkers,
    getCapacity,
    hasMarketOpportunity,
  } from './engine/selectors';
  import { RESOURCES, type ResourceId } from './content/resources';
  import { formatNumber } from './engine/numbers';
  import SettlementPanel from './ui/SettlementPanel.svelte';
  import CombatPanel from './ui/CombatPanel.svelte';
  import ResourcePanel from './ui/ResourcePanel.svelte';
  import SettingsPanel from './ui/SettingsPanel.svelte';
  import MarketPanel from './ui/MarketPanel.svelte';
  import WelcomeBack from './ui/WelcomeBack.svelte';
  import MainTabs, { type MainTab, type TabDef } from './ui/MainTabs.svelte';
  import Toasts from './ui/Toasts.svelte';
  import {
    getNavSections,
    isMarketUnlocked,
    isQuestsUnlocked,
    hasQuestsOpportunity,
  } from './ui/sections';
  import { getTier } from './content/settlement';
  import Castle from '@lucide/svelte/icons/castle';
  import House from '@lucide/svelte/icons/house';
  import ScrollText from '@lucide/svelte/icons/scroll-text';
  import BuildingStore from './ui/icons/BuildingStore.svelte';
  import Settings from '@lucide/svelte/icons/settings';
  import User from '@lucide/svelte/icons/user';
  import Check from '@lucide/svelte/icons/check';
  import TreePine from '@lucide/svelte/icons/tree-pine';
  import Mountain from '@lucide/svelte/icons/mountain';
  import Wheat from '@lucide/svelte/icons/wheat';

  // The three capped "core" resources, mirrored as at-a-glance storage gauges
  // in the sticky header.
  const CORE_STORES: { id: ResourceId; icon: Component }[] = [
    { id: 'wood', icon: TreePine },
    { id: 'stone', icon: Mountain },
    { id: 'food', icon: Wheat },
  ];

  let leveled = $state(false);
  // Settings opens as an overlay drawer from the header gear (all widths).
  let settingsOpen = $state(false);
  // Measured so the settings drawer and rails can park just below the header,
  // whose height shifts with the chosen font/layout.
  let headerH = $state(0);
  // The zone bar is sticky under the header, so everything that scrolls to the
  // top has to clear both. Measured rather than assumed — it wraps to two rows
  // on narrow screens, and the settlement tab's label grows with the tier.
  let tabsH = $state(0);
  /**
   * Extra breathing room above a jumped-to section, so it doesn't butt right up
   * against the sticky chrome and you can still see a sliver of what's above it.
   */
  const SCROLL_PEEK = 22;

  const gs = $derived(game.state);
  // The Market (coin economy) unlocks at settlement level 1. Until then there's
  // only one tab, so the whole bar stays hidden rather than showing a lone tab.
  const showMarket = $derived(isMarketUnlocked(gs));

  const showQuests = $derived(isQuestsUnlocked(gs));
  const questsAlert = $derived(hasQuestsOpportunity(gs));

  // The first tab wears the settlement's own title, e.g. "Lvl 6 Small Town".
  const settlementTitle = $derived(getTier(gs.level)?.name ?? 'Settlement');

  // Each tab appears only once its content exists, so the bar grows 1 → 2 → 3
  // as the game opens up. A single tab is no tab bar at all.
  const tabs = $derived.by(() => {
    const list: TabDef[] = [
      {
        id: 'settlement',
        label: `Lvl ${gs.level} ${settlementTitle}`,
        shortLabel: settlementTitle,
        icon: House,
      },
    ];
    if (showQuests) {
      list.push({
        id: 'quests',
        label: 'Quests',
        icon: ScrollText,
        alert: questsAlert,
      });
    }
    if (showMarket) {
      list.push({
        id: 'market',
        label: 'Market',
        icon: BuildingStore,
        alert: hasMarketOpportunity(gs),
      });
    }
    return list;
  });

  // Which zone is currently under the header line. The whole page is one scroll,
  // so the zone bar reflects where you are rather than choosing what renders.
  let activeZone = $state<MainTab>('settlement');

  // Left-rail jump targets: one per visible main-content section, each with a
  // worker count and an opportunity/danger indicator.
  const navSections = $derived(getNavSections(gs));
  // Which section is currently scrolled into view (highlighted in the rail).
  let activeSection = $state<string | null>(null);

  // Immediate hover/focus label for the icon rails. Positioned with `fixed` so
  // it escapes the left rail's scroll clipping and never triggers layout shift.
  let tip = $state<{ text: string; x: number; y: number; side: 'left' | 'right' } | null>(null);
  function showTip(e: Event, text: string, side: 'left' | 'right') {
    const el = e.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    tip = {
      text,
      x: side === 'right' ? r.right + 8 : r.left - 8,
      y: r.top + r.height / 2,
      side,
    };
  }
  function hideTip() {
    tip = null;
  }

  /** Scroll a zone to just under the sticky header, like the rail's jumps. */
  function jumpToZone(zone: MainTab) {
    const el = document.querySelector<HTMLElement>(`[data-zone="${zone}"]`);
    if (!el) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }

  function jumpTo(id: string) {
    const el = document.querySelector<HTMLElement>(`[data-nav="${id}"]`);
    if (!el) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });

    flash(el);
  }

  // Ring state: the class holds it lit; dropping the class fades it out via the
  // CSS transition, so the timer only covers fade-in + hold.
  const FLASH_HOLD_MS = 1080;
  let flashTimer = 0;
  let flashEl: HTMLElement | null = null;

  /**
   * Light the accent ring on a jumped-to section, concurrently with the scroll,
   * so it's already glowing as the section slides into view rather than
   * snapping on after it lands.
   */
  function flash(el: HTMLElement) {
    // Cancel any ring still lit elsewhere, so two quick jumps don't leave one on.
    if (flashTimer) {
      clearTimeout(flashTimer);
      flashEl?.classList.remove('nav-flash');
    }
    flashEl = el;
    // Re-adding the class in the same frame wouldn't restart the transition, so
    // force a style flush between removing and re-adding for repeat jumps.
    el.classList.remove('nav-flash');
    void el.offsetWidth;
    el.classList.add('nav-flash');
    flashTimer = window.setTimeout(() => {
      el.classList.remove('nav-flash');
      flashTimer = 0;
    }, FLASH_HOLD_MS);
  }
  const available = $derived(getAvailableWorkers(gs));
  const total = $derived(getTotalWorkers(gs));
  // Busy workers (total minus idle).
  const working = $derived(Math.max(0, total - available));

  // Quips for the idle-worker alert. {n} = idle count, {s} = "" or "s".
  const IDLE_QUIPS = [
    'Twiddling {n} set{s} of thumbs. Give them a job!',
    '{n} villager{s} loafing about the square.',
    '{n} idle hand{s} — the devil’s workshop, you know.',
    '{n} worker{s} awaiting your royal command.',
    '{n} pair{s} of boots collecting dust. Put them to work!',
    'The tavern is suspiciously full: {n} slacker{s}.',
    '{n} mouth{s} to feed, zero work being done.',
    'Somewhere, {n} worker{s} pretend{p} to look busy.',
  ];
  // Praise for when every worker is busy. {n} = total workers.
  const DONE_QUIPS = [
    'Every last worker is busy. A well-run realm!',
    'Not an idle hand in sight. Bravo, sire!',
    'All {n} hard at work. The kingdom hums along.',
    'Full employment! The crown smiles upon you.',
    'Nobody’s slacking. Your subjects adore you.',
    'A productive settlement is a happy settlement.',
    'All hands on deck. Nothing to fret about here.',
  ];
  // Re-roll whenever the worker counts change, so a fresh line greets each nudge.
  const workerQuip = $derived.by(() => {
    if (total <= 0) return '';
    if (available <= 0) {
      return DONE_QUIPS[Math.floor(Math.random() * DONE_QUIPS.length)].replaceAll(
        '{n}',
        formatNumber(total),
      );
    }
    const plural = available === 1;
    return IDLE_QUIPS[Math.floor(Math.random() * IDLE_QUIPS.length)]
      .replaceAll('{n}', formatNumber(available))
      .replaceAll('{s}', plural ? '' : 's')
      .replaceAll('{p}', plural ? 's' : '');
  });

  const stores = $derived(
    CORE_STORES.flatMap((s) => {
      // Gated on the settlement tier granting storage, not on the producing
      // structure being built: food is gathered from settlement level 1 (cap 3),
      // well before the Farm exists, and the gauge should be there for it.
      const cap = getCapacity(gs, s.id);
      if (!cap || cap.lte(0)) return [];
      const amount = gs.resources[s.id].amount;
      const pct = cap.gt(0) ? Math.min(100, amount.div(cap).toNumber() * 100) : 0;
      return [{ ...s, amount, cap, pct }];
    }),
  );

  onMount(() => {
    sound.load();

    game.start();
    return () => game.stop();
  });

  // Scroll-spy: light up the rail button for whichever section sits just below
  // the sticky header. Reads the DOM fresh each pass so it adapts as sections
  // unlock, and throttles to one recompute per animation frame.
  onMount(() => {
    let raf = 0;
    const recompute = () => {
      raf = 0;
      const line = headerH + tabsH + SCROLL_PEEK + 4;
      const els = Array.from(document.querySelectorAll<HTMLElement>('[data-nav]'));
      let current = els[0]?.dataset.nav ?? null;
      for (const el of els) {
        if (el.getBoundingClientRect().top - line <= 1) current = el.dataset.nav ?? current;
      }
      activeSection = current;

      // Same pass, coarser grain: which of the three zones is under the line.
      const zones = Array.from(document.querySelectorAll<HTMLElement>('[data-zone]'));
      let zone = (zones[0]?.dataset.zone as MainTab | undefined) ?? 'settlement';
      for (const el of zones) {
        if (el.getBoundingClientRect().top - line <= 1) {
          zone = (el.dataset.zone as MainTab | undefined) ?? zone;
        }
      }
      activeZone = zone;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(recompute);
    };
    recompute();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  });

  // Briefly flourish the level badge whenever the settlement levels up.
  let prevLevel = -1;
  $effect(() => {
    const level = gs.level;
    if (prevLevel !== -1 && level !== prevLevel) {
      leveled = true;
      setTimeout(() => (leveled = false), 800);
    }
    prevLevel = level;
  });
</script>

<div class="topstack" bind:clientHeight={headerH}>
  <header>
    <div class="header-inner">
      <h1>
        <Castle size={18} color="var(--gold)" aria-hidden="true" />
        <span class="wordmark">Coin &amp; Castle</span>
        <span class="stat level-badge" class:leveled title="Settlement level">Lv {gs.level}</span>
      </h1>

      {#if gs.workers.trained >= 1 && stores.length > 0}
        <div class="stores">
          {#each stores as s (s.id)}
            {@const Icon = s.icon}
            <div
              class="store"
              title="{RESOURCES[s.id].name}: {formatNumber(s.amount)} / {formatNumber(s.cap)}"
            >
              <Icon size={14} color="var(--gold)" aria-hidden="true" />
              <span class="store-num"
                >{formatNumber(s.amount)}<span class="store-cap">/{formatNumber(s.cap)}</span></span
              >
              <span class="store-bar"><span class="store-fill" style:width="{s.pct}%"></span></span>
            </div>
          {/each}
        </div>
      {/if}

      <div class="hud">
        <span class="stat worker-stat" title="Working / total workers">
          {#if total > 0}
            <span
              class="worker-badge"
              class:idle={available > 0}
              class:done={available === 0}
              role="status"
              aria-label={available > 0
                ? `${available} idle worker${available === 1 ? '' : 's'}`
                : 'All workers assigned'}
            >
              {#if available > 0}
                {formatNumber(available)}
              {:else}
                <Check size={12} strokeWidth={3.5} aria-hidden="true" />
              {/if}
              <span class="idle-flyout" role="tooltip">
                <strong>
                  {#if available > 0}
                    {available} worker{available === 1 ? '' : 's'} standing around
                  {:else}
                    All workers assigned
                  {/if}
                </strong>
                <span class="idle-quip">{workerQuip}</span>
              </span>
            </span>
          {/if}
          <User class="worker-icon" size={16} color="var(--gold)" aria-hidden="true" />
          {working}<span class="worker-total">/{total}</span>
        </span>
        <button
          class="gear"
          class:active={settingsOpen}
          onclick={() => (settingsOpen = !settingsOpen)}
          aria-pressed={settingsOpen}
          aria-label="Settings"
          title="Settings"
        >
          <Settings size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  </header>
</div>

<div
  class="layout"
  style="--header-h: {headerH}px; --scroll-offset: {headerH + tabsH + SCROLL_PEEK}px"
>
  <!-- Left jump rail: one button per visible section. Clicking scrolls to it;
       a dot flags an affordable upgrade (gold) or an under-supplied threat
       track (amber), and a
       badge shows the workers assigned there. On mobile it floats at the left
       edge, mirroring the panel rail on the right. -->
  {#if gs.workers.trained >= 1}
    <nav class="jump-rail" aria-label="Jump to section">
      {#each navSections as s, i (s.id)}
        {@const Icon = s.icon}
        {#if i > 0 && navSections[i - 1].zone !== s.zone}
          <span class="rail-divider" aria-hidden="true"></span>
        {/if}
        <button
          class="jump-btn"
          class:active={activeSection === s.id}
          onclick={() => jumpTo(s.id)}
          aria-label={s.label}
          aria-current={activeSection === s.id ? 'true' : undefined}
          onmouseenter={(e) => showTip(e, s.label, 'right')}
          onmouseleave={hideTip}
          onfocus={(e) => showTip(e, s.label, 'right')}
          onblur={hideTip}
        >
          <Icon size={20} aria-hidden="true" />
          {#if s.alert}
            <span
              class="dot"
              class:warn={s.alert === 'warn'}
              class:bad={s.alert === 'bad'}
              aria-hidden="true"
            ></span>
          {/if}
          {#if s.count > 0}
            <span class="count-badge" aria-hidden="true">{s.count}</span>
          {/if}
        </button>
      {/each}
    </nav>
  {/if}

  <div class="app">
    <main>
      <WelcomeBack />

      <!-- Zone bar. Sticky, and it jumps rather than switches: everything below
           stays on the page and remains reachable by scrolling. Hidden until
           there's more than one zone to move between. -->
      {#if tabs.length > 1}
        <div class="tabbar" bind:clientHeight={tabsH}>
          <MainTabs {tabs} active={activeZone} onselect={jumpToZone} />
        </div>
      {/if}

      <div class="zone" data-zone="settlement">
        <SettlementPanel />
        <CombatPanel />
        <ResourcePanel />
      </div>

      {#if showQuests}
        <div class="zone" data-zone="quests">
          <ResourcePanel scope="quests" />
        </div>
      {/if}

      {#if showMarket}
        <div class="zone" data-zone="market">
          <MarketPanel />
        </div>
      {/if}

      <!-- Breathing room so the last (possibly short) section can scroll up to
           the header line, triggering its active state in the rail and bar. -->
      <div class="tail-space" aria-hidden="true"></div>
    </main>

    <footer>
      <span>v{__APP_VERSION__}</span>
      <span class="tag">Coin &amp; Castle</span>
    </footer>
  </div>

  {#if settingsOpen}
    <SettingsPanel onclose={() => (settingsOpen = false)} />
  {/if}

  {#if tip}
    <span class="rail-flyout {tip.side}" role="tooltip" style="left: {tip.x}px; top: {tip.y}px"
      >{tip.text}</span
    >
  {/if}
</div>

<Toasts />

<style>
  /* Row wrapper: main content, then the icon rail, then a side panel pushed in
     as a right-hand column when one is open. Centered as a group. */
  .layout {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    gap: var(--space-4);
    padding: 0 var(--space-4);
  }
  .app {
    flex: 1 1 var(--content-width);
    max-width: var(--content-width);
    min-width: 0;
    padding-bottom: var(--space-5);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  /* Settings opens as a fixed overlay drawer at all widths (see SettingsPanel),
     so it sits outside the flex row rather than as a column. */

  /* --- Left jump rail: navigate to main-content sections --- */
  .jump-rail {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    position: sticky;
    top: calc(var(--header-h, 56px) + var(--space-4));
    margin-top: var(--space-4);
    /* Never grow past the viewport if many sections have unlocked. */
    max-height: calc(100vh - var(--header-h, 56px) - var(--space-4));
    overflow-y: auto;
    scrollbar-width: none;
  }
  .jump-rail::-webkit-scrollbar {
    display: none;
  }
  .jump-btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 44px;
    height: 44px;
    background: var(--bg-panel);
    border: var(--panel-border);
    border-radius: var(--panel-radius);
    box-shadow: var(--panel-shadow);
    color: var(--text-muted);
    cursor: pointer;
    transition:
      color var(--transition),
      background var(--transition),
      border-color var(--transition);
  }
  .jump-btn:hover {
    color: var(--text);
    border-color: var(--accent);
  }
  .jump-btn.active {
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 16%, var(--bg-panel));
    border-color: var(--accent);
  }
  .jump-btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
  /* Instant hover/focus label for both icon rails. Fixed-positioned (see
     showTip) so it clears the left rail's scroll clipping; JS supplies the
     left/top of the anchoring edge and the side class picks which way it grows
     and vertically centers it against the button. */
  .rail-flyout {
    position: fixed;
    z-index: 50;
    width: max-content;
    padding: 5px 9px;
    background: var(--bg-panel, #fff);
    color: var(--text, inherit);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
    font-size: 12px;
    font-weight: 600;
    line-height: 1;
    white-space: nowrap;
    pointer-events: none;
  }
  .rail-flyout.right {
    transform: translateY(-50%);
  }
  .rail-flyout.left {
    transform: translate(-100%, -50%);
  }
  /* Opportunity/danger dot, tucked into the tile's top-right corner (inside the
     bounds so the scroll container never clips it). */
  .dot {
    position: absolute;
    top: 3px;
    right: 3px;
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: var(--gold);
    box-shadow: 0 0 0 2px var(--bg-panel);
  }
  .dot.warn {
    background: var(--warn);
  }
  .dot.bad {
    background: var(--bad);
  }
  /* Worker count: just the number, tucked in the icon's bottom-left corner. */
  .count-badge {
    position: absolute;
    bottom: 2px;
    left: 4px;
    font-size: 10px;
    font-weight: 700;
    line-height: 1;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
    pointer-events: none;
  }
  .jump-btn.active .count-badge {
    color: var(--accent);
  }

  /* Sections land clear of the sticky header AND the sticky zone bar when
     jumped to, plus a little peek at whatever sits above them. */
  :global([data-nav]) {
    scroll-margin-top: var(--scroll-offset, 96px);
  }
  /* Subtle accent ring shown when a section is jumped to. Uses outline (not
     box-shadow) so it never disturbs the panels' own drop shadow.
     
     Deliberately a TRANSITION rather than a keyframe animation. Three of the
     four [data-nav] elements are panels already running `animation: fadeIn`, on
     the very same element — a keyframe animation here would override that
     shorthand while the ring showed, then hand it back when the class was
     removed, which the browser treats as a brand-new animation and replays.
     That re-ran each panel's fade-in from opacity 0 the instant the ring
     finished: the flicker. A transition touches `animation` not at all. */
  :global([data-nav]) {
    outline: 2px solid transparent;
    outline-offset: 3px;
    /* Fade OUT — applies when .nav-flash is removed. */
    transition: outline-color 1.32s ease-in-out;
  }
  :global([data-nav].nav-flash) {
    outline-color: color-mix(in srgb, var(--accent) 75%, transparent);
    /* Fade IN — quicker than the fade out, as before. */
    transition-duration: 0.72s;
  }
  @media (prefers-reduced-motion: reduce) {
    :global([data-nav]),
    :global([data-nav].nav-flash) {
      transition: none;
    }
  }

  /* Explorer bar + game header stick together as one unit. */
  .topstack {
    position: sticky;
    top: 0;
    z-index: 5;
  }
  header {
    background: var(--bg-header);
    border-bottom: var(--header-border);
  }
  .header-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
    padding: var(--header-pad-y) var(--space-4);
  }
  header h1 {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-size: 20px;
    color: var(--text-on-header);
  }

  /* At-a-glance core storage gauges. */
  .stores {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    flex-wrap: wrap;
  }
  .store {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--text-on-header);
    font-variant-numeric: tabular-nums;
  }
  .store-num {
    font-size: 14px;
  }
  .store-cap {
    color: var(--text-muted);
  }
  .store-bar {
    display: block;
    width: 52px;
    height: 6px;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 999px;
    overflow: hidden;
  }
  .store-fill {
    display: block;
    height: 100%;
    background: var(--gold);
    border-radius: 999px;
    transition: width 0.2s linear;
  }
  .hud {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  /* Settings toggle, living in the header now that the right rail is gone. */
  .gear {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: rgba(255, 255, 255, 0.12);
    border: 1px solid transparent;
    border-radius: var(--radius);
    color: var(--text-on-header);
    cursor: pointer;
    transition:
      color var(--transition),
      background var(--transition),
      border-color var(--transition);
  }
  .gear:hover {
    color: var(--gold);
    background: rgba(255, 255, 255, 0.2);
  }
  .gear.active {
    color: var(--gold);
    border-color: var(--gold);
  }
  .gear:focus-visible {
    outline: 2px solid var(--gold);
    outline-offset: 1px;
  }
  .stat {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--text-on-header);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    border-radius: var(--radius);
    padding: 2px 6px;
    transition: color 0.2s;
  }
  .stat.leveled {
    color: var(--gold);
    animation: levelPulse 0.8s ease;
  }
  /* Level badge sitting beside the logo text. */
  .level-badge {
    font-size: 13px;
    font-weight: 700;
    background: rgba(255, 255, 255, 0.12);
    color: var(--gold);
  }

  /* Positioning context for the worker-status badge's flyout. */
  .worker-stat {
    position: relative;
  }
  /* Status circle to the left of the worker count: red count when idle,
     green check when everyone is assigned. */
  .worker-badge {
    min-width: 18px;
    height: 18px;
    padding: 0 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
    border-radius: 999px;
    box-shadow: 0 0 0 2px var(--bg-header);
    cursor: default;
  }
  .worker-badge.idle {
    background: transparent;
    color: var(--bad);
    border: 1px solid var(--bad);
    animation: idlePulse 2s ease-in-out infinite;
  }
  .worker-badge.done {
    width: 18px;
    padding: 0;
    background: transparent;
    color: var(--good, #16a34a);
    border: 1px solid var(--good, #16a34a);
  }
  @keyframes idlePulse {
    0%,
    100% {
      border-color: var(--bad);
      box-shadow:
        0 0 0 2px var(--bg-header),
        0 0 0 0 color-mix(in srgb, var(--bad) 60%, transparent);
    }
    50% {
      border-color: color-mix(in srgb, var(--bad) 35%, transparent);
      box-shadow:
        0 0 0 2px var(--bg-header),
        0 0 0 5px transparent;
    }
  }
  /* Hover flyout with the count + a quip. */
  .idle-flyout {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: 10;
    width: max-content;
    max-width: 220px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 10px;
    background: var(--bg-panel, #fff);
    color: var(--text, inherit);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
    font-size: 12px;
    font-weight: 400;
    text-align: left;
    white-space: normal;
    opacity: 0;
    transform: translateY(-4px);
    pointer-events: none;
    transition:
      opacity 0.15s ease,
      transform 0.15s ease;
  }
  .worker-badge:hover .idle-flyout,
  .worker-badge:focus-visible .idle-flyout {
    opacity: 1;
    transform: translateY(0);
  }
  .idle-flyout strong {
    font-size: 12px;
  }
  .worker-badge.idle .idle-flyout strong {
    color: var(--bad);
  }
  .worker-badge.done .idle-flyout strong {
    color: var(--good, #16a34a);
  }
  .idle-quip {
    color: var(--text-muted);
  }
  @keyframes levelPulse {
    0% {
      transform: scale(1);
      box-shadow: 0 0 0 0 color-mix(in srgb, var(--gold) 60%, transparent);
    }
    30% {
      transform: scale(1.18);
    }
    100% {
      transform: scale(1);
      box-shadow: 0 0 0 12px transparent;
    }
  }
  main {
    flex: 1;
    padding-top: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--panel-gap);
  }
  /* Pins the zone bar directly under the sticky header. Owned here rather than
     inside MainTabs so its height can be measured for --scroll-offset. */
  .tabbar {
    position: sticky;
    top: var(--header-h, 0px);
    z-index: 20;
    background: var(--bg);
  }

  /* A page zone (settlement / quests / market). Stacks its panels with the same
     rhythm `main` uses, so zones read as one continuous column. */
  .zone {
    display: flex;
    flex-direction: column;
    gap: var(--panel-gap);
    scroll-margin-block-start: var(--scroll-offset, 96px);
  }
  /* Separates one zone's rail buttons from the next. */
  .rail-divider {
    flex: 0 0 auto;
    align-self: center;
    width: 24px;
    height: 1px;
    margin: var(--space-1) 0;
    background: var(--border);
  }

  /* Roughly one viewport of slack, so even a single-row final section can be
     scrolled to the top of the page. */
  .tail-space {
    flex: none;
    min-height: calc(100dvh - var(--header-h, 56px) - var(--space-5) - 200px);
  }

  footer {
    margin-top: var(--space-5);
    padding-top: var(--space-3);
    border-top: 1px solid var(--border);
    color: var(--text-muted);
    font-size: 13px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .tag {
    font-family: var(--font-display);
    font-size: 15px;
  }

  /* At the drawer breakpoint the panel detaches into a fixed right-hand drawer.
     The rail floats at the right edge over the content, and slides left to sit
     just beside the drawer whenever one is open. */
  @media (max-width: 1023px) {
    /* The jump rail detaches to fixed and floats over the left edge, so reserve
       a gutter the width of a rail button (44px + its edge offset + a small gap)
       so the content column stays clear of the icons at every width. */
    .layout {
      padding-left: calc(44px + var(--space-2) * 2);
    }
    /* The jump rail floats at the left edge. */
    .jump-rail {
      position: fixed;
      left: var(--space-2);
      top: calc(var(--header-h, 56px) + var(--space-4));
      margin-top: 0;
      z-index: 20;
      max-height: calc(100dvh - var(--header-h, 56px) - var(--space-4));
    }
  }

  /* Tablet and below: the title + worker readout keep the top row to
     themselves, and the storage gauges drop to their own full-width row. This
     kicks in early (900px) so the three gauges never crowd the title on a
     single line. */
  /* Tablet and below: keep everything on one row and collapse the wordmark to
     the castle icon + level badge, freeing width for the gauges, worker readout
     and gear. Desktop (above 900px) is untouched. */
  @media (max-width: 900px) {
    .header-inner {
      flex-wrap: nowrap;
      padding: var(--space-2) var(--space-3);
      gap: var(--space-3);
    }
    header h1 {
      font-size: 20px;
      flex: 0 0 auto;
    }
    .wordmark {
      display: none;
    }
  }

  /* Below 768px: each gauge stacks its bar beneath the icon + amount. The gauge
     is pinned to the original bar width (52px) so the content and bar share that
     width and the whole thing stays narrow. The /cap text is dropped here (it
     wouldn't fit the narrow column — the bar shows fullness). */
  @media (max-width: 767.98px) {
    .store {
      flex-wrap: wrap;
      justify-content: center;
      text-align: center;
      row-gap: 4px;
      min-width: 52px;
    }
    .store-cap {
      display: none;
    }
    .store-bar {
      flex-basis: 100%;
      width: auto;
    }
  }

  /* Phones: tighten gaps and shrink the worker readout so the row still fits on
     one line. */
  @media (max-width: 640px) {
    .header-inner {
      gap: var(--space-2);
    }
    .stores {
      gap: 10px;
    }
    .store-num {
      font-size: 13px;
    }
    .worker-stat {
      font-size: 13px;
      padding: 2px 4px;
    }
    .gear {
      width: 28px;
      height: 28px;
    }
  }

  /* Small mobile: the total is implied, so show just the working count. */
  @media (max-width: 480px) {
    .worker-total {
      display: none;
    }
    :global(.worker-icon) {
      display: none;
    }
  }
</style>

<script lang="ts">
  import type { Component } from 'svelte';
  import { onMount } from 'svelte';
  import { game } from './ui/gameStore.svelte';
  import { sound } from './ui/sound.svelte';
  import { getAvailableWorkers, getTotalWorkers, getCapacity } from './engine/selectors';
  import { type ResourceId } from './content/resources';
  import { formatNumber } from './engine/numbers';
  import SettlementPanel from './ui/SettlementPanel.svelte';
  import ThreatPanel from './ui/ThreatPanel.svelte';
  import ResourcePanel from './ui/ResourcePanel.svelte';
  import SettingsPanel from './ui/SettingsPanel.svelte';
  import MarketPanel from './ui/MarketPanel.svelte';
  import PrestigePanel from './ui/PrestigePanel.svelte';
  import WelcomeBack from './ui/WelcomeBack.svelte';
  import MainTabs from './ui/MainTabs.svelte';
  import AlertFlyout from './ui/AlertFlyout.svelte';
  import StatusDots from './ui/StatusDots.svelte';
  import StoreGauge from './ui/StoreGauge.svelte';
  import Toasts from './ui/Toasts.svelte';
  import {
    getNavSections,
    getTabs,
    firstSectionForTab,
    tabForSection,
    isMarketUnlocked,
    isPrestigeUnlocked,
    tabLabel,
    type TabId,
    type NavSection,
    type TabAlert,
  } from './ui/sections';
  import { nav, jumpToResource } from './ui/nav.svelte';
  import Castle from '@lucide/svelte/icons/castle';
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
  // The tab bar is sticky under the header, so everything that scrolls to the
  // top has to clear both. Measured rather than assumed — its height moves with
  // the chosen font.
  let tabsH = $state(0);
  /**
   * Extra breathing room above a jumped-to section, so it doesn't butt right up
   * against the sticky chrome and you can still see a sliver of what's above it.
   */
  const SCROLL_PEEK = 22;

  const gs = $derived(game.state);

  // Each tab appears only once its content exists, so the bar grows as the game
  // opens up. A single tab is no tab bar at all.
  const tabs = $derived(getTabs(gs));

  /**
   * Which tab region the player is currently scrolled into. An OUTPUT of the
   * scroll-spy below, not a switch — every tab's content is mounted all the
   * time. Kept in `nav` rather than local state so it survives independently of
   * this component.
   *
   * No "tab vanished under the player" fallback is needed any more: a prestige
   * drops the settlement to level 0 and closes every structure region at once,
   * but since nothing was being hidden by selection, the spy simply lands on
   * whatever content is still there.
   */
  const activeTab = $derived(nav.tab);

  // Left-rail jump targets: one per visible section ACROSS THE WHOLE PAGE, each
  // with a worker count and an opportunity/danger indicator. The rail is the
  // fine-grained table of contents; the tab bar is the coarse one.
  const navSections = $derived(getNavSections(gs));
  // Which section is currently scrolled into view (highlighted in the rail).
  let activeSection = $state<string | null>(null);

  /**
   * The rail's buttons, clustered into one run per tab, so a hairline can be
   * drawn between the runs. That turns a flat column of a dozen icons back into
   * the same chapters the tab bar shows — the rail's grouping and the tab bar's
   * are then literally the same partition of the page.
   *
   * Relies on getNavSections being tab-contiguous (the invariant the section
   * order test pins down): a tab whose sections were interleaved with another's
   * would produce two runs here, and draw a divider mid-chapter.
   */
  const railGroups = $derived.by(() => {
    const groups: { tab: TabId; sections: NavSection[] }[] = [];
    for (const s of navSections) {
      const last = groups.at(-1);
      if (last?.tab === s.tab) last.sections.push(s);
      else groups.push({ tab: s.tab, sections: [s] });
    }
    return groups;
  });

  // Immediate hover/focus label for the icon rail, carrying the section's alert
  // when it has one — a rail button is a bare glyph, so the flyout is the only
  // place its dot can say what it means. Fixed-positioned (see AlertFlyout) so
  // it escapes the rail's scroll clipping and never triggers layout shift.
  let tip = $state<{
    text: string;
    alerts: TabAlert[];
    x: number;
    y: number;
    side: 'left' | 'right';
  } | null>(null);
  function showTip(e: Event, s: NavSection, side: 'left' | 'right') {
    const el = e.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    tip = {
      text: s.label,
      // One button is one section, so there is never more than one.
      alerts: s.alert ? [{ id: s.id, label: s.label, ...s.alert }] : [],
      x: side === 'right' ? r.right + 8 : r.left - 8,
      y: r.top + r.height / 2,
      side,
    };
  }
  function hideTip() {
    tip = null;
  }

  /**
   * Tab click → scroll to that tab's region. Nothing is switched: the tab bar
   * is a set of jump targets over one long page, and `nav.tab` catches up on
   * its own once the scroll lands and the spy runs.
   *
   * The first tab scrolls to the very top rather than to an anchor, so it gives
   * you the page header back instead of parking it just under the sticky
   * chrome. It's also the one region with no header of its own to aim at.
   */
  function selectTab(tab: TabId) {
    if (tabs[0]?.id === tab) {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      nav.select(tab);
      return;
    }
    // The section header, so you land on the name of where you are — falling
    // back to the first section for the early game, where the headers are
    // hidden.
    const head = document.querySelector<HTMLElement>(`[data-region="${tab}"]`);
    if (head) {
      scrollToEl(head);
      return;
    }
    const first = firstSectionForTab(gs, tab);
    if (first) jumpTo(first.id);
  }

  function jumpTo(id: string) {
    const el = document.querySelector<HTMLElement>(`[data-nav="${id}"]`);
    if (el) scrollToEl(el);
  }

  /** Scroll an anchor under the sticky chrome and light its ring. */
  function scrollToEl(el: HTMLElement) {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    flash(el);
  }

  /**
   * Header gauge → the resource's own producer row, wherever it sits in the
   * page. The row's card gets the same accent ring a rail jump lights, since
   * the ring is styled on the [data-nav] section, not on the row itself.
   */
  function jumpToStore(id: ResourceId) {
    jumpToResource(id);
    const card = document
      .querySelector<HTMLElement>(`[data-res="${id}"]`)
      ?.closest<HTMLElement>('[data-nav]');
    if (card) flash(card);
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

  // Scroll-spy: light up the rail button — AND the tab — for whichever section
  // sits just below the sticky header. Reads the DOM fresh each pass so it
  // adapts as sections unlock, and throttles to one recompute per animation
  // frame.
  //
  // One pass drives both bars deliberately: the rail button and the tab are two
  // zoom levels on the same answer, so deriving them from a single measurement
  // is what stops them ever disagreeing about where you are.
  /**
   * Ask the spy for a fresh measurement. Assigned by the onMount below; the
   * no-op stands in until then, which the mount's own first pass covers.
   */
  let requestSpy: () => void = () => {};

  onMount(() => {
    let raf = 0;
    const recompute = () => {
      raf = 0;
      const line = headerH + tabsH + SCROLL_PEEK + 4;
      // Section headers are measured alongside sections. They have to be: a
      // header sits ABOVE its region's first section, so scrolling one to the
      // line leaves that section still below it — and a sections-only pass
      // would report the *previous* region right after a tab click landed you
      // here.
      const els = Array.from(document.querySelectorAll<HTMLElement>('[data-nav],[data-region]'));
      let i = 0;
      for (let n = 0; n < els.length; n++) {
        if (els[n].getBoundingClientRect().top - line <= 1) i = n;
      }

      // A header stands in for the first section beneath it, so crossing one
      // moves the rail and the tab bar together rather than one at a time.
      let el: HTMLElement | undefined = els[i];
      let tab: TabId | null = null;
      if (el?.dataset.region) {
        tab = el.dataset.region as TabId;
        el = els.slice(i + 1).find((e) => e.dataset.nav);
      }
      const current = el?.dataset.nav ?? null;

      activeSection = current;
      tab ??= current ? tabForSection(gs, current) : null;
      if (tab) nav.select(tab);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(recompute);
    };
    requestSpy = onScroll;
    recompute();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  });

  /**
   * Re-measure whenever the set of sections changes. Sections appear and vanish
   * without the player scrolling a pixel — a structure unlocks, or a prestige
   * drops the settlement to level 0 and closes most of the page at once — and
   * either way whatever sits under the header line has just changed. Without
   * this the rail and the tab bar would keep pointing at a section that is no
   * longer there until the next scroll event.
   */
  $effect(() => {
    void navSections.length;
    requestSpy();
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

<!-- Big header introducing one tab's region of the page. Rendered only for tabs
     that actually have content (getTabs already drops the empty ones), and only
     once there's more than one region — a lone banner over the whole early game
     is just noise.

     The FIRST region never gets one: it opens the page directly under the tab
     bar, which already names it, so a header there would only push the game
     down a line. Which region that is changes as the game opens up — Settlement
     until threats unlock, Threats after — so it's derived from tabs[0] rather
     than hardcoded, and Settlement gains a header the moment it stops being
     first.

     This is what a tab click scrolls to, not the region's first section, so the
     header lands under the sticky chrome and names where you've arrived. The
     scroll-spy knows about [data-region] for the same reason (see recompute). -->
{#snippet regionHead(tab: TabId)}
  {@const def = tabs.find((t) => t.id === tab)}
  {#if tabs.length > 1 && def && tabs[0]?.id !== tab}
    {@const Icon = def.icon}
    <h2 class="region" data-region={tab}>
      <Icon size={22} aria-hidden="true" />
      <span class="region-name">{def.label}</span>
      <span class="region-rule" aria-hidden="true"></span>
    </h2>
  {/if}
{/snippet}

<div class="topstack" bind:clientHeight={headerH}>
  <header>
    <div class="header-inner">
      <h1>
        <Castle size={18} color="var(--gold)" aria-hidden="true" />
        <span class="wordmark">Coin &amp; Castle</span>
        <span class="stat level-badge" class:leveled title="Settlement level">Lv {gs.level}</span>
      </h1>

      <!-- Core storage gauges. Icon and amount together are a link to the
           resource's full producer row, wherever it currently lives; hovering
           one opens a small staffing flyout (see StoreGauge). -->
      {#if gs.workers.trained >= 1 && stores.length > 0}
        <div class="stores">
          {#each stores as s (s.id)}
            <StoreGauge
              id={s.id}
              icon={s.icon}
              amount={s.amount}
              cap={s.cap}
              pct={s.pct}
              onjump={jumpToStore}
            />
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
  <!-- Left jump rail: one button per visible section ACROSS THE WHOLE PAGE —
       the full table of contents, where the tab bar is the chapter list over
       the same scroll. Clicking scrolls to it; a dot flags an affordable
       upgrade (gold) or an under-supplied threat track (amber), and a badge
       shows the workers assigned there.

       The buttons are clustered by tab with a hairline between clusters, so the
       rail's groups line up one-for-one with the tabs above: each run of icons
       is exactly what sits behind one tab. The divider carries the tab's name
       for screen readers via the group's aria-label — sighted users get the
       same information from the run's position under the highlighted tab.

       Dropped entirely on mobile (see the 900px rule) — the tab bar is enough
       navigation on a phone, and the 44px gutter is worth more than fine jumps.

       With one section in the whole game there's nothing to navigate between,
       so the buttons are dropped — but the rail's column is still rendered,
       holding its width so the content doesn't shift sideways the moment a
       second section unlocks. -->
  {#if gs.workers.trained >= 1}
    <nav class="jump-rail" aria-label="Jump to section">
      {#each navSections.length > 1 ? railGroups : [] as g, i (g.tab)}
        <!-- Hairline between chapters, never before the first one. -->
        {#if i > 0}
          <span class="rail-div" class:lit={activeTab === g.tab} aria-hidden="true"></span>
        {/if}
        <div class="rail-group" role="group" aria-label={tabLabel(g.tab)}>
          {#each g.sections as s (s.id)}
            {@const Icon = s.icon}
            <button
              class="jump-btn"
              class:active={activeSection === s.id}
              onclick={() => jumpTo(s.id)}
              aria-label={s.label}
              aria-current={activeSection === s.id ? 'true' : undefined}
              onmouseenter={(e) => showTip(e, s, 'right')}
              onmouseleave={hideTip}
              onfocus={(e) => showTip(e, s, 'right')}
              onblur={hideTip}
            >
              <Icon size={20} aria-hidden="true" />
              {#if s.alert}
                <span
                  class="dot"
                  class:warn={s.alert.severity === 'warn'}
                  class:bad={s.alert.severity === 'bad'}
                  role="img"
                  aria-label={s.alert.reason}
                ></span>
              {/if}
              <!-- Something in this section has never been built or staffed.
                   Rides alongside the alert dot rather than merging into it: an
                   alert is the worst thing waiting, this is a fact that stands
                   until you act on it, so a red shortage must not hide it. -->
              {#if s.hasNew}
                <span
                  class="new-pip"
                  role="img"
                  aria-label="{s.label}: something new"
                  title="Something here is new — never built or staffed"
                ></span>
              {/if}
              {#if s.count > 0}
                <span class="count-badge" aria-hidden="true">{s.count}</span>
              {/if}
              <StatusDots dots={s.dots} />
            </button>
          {/each}
        </div>
      {/each}
    </nav>
  {/if}

  <div class="app">
    <main>
      <WelcomeBack />

      <!-- Tab bar. Sticky, and it JUMPS rather than switches — everything below
           is mounted at once, and clicking a tab scrolls to its region. Hidden
           until there's more than one region to move between. -->
      {#if tabs.length > 1}
        <div class="tabbar" bind:clientHeight={tabsH}>
          <MainTabs {tabs} active={activeTab} onselect={selectTab} />
        </div>
      {/if}

      <!-- The whole game, in one scroll. The order here IS the tab order (see
           TAB_DEFS): settlement → resources → crafting → mysticism → quests →
           market → prestige, so each tab's sections form one unbroken run and a
           tab can be a jump to the first of them.

           The four structure regions are the same panel over a different slice
           of the group list; a slice with nothing unlocked renders nothing at
           all, so early game this collapses to just the settlement.

           Market and Prestige used to be mounted only because their tab was
           selected — with nothing gating on selection any more, they need their
           real unlock checks here. -->
      <div class="page">
        <!-- Settlement opens the page, so it gets no header of its own (see
             regionHead) — the tab bar is directly above it and already names
             it. -->
        {@render regionHead('settlement')}
        <SettlementPanel />
        {@render regionHead('threats')}
        <!-- One panel per track, siblings rather than the hex nested inside the
             assault's frame. Each self-gates on its own unlock. -->
        <ThreatPanel track="assault" />
        <ThreatPanel track="hex" />
        {@render regionHead('resources')}
        <ResourcePanel tab="resources" />
        {@render regionHead('crafting')}
        <ResourcePanel tab="crafting" />
        {@render regionHead('quests')}
        <ResourcePanel tab="quests" />
        {@render regionHead('mysticism')}
        <ResourcePanel tab="mysticism" />
        {#if isMarketUnlocked(gs)}
          {@render regionHead('market')}
          <MarketPanel />
        {/if}
        {#if isPrestigeUnlocked(gs)}
          {@render regionHead('prestige')}
          <PrestigePanel />
        {/if}
      </div>

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
    <AlertFlyout label={tip.text} alerts={tip.alerts} x={tip.x} y={tip.y} side={tip.side} />
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
    /* One button wide even when empty — see the markup note above. */
    width: 44px;
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
  /* One tab's worth of buttons. Keeps the within-chapter rhythm identical to
     the rail's own gap, so the only thing setting a cluster apart is the
     hairline and the extra air around it. */
  .rail-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  /* Chapter break, matching a boundary in the tab bar above. Deliberately
     narrower than a button so it reads as a separator rather than a control,
     and it lights up for the chapter you're currently in — the same accent the
     active tab and the active rail button use. */
  .rail-div {
    flex: 0 0 auto;
    width: 22px;
    height: 1px;
    margin: 1px auto;
    background: var(--border);
    transition: background var(--transition);
  }
  .rail-div.lit {
    background: color-mix(in srgb, var(--accent) 55%, transparent);
  }
  .jump-btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 44px;
    height: 44px;
    /* The glyph rides up a little to clear the status strip on the bottom edge,
       keeping it optically centred between the count badge and the dots rather
       than sitting on top of them. Padding, not a transform, so the absolutely
       positioned corner pieces are unaffected. */
    padding-bottom: 7px;
    box-sizing: border-box;
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
  /* Opportunity/danger dot, tucked into the tile's top-right corner (inside the
     bounds so the scroll container never clips it).

     Green for opportunity rather than gold: --warn is a 55/45 blend of --gold
     and --bad, so a gold "good" put all three tiers in one narrow warm band
     (ΔE ~24 between good and warn). --good roughly triples that gap. It also
     gives gold its single job back — value, as in the level badge and the
     storage gauges — instead of doubling as an alert tier. */
  .dot {
    position: absolute;
    top: 3px;
    right: 3px;
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: var(--good);
    box-shadow: 0 0 0 2px var(--bg-panel);
  }
  .dot.warn {
    background: var(--warn);
  }
  /* Red also pulses. Hue alone can't separate these tiers for red-green colour
     blindness in every palette (and not at all in the single-hue amber one), so
     the most severe tier carries a non-chromatic signal too. Safe to animate
     because red is scoped to the rare "feeding cannot fix this" case. */
  .dot.bad {
    background: var(--bad);
    animation: alertPulse 1.8s ease-in-out infinite;
  }
  @keyframes alertPulse {
    0%,
    100% {
      box-shadow:
        0 0 0 2px var(--bg-panel),
        0 0 0 2px color-mix(in srgb, var(--bad) 70%, transparent);
    }
    55% {
      box-shadow:
        0 0 0 2px var(--bg-panel),
        0 0 0 6px transparent;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .dot.bad {
      animation: none;
    }
  }
  /* Worker count: just the number, tucked in the icon's top-left corner. It sat
     bottom-left until the status strip claimed that edge; moving it up also
     pairs it with the alert dot opposite, leaving the whole bottom of the tile
     to one row of dots. */
  /* "Something in here has never been built or staffed", on the tile's right
     edge, vertically centred — clear of the alert dot's top-right corner and the
     status strip along the bottom, so all three read as separate marks.

     A SQUARE, not a circle, and in --accent: it has to stay legible next to the
     round good/warn/bad dots without competing for their meaning, and shape
     carries that difference where a fourth hue in the same corner would not. */
  .new-pip {
    position: absolute;
    top: 50%;
    right: 3px;
    transform: translateY(-50%);
    width: 8px;
    height: 8px;
    border-radius: 2px;
    background: var(--accent);
    box-shadow: 0 0 0 2px var(--bg-panel);
    pointer-events: none;
  }
  .count-badge {
    position: absolute;
    top: 2px;
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

  /* Sections and section headers land clear of the sticky header AND the sticky
     tab bar when jumped to, plus a little peek at whatever sits above them. */
  :global([data-nav]),
  .region {
    scroll-margin-top: var(--scroll-offset, 96px);
  }

  /* --- Section header: names one tab's region of the page --- */
  .region {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    /* Introduces what follows, so it sits nearer its own region than the one
       above. .page's gap supplies the space below. */
    margin-top: var(--space-5);
    font-family: var(--font-display);
    font-size: 30px;
    font-weight: 400;
    line-height: 1.1;
    letter-spacing: 0.04em;
    color: var(--text);
  }
  .region :global(svg) {
    flex: 0 0 auto;
    color: var(--accent);
  }
  .region-name {
    flex: 0 0 auto;
  }
  /* Rule running out to the right margin, fading so it reads as a flourish
     rather than a second border competing with the panels below it. */
  .region-rule {
    flex: 1 1 auto;
    height: 1px;
    min-width: var(--space-4);
    background: linear-gradient(to right, var(--border), transparent);
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
  /* A jumped-to section header lights its own type instead of taking the ring:
     an outline around a single line of text reads as a box the layout doesn't
     otherwise have. Same two durations, so it feels like the same gesture. */
  .region {
    transition: color 1.32s ease-in-out;
  }
  .region:global(.nav-flash) {
    color: var(--accent);
    transition-duration: 0.72s;
  }
  @media (prefers-reduced-motion: reduce) {
    :global([data-nav]),
    :global([data-nav].nav-flash),
    .region,
    .region:global(.nav-flash) {
      transition: none;
    }
  }

  /* Explorer bar + game header stick together as one unit.

     The z-index must stay ABOVE .tabbar (20) and .jump-rail (20). Because
     .topstack is positioned with a z-index it forms a stacking context, so the
     store gauges' staffing flyout — which hangs BELOW the header, into the tab
     bar's band — can never escape this layer no matter what z-index it sets on
     itself. At 5 the flyout rendered behind the sticky tabs. Kept under the
     settings drawer (30) and the alert flyout (50), which still overlay it. */
  .topstack {
    position: sticky;
    top: 0;
    z-index: 25;
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

  /* At-a-glance core storage gauges. Each gauge is a StoreGauge, which owns its
     own internals (and the staffing flyout); this only lays them out. */
  .stores {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
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
  /* Pins the tab bar directly under the sticky header. Owned here rather than
     inside MainTabs so its height can be measured for --scroll-offset. */
  .tabbar {
    position: sticky;
    top: var(--header-h, 0px);
    z-index: 20;
    background: var(--bg);
  }

  /* The whole page's panels, stacked with the same rhythm `main` uses so the
     regions read as one continuous column rather than as stitched-together
     pages. */
  .page {
    display: flex;
    flex-direction: column;
    gap: var(--panel-gap);
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
    /* Mobile drops the jump rail entirely. The tab bar is the navigation here,
       each tab is short enough to scroll, and reclaiming the 44px gutter (plus
       the overlay the rule above puts over the left edge) is worth more than
       section jumps on a phone. Reset the gutter that rule reserved. */
    .jump-rail {
      display: none;
    }
    .layout {
      padding-left: var(--space-4);
    }
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

  /* Phones: tighten gaps and shrink the worker readout so the row still fits on
     one line. */
  @media (max-width: 640px) {
    .header-inner {
      gap: var(--space-2);
    }
    .stores {
      gap: 10px;
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

<script lang="ts">
  import type { Component } from 'svelte';
  import { onMount } from 'svelte';
  import { game } from './ui/gameStore.svelte';
  import { sound } from './ui/sound.svelte';
  import {
    getAvailableWorkers,
    getTotalWorkers,
    getCapacity,
    isResourceUnlocked,
  } from './engine/selectors';
  import { RESOURCES, type ResourceId } from './content/resources';
  import { formatNumber } from './engine/numbers';
  import SettlementPanel from './ui/SettlementPanel.svelte';
  import CampPanel from './ui/CampPanel.svelte';
  import CombatPanel from './ui/CombatPanel.svelte';
  import ResourcePanel from './ui/ResourcePanel.svelte';
  import SettingsPanel from './ui/SettingsPanel.svelte';
  import WelcomeBack from './ui/WelcomeBack.svelte';
  import Toasts from './ui/Toasts.svelte';
  import Castle from '@lucide/svelte/icons/castle';
  import Settings from '@lucide/svelte/icons/settings';
  import PersonStanding from '@lucide/svelte/icons/person-standing';
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
  let settingsOpen = $state(false);
  // Measured so the sticky settings column can park just below the header,
  // whose height shifts with the chosen font/layout.
  let headerH = $state(0);

  const gs = $derived(game.state);
  const available = $derived(getAvailableWorkers(gs));
  const total = $derived(getTotalWorkers(gs));
  // Busy workers (total minus idle), mirrored as a storage-style gauge.
  const working = $derived(Math.max(0, total - available));
  const workerPct = $derived(total > 0 ? Math.min(100, (working / total) * 100) : 0);

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
      const cap = getCapacity(gs, s.id);
      if (!isResourceUnlocked(gs, s.id) || !cap) return [];
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
      <Castle size={24} color="var(--gold)" aria-hidden="true" /> Coin &amp; Castle
      <span class="stat level-badge" class:leveled title="Settlement level">Lv {gs.level}</span>
    </h1>

    {#if stores.length > 0}
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
        {working}/{total}
        <PersonStanding size={16} color="var(--gold)" aria-hidden="true" />
        <span class="store-bar" class:alert={available > 0}
          ><span class="store-fill" style:width="{workerPct}%"></span></span
        >
      </span>
      <button
        class="settings-btn"
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

<div class="layout" class:settings-open={settingsOpen} style="--header-h: {headerH}px">
  <div class="app">
    <main>
      <WelcomeBack />
      <SettlementPanel />
      <CombatPanel />
      <ResourcePanel />
      <CampPanel />
    </main>

    <footer>
      <span>v{__APP_VERSION__}</span>
      <span class="tag">Coin &amp; Castle</span>
    </footer>
  </div>

  {#if settingsOpen}
    <SettingsPanel onclose={() => (settingsOpen = false)} />
  {/if}
</div>

<Toasts />

<style>
  /* Row wrapper: main content, with settings pushed in as a right-hand
     column when open. Both are centered as a group. */
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
  .layout > :global(.settings) {
    flex: 0 0 340px;
    align-self: stretch;
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
    font-size: 26px;
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
  /* Idle workers: the unfilled remainder glows red as a nudge to assign them. */
  .store-bar.alert {
    background: color-mix(in srgb, var(--bad) 55%, transparent);
  }
  .hud {
    display: flex;
    align-items: center;
    gap: var(--space-3);
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
    background: var(--bad);
    animation: idlePulse 2s ease-in-out infinite;
  }
  .worker-badge.done {
    background: var(--good, #16a34a);
  }
  @keyframes idlePulse {
    0%,
    100% {
      box-shadow: 0 0 0 2px var(--bg-header), 0 0 0 0 color-mix(in srgb, var(--bad) 60%, transparent);
    }
    50% {
      box-shadow: 0 0 0 2px var(--bg-header), 0 0 0 5px transparent;
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
    transition: opacity 0.15s ease, transform 0.15s ease;
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
  .settings-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 0;
    color: var(--text-on-header);
    padding: 4px;
    border-radius: var(--radius);
    cursor: pointer;
    transition: color var(--transition), background var(--transition);
  }
  .settings-btn:hover,
  .settings-btn.active {
    color: var(--gold);
    background: rgba(255, 255, 255, 0.12);
  }
  .settings-btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  main {
    flex: 1;
    padding-top: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--panel-gap);
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

  @media (max-width: 480px) {
    .layout {
      padding: 0 var(--space-3);
    }
    .header-inner {
      padding: var(--space-2) var(--space-3);
      gap: var(--space-2);
    }
    header h1 {
      font-size: 20px;
    }
    .hud {
      gap: var(--space-2);
    }
    .stores {
      gap: var(--space-3);
      order: 1;
      width: 100%;
      justify-content: space-between;
    }
    .store-bar {
      width: 40px;
    }
  }
</style>

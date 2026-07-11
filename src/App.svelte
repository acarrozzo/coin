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
    <h1><Castle size={24} color="var(--gold)" aria-hidden="true" /> Coin &amp; Castle</h1>

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
      <span class="stat" class:leveled title="Settlement level">Lv {gs.level}</span>
      <span class="stat" title="Working / total workers">
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
      <CampPanel />
      <CombatPanel />
      <ResourcePanel />
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

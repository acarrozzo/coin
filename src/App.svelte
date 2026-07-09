<script lang="ts">
  import { onMount } from 'svelte';
  import { game } from './ui/gameStore.svelte';
  import { sound } from './ui/sound.svelte';
  import { getAvailableWorkers, getTotalWorkers } from './engine/selectors';
  import SettlementPanel from './ui/SettlementPanel.svelte';
  import CombatPanel from './ui/CombatPanel.svelte';
  import ResourcePanel from './ui/ResourcePanel.svelte';
  import BuildingPanel from './ui/BuildingPanel.svelte';
  import SettingsPanel from './ui/SettingsPanel.svelte';
  import WelcomeBack from './ui/WelcomeBack.svelte';
  import Toasts from './ui/Toasts.svelte';
  import Castle from '@lucide/svelte/icons/castle';
  import PersonStanding from '@lucide/svelte/icons/person-standing';
  import Sun from '@lucide/svelte/icons/sun';
  import Moon from '@lucide/svelte/icons/moon';

  type Theme = 'light' | 'dark';
  const THEME_KEY = 'cc:theme';
  let theme = $state<Theme>('dark');
  let leveled = $state(false);

  const gs = $derived(game.state);
  const available = $derived(getAvailableWorkers(gs));
  const total = $derived(getTotalWorkers(gs));

  onMount(() => {
    const saved = localStorage.getItem(THEME_KEY) as Theme | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    theme = saved ?? (prefersDark ? 'dark' : 'light');
    sound.load();

    game.start();
    return () => game.stop();
  });

  $effect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
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

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
  }
</script>

<div class="app">
  <header>
    <h1><Castle size={24} color="var(--gold)" aria-hidden="true" /> Coin &amp; Castle</h1>
    <div class="hud">
      <span class="stat" class:leveled title="Settlement level">Lv {gs.level}</span>
      <span class="stat" title="Idle / total workers"
        >{available}/{total} <PersonStanding size={16} color="var(--gold)" aria-hidden="true" /></span
      >
      <button class="theme-toggle" onclick={toggleTheme} aria-label="Toggle theme">
        {#if theme === 'dark'}<Sun size={18} color="var(--gold)" aria-hidden="true" />{:else}<Moon
            size={18}
            color="var(--accent)"
            aria-hidden="true"
          />{/if}
      </button>
    </div>
  </header>

  <main>
    <WelcomeBack />
    <SettlementPanel />
    <CombatPanel />
    <ResourcePanel />
    <BuildingPanel />
    <SettingsPanel />
  </main>

  <footer>
    <span>v{__APP_VERSION__}</span>
    <span class="tag">Coin &amp; Castle</span>
  </footer>
</div>

<Toasts />

<style>
  .app {
    max-width: 720px;
    margin: 0 auto;
    padding: 0 var(--space-4) var(--space-5);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  header {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    margin: 0 calc(-1 * var(--space-4));
    padding: var(--space-2) var(--space-4);
    background: var(--bg-header);
    border-bottom: 1px solid var(--border);
  }
  header h1 {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-size: 26px;
    color: var(--text-on-header);
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
  .theme-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-on-header);
    border-radius: var(--radius);
    width: 34px;
    height: 34px;
    font-size: 18px;
    line-height: 1;
    transition: background var(--transition);
  }
  .theme-toggle:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  main {
    flex: 1;
    padding-top: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
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
    .app {
      padding: 0 var(--space-3) var(--space-5);
    }
    header h1 {
      font-size: 20px;
    }
    .hud {
      gap: var(--space-2);
    }
  }
</style>

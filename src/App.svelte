<script lang="ts">
  import { onMount } from 'svelte';
  import { game } from './ui/gameStore.svelte';
  import { getAvailableWorkers, getTotalWorkers } from './engine/selectors';
  import SettlementPanel from './ui/SettlementPanel.svelte';
  import ResourcePanel from './ui/ResourcePanel.svelte';
  import BuildingPanel from './ui/BuildingPanel.svelte';
  import WelcomeBack from './ui/WelcomeBack.svelte';

  type Theme = 'light' | 'dark';
  const THEME_KEY = 'cc:theme';
  let theme = $state<Theme>('dark');

  const gs = $derived(game.state);
  const available = $derived(getAvailableWorkers(gs));
  const total = $derived(getTotalWorkers(gs));

  onMount(() => {
    const saved = localStorage.getItem(THEME_KEY) as Theme | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    theme = saved ?? (prefersDark ? 'dark' : 'light');

    game.start();
    return () => game.stop();
  });

  $effect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  });

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
  }
</script>

<div class="app">
  <header>
    <h1>🏰 Coin &amp; Castle</h1>
    <div class="hud">
      <span class="stat" title="Settlement level">Lv {gs.level}</span>
      <span class="stat" title="Idle / total workers">{available}/{total} 👷</span>
      <button class="theme-toggle" onclick={toggleTheme} aria-label="Toggle theme">
        {theme === 'dark' ? '☀' : '☾'}
      </button>
    </div>
  </header>

  <main>
    <WelcomeBack />
    <SettlementPanel />
    <ResourcePanel />
    <BuildingPanel />
  </main>

  <footer>
    <span>v{__APP_VERSION__}</span>
    <button class="reset" onclick={() => game.reset()}>Reset game</button>
  </footer>
</div>

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
    font-size: 26px;
    color: var(--text-on-header);
  }
  .hud {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  .stat {
    color: var(--text-on-header);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .theme-toggle {
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
  .reset {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-muted);
    border-radius: var(--radius);
    padding: 4px 10px;
    font-size: 12px;
  }
  .reset:hover {
    color: var(--bad);
    border-color: var(--bad);
  }

  @media (max-width: 480px) {
    header h1 {
      font-size: 20px;
    }
    .hud {
      gap: var(--space-2);
    }
  }
</style>

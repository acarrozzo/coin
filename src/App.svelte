<script lang="ts">
  import { onMount } from 'svelte';

  type Theme = 'light' | 'dark';
  const THEME_KEY = 'cc:theme';

  let theme = $state<Theme>('dark');

  onMount(() => {
    const saved = localStorage.getItem(THEME_KEY) as Theme | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    theme = saved ?? (prefersDark ? 'dark' : 'light');
  });

  // Keep <html data-theme> and localStorage in sync with state.
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
    <button class="theme-toggle" onclick={toggleTheme} aria-label="Toggle theme">
      {theme === 'dark' ? '☀' : '☾'}
    </button>
  </header>

  <main>
    <section class="panel">
      <h2>Ready to build</h2>
      <p>
        Phase 0 scaffold is live. The engine, content data, and the first playable
        vertical slice land next.
      </p>
    </section>
  </main>

  <footer>
    <span>v{__APP_VERSION__}</span>
  </footer>
</div>

<style>
  .app {
    max-width: 960px;
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
    margin: 0 calc(-1 * var(--space-4));
    padding: var(--space-2) var(--space-4);
    background: var(--bg-header);
    border-bottom: 1px solid var(--border);
  }

  header h1 {
    font-size: 28px;
    color: var(--text-on-header);
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
    padding-top: var(--space-5);
  }

  .panel {
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: var(--space-4);
    animation: fadeIn var(--fade-in);
  }
  .panel h2 {
    font-size: 32px;
    margin-bottom: var(--space-2);
  }
  .panel p {
    color: var(--text-muted);
    max-width: 52ch;
  }

  footer {
    margin-top: var(--space-5);
    padding-top: var(--space-3);
    border-top: 1px solid var(--border);
    color: var(--text-muted);
    font-size: 13px;
  }
</style>

<script lang="ts">
  import { game } from './gameStore.svelte';
  import { RESOURCES, type ResourceId } from '../content/resources';
  import { formatNumber } from '../engine/numbers';

  const summary = $derived(game.welcomeBack);

  function humanize(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m`;
    return `${Math.floor(seconds)}s`;
  }
</script>

{#if summary}
  <div class="welcome" role="status">
    <div class="body">
      <strong>Welcome back!</strong>
      <span>
        While you were away ({humanize(summary.elapsedSeconds)}{summary.capped ? ', capped' : ''})
        your workers gathered:
      </span>
      <ul>
        {#each Object.entries(summary.gains) as [rid, amt] (rid)}
          <li>+{formatNumber(amt)} {RESOURCES[rid as ResourceId].name}</li>
        {/each}
      </ul>
    </div>
    <button onclick={() => game.dismissWelcome()} aria-label="Dismiss">✕</button>
  </div>
{/if}

<style>
  .welcome {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-3);
    background: color-mix(in srgb, var(--gold) 18%, var(--bg-panel));
    border: 1px solid var(--gold);
    border-radius: var(--radius);
    padding: var(--space-3) var(--space-4);
    animation: fadeIn var(--fade-in);
  }
  .body {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  ul {
    margin: var(--space-1) 0 0;
    padding-left: var(--space-4);
    color: var(--good);
  }
  button {
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 16px;
  }
  button:hover {
    color: var(--text);
  }
</style>

<script lang="ts">
  import { game } from './gameStore.svelte';
  import { RESOURCES } from '../content/resources';
  import {
    unlockedResources,
    getCapacity,
    getProductionRate,
    getAvailableWorkers,
    isAtCapacity,
  } from '../engine/selectors';
  import { formatNumber, formatRate } from '../engine/numbers';

  const state = $derived(game.state);
  const resources = $derived(unlockedResources(state));
  const available = $derived(getAvailableWorkers(state));

  function pct(id: (typeof resources)[number]): number {
    const cap = getCapacity(state, id);
    if (cap.lte(0)) return 0;
    return Math.min(100, state.resources[id].amount.div(cap).toNumber() * 100);
  }
</script>

<section class="panel">
  <h2>Resources</h2>
  <div class="rows">
    {#each resources as id (id)}
      {@const full = isAtCapacity(state, id)}
      <div class="row">
        <div class="head">
          <span class="name">{RESOURCES[id].name}</span>
          <span class="amount">
            {formatNumber(state.resources[id].amount)} / {formatNumber(getCapacity(state, id))}
          </span>
        </div>

        <div class="bar" class:full>
          <div class="fill" style:width="{pct(id)}%"></div>
        </div>

        <div class="controls">
          <span class="rate" class:idle={state.workers.assigned[id] === 0}>
            {#if full}<span class="tag">FULL</span>{:else}+{formatRate(getProductionRate(state, id))}{/if}
          </span>
          <div class="workers">
            <button
              onclick={() => game.assign(id, -1)}
              disabled={state.workers.assigned[id] === 0}
              aria-label="Remove worker from {RESOURCES[id].name}">−</button
            >
            <span class="count">{state.workers.assigned[id]} 👷</span>
            <button
              onclick={() => game.assign(id, 1)}
              disabled={available <= 0}
              aria-label="Add worker to {RESOURCES[id].name}">+</button
            >
          </div>
        </div>
      </div>
    {/each}
  </div>
</section>

<style>
  .panel {
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: var(--space-4);
    animation: fadeIn var(--fade-in);
  }
  h2 {
    font-size: 28px;
    margin-bottom: var(--space-3);
  }
  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: var(--space-1);
  }
  .name {
    font-size: 18px;
  }
  .amount {
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }
  .bar {
    height: 10px;
    background: color-mix(in srgb, var(--border) 40%, transparent);
    border-radius: 999px;
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: var(--accent);
    border-radius: 999px;
    transition: width 0.2s linear;
  }
  .bar.full .fill {
    background: var(--gold);
  }
  .controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: var(--space-2);
  }
  .rate {
    color: var(--good);
    font-variant-numeric: tabular-nums;
  }
  .rate.idle {
    color: var(--text-muted);
  }
  .tag {
    color: var(--gold);
  }
  .workers {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .count {
    min-width: 56px;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  button {
    width: 32px;
    height: 32px;
    font-size: 18px;
    line-height: 1;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text);
    border-radius: var(--radius);
    transition: background var(--transition);
  }
  button:hover:not(:disabled) {
    background: color-mix(in srgb, var(--accent) 20%, transparent);
  }
  button:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
</style>

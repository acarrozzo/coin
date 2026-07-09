<script lang="ts">
  import { game } from './gameStore.svelte';
  import { BUILDINGS, BUILDING_IDS } from '../content/buildings';
  import { RESOURCES, type ResourceId } from '../content/resources';
  import {
    getNextBuildingLevel,
    canBuild,
    isBuildingAvailable,
  } from '../engine/selectors';
  import { formatNumber } from '../engine/numbers';
  import type { ResourceCost } from '../content/settlement';

  const gs = $derived(game.state);
  const available = $derived(BUILDING_IDS.filter((id) => isBuildingAvailable(gs, id)));

  function costEntries(cost: ResourceCost) {
    return Object.entries(cost) as [ResourceId, number][];
  }
</script>

<section class="panel">
  <h2>Buildings</h2>
  {#if available.length === 0}
    <p class="empty">Grow your settlement to unlock buildings.</p>
  {/if}
  <div class="rows">
    {#each available as id (id)}
      {@const def = BUILDINGS[id]}
      {@const next = getNextBuildingLevel(gs, id)}
      {@const owned = gs.buildings[id].level}
      <div class="row">
        <div class="info">
          <span class="name"
            >{def.name}{#if owned > 0}<span class="lvl"> · Lv {owned}</span>{/if}</span
          >
          <span class="blurb">{next ? next.summary : def.blurb}</span>
        </div>

        {#if next}
          <div class="action">
            <span class="cost">
              {#each costEntries(next.cost) as [rid, amt] (rid)}
                <span class="cost-item" class:short={gs.resources[rid].amount.lt(amt)}>
                  {formatNumber(amt)} {RESOURCES[rid].name}
                </span>
              {/each}
            </span>
            <button onclick={() => game.build(id)} disabled={!canBuild(gs, id)}>
              {owned === 0 ? 'Build' : 'Upgrade'}
            </button>
          </div>
        {:else}
          <span class="maxed">MAX</span>
        {/if}
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
  .empty {
    color: var(--text-muted);
  }
  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .info {
    display: flex;
    flex-direction: column;
  }
  .name {
    font-size: 17px;
  }
  .lvl {
    color: var(--accent);
  }
  .blurb {
    color: var(--text-muted);
    font-size: 14px;
  }
  .action {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  .cost {
    display: flex;
    gap: var(--space-3);
    font-size: 14px;
    flex-wrap: wrap;
  }
  .cost-item {
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .cost-item.short {
    color: var(--bad);
  }
  button {
    padding: 6px 16px;
    font-size: 15px;
    border: 1px solid var(--border);
    background: color-mix(in srgb, var(--accent) 22%, transparent);
    color: var(--text);
    border-radius: var(--radius);
    transition: background var(--transition);
  }
  button:hover:not(:disabled) {
    background: color-mix(in srgb, var(--accent) 40%, transparent);
  }
  button:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .maxed {
    color: var(--gold);
  }
</style>

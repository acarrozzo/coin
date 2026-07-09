<script lang="ts">
  import { game } from './gameStore.svelte';
  import { BUILDINGS, BUILDING_IDS } from '../content/buildings';
  import { RESOURCES, type ResourceId } from '../content/resources';
  import { getNextBuildingLevel, canBuild } from '../engine/selectors';
  import { formatNumber } from '../engine/numbers';

  const state = $derived(game.state);

  function costEntries(cost: Partial<Record<ResourceId, number>>) {
    return Object.entries(cost) as [ResourceId, number][];
  }
</script>

<section class="panel">
  <h2>Buildings</h2>
  <div class="rows">
    {#each BUILDING_IDS as id (id)}
      {@const def = BUILDINGS[id]}
      {@const next = getNextBuildingLevel(state, id)}
      {@const owned = state.buildings[id].level}
      <div class="row">
        <div class="info">
          <span class="name">{def.name}{#if owned > 0}<span class="lvl"> · Lv {owned}</span>{/if}</span>
          <span class="blurb">{next ? next.summary : def.blurb}</span>
        </div>

        {#if next}
          <div class="action">
            <span class="cost">
              {#each costEntries(next.cost) as [rid, amt] (rid)}
                <span class="cost-item" class:short={state.resources[rid].amount.lt(amt)}>
                  {formatNumber(amt)} {RESOURCES[rid].name}
                </span>
              {/each}
            </span>
            <button onclick={() => game.build(id)} disabled={!canBuild(state, id)}>
              Build
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
    font-size: 18px;
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
  }
  .cost {
    display: flex;
    gap: var(--space-3);
    font-size: 14px;
  }
  .cost-item {
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
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

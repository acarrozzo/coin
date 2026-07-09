<script lang="ts">
  import { game } from './gameStore.svelte';
  import { RESOURCES, type ResourceId } from '../content/resources';
  import { PRODUCERS, type StructureId } from '../content/producers';
  import {
    unlockedResources,
    getCapacity,
    getProductionRate,
    getAvailableWorkers,
    getMaxWorkers,
  } from '../engine/selectors';
  import { formatNumber, formatRate } from '../engine/numbers';

  const gs = $derived(game.state);
  const available = $derived(getAvailableWorkers(gs));
  const unlocked = $derived(unlockedResources(gs));

  const STRUCTURE_ORDER: StructureId[] = [
    'settlement',
    'farm',
    'deepmine',
    'blacksmith',
    'hunterscabin',
  ];
  const STRUCTURE_LABELS: Record<StructureId, string> = {
    settlement: 'Gathering',
    farm: 'Farm',
    deepmine: 'Deep Mine',
    blacksmith: 'Blacksmith',
    hunterscabin: "Hunter's Cabin",
  };

  const groups = $derived(
    STRUCTURE_ORDER.map((structure) => ({
      structure,
      label: STRUCTURE_LABELS[structure],
      ids: unlocked.filter((id) => PRODUCERS[id].structure === structure),
    })).filter((g) => g.ids.length > 0),
  );

  function capPct(id: ResourceId): number {
    const cap = getCapacity(gs, id);
    if (!cap || cap.lte(0)) return 0;
    return Math.min(100, gs.resources[id].amount.div(cap).toNumber() * 100);
  }

  // A crafting line with workers but a completely empty input is "starved".
  function starvedInput(id: ResourceId): ResourceId | null {
    const p = PRODUCERS[id];
    if (!p.inputs || gs.workers.assigned[id] === 0) return null;
    for (const rid of Object.keys(p.inputs) as ResourceId[]) {
      if (gs.resources[rid].amount.lte(0)) return rid;
    }
    return null;
  }
</script>

<section class="panel">
  <h2>Resources</h2>
  {#each groups as group (group.structure)}
    <div class="group">
      <h3>{group.label}</h3>
      {#each group.ids as id (id)}
        {@const cap = getCapacity(gs, id)}
        {@const assigned = gs.workers.assigned[id]}
        {@const starved = starvedInput(id)}
        <div class="row">
          <div class="head">
            <span class="name">{RESOURCES[id].name}</span>
            <span class="amount">
              {formatNumber(gs.resources[id].amount)}{#if cap}<span class="cap">
                  / {formatNumber(cap)}</span
                >{/if}
            </span>
          </div>

          {#if cap}
            <div class="bar"><div class="fill" style:width="{capPct(id)}%"></div></div>
          {/if}

          <div class="controls">
            <span class="rate" class:idle={assigned === 0}>
              {#if starved}
                <span class="warn">needs {RESOURCES[starved].name}</span>
              {:else}
                +{formatRate(getProductionRate(gs, id))}
              {/if}
            </span>
            <div class="workers">
              <button
                onclick={() => game.assign(id, -1)}
                disabled={assigned === 0}
                aria-label="Remove worker from {RESOURCES[id].name}">−</button
              >
              <span class="count">{assigned} 👷</span>
              <button
                onclick={() => game.assign(id, 1)}
                disabled={available <= 0 || assigned >= getMaxWorkers(gs, id)}
                aria-label="Add worker to {RESOURCES[id].name}">+</button
              >
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/each}
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
    margin-bottom: var(--space-2);
  }
  .group + .group {
    margin-top: var(--space-4);
  }
  h3 {
    font-size: 20px;
    color: var(--text-muted);
    border-bottom: 1px solid var(--border);
    padding-bottom: var(--space-1);
    margin-bottom: var(--space-3);
  }
  .row + .row {
    margin-top: var(--space-3);
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: var(--space-1);
  }
  .name {
    font-size: 17px;
  }
  .amount {
    font-variant-numeric: tabular-nums;
  }
  .cap {
    color: var(--text-muted);
  }
  .bar {
    height: 8px;
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
  .warn {
    color: var(--bad);
  }
  .workers {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .count {
    min-width: 52px;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  button {
    width: 30px;
    height: 30px;
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

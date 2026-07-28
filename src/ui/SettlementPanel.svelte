<script lang="ts">
  import { game } from './gameStore.svelte';
  import { RESOURCES, type ResourceId } from '../content/resources';
  import { getTier, type ResourceCost } from '../content/settlement';
  import {
    getNextTier,
    canUpgradeSettlement,
    getWorkerCost,
    canTrainWorker,
    getTotalWorkers,
    getAvailableWorkers,
    splitCost,
  } from '../engine/selectors';
  import { formatNumber } from '../engine/numbers';
  import { jumpToResource, hasResourceRow } from './nav.svelte';
  import User from '@lucide/svelte/icons/user';

  const gs = $derived(game.state);
  const tier = $derived(getTier(gs.level));
  const next = $derived(getNextTier(gs));
  const total = $derived(getTotalWorkers(gs));
  const available = $derived(getAvailableWorkers(gs));
  const workerCost = $derived(getWorkerCost(gs));

  function costEntries(cost: ResourceCost) {
    return Object.entries(cost) as [ResourceId, number][];
  }
</script>

<!-- One cost/requirement chip: green when you hold it, red when you're short.
     It's also a link to where that resource comes from — but only when there is
     a producer row to land on, so a chip naming an unproduced or still-locked
     resource stays plain text rather than a button that does nothing. -->
{#snippet chipText(rid: ResourceId, amt: number)}{formatNumber(amt)} {RESOURCES[rid].name}{/snippet}

{#snippet costChip(rid: ResourceId, amt: number, reqOnly: boolean = false)}
  {@const met = gs.resources[rid].amount.gte(amt)}
  {#if hasResourceRow(gs, rid)}
    <button
      type="button"
      class="cost-item jump"
      class:req-only={reqOnly}
      class:short={!met}
      class:met
      title="Go to {RESOURCES[rid].name}"
      onclick={() => jumpToResource(rid)}>{@render chipText(rid, amt)}</button
    >
  {:else}
    <span class="cost-item" class:req-only={reqOnly} class:short={!met} class:met
      >{@render chipText(rid, amt)}</span
    >
  {/if}
{/snippet}

<section class="panel" data-nav="settlement">
  <div class="tier">
    <div class="info">
      <span class="name"
        ><span class="lvl">Lvl {gs.level}</span> {tier?.name ?? `Level ${gs.level}`}</span
      >
      <span class="blurb">{tier?.blurb ?? ''}</span>
    </div>
    {#if next}
      {@const parts = splitCost(next.cost)}
      {@const hasReqs = parts.required.length > 0 || !!next.workersRequired || !!next.requires}
      <div class="action">
        <span class="cost">
          {#each parts.consumed as [rid, amt] (rid)}
            {@render costChip(rid, amt)}
          {/each}

          {#if hasReqs}
            {#if parts.consumed.length}<span class="cost-sep" aria-hidden="true">•</span>{/if}
            {#each parts.required as [rid, amt] (rid)}
              {@render costChip(rid, amt, true)}
            {/each}
            {#if next.workersRequired}
              {@const met = gs.workers.trained >= next.workersRequired}
              <span class="cost-item req-only" class:short={!met} class:met>
                {next.workersRequired}
                <User size={13} color="var(--gold)" aria-hidden="true" /> trained
              </span>
            {/if}
            {#if next.requires}
              {#each costEntries(next.requires) as [rid, amt] (rid)}
                {@render costChip(rid, amt, true)}
              {/each}
            {/if}
          {/if}
        </span>
        <button onclick={() => game.upgradeSettlement()} disabled={!canUpgradeSettlement(gs)}>
          {gs.level === 0 ? 'Build Shack' : `Upgrade → ${next.name}`}
        </button>
      </div>
    {:else}
      <span class="maxed">Largest settlement</span>
    {/if}
  </div>

  <div class="workers">
    <div class="info">
      <span class="name">
        <User size={20} color="var(--gold)" aria-hidden="true" />Workers
      </span>
      <span class="blurb">{available} idle · {total} total</span>
    </div>
    <div class="action">
      {#if workerCost.gt(0)}
        <span class="cost">
          <!-- Not costChip: the gate here is canTrainWorker (food AND an idle
               worker cap), not simply holding the food. -->
          <button
            type="button"
            class="cost-item jump"
            class:short={!canTrainWorker(gs)}
            title="Go to {RESOURCES.food.name}"
            onclick={() => jumpToResource('food')}>{formatNumber(workerCost)} Food</button
          >
        </span>
      {/if}
      <button onclick={() => game.train()} disabled={!canTrainWorker(gs)}>+1 worker</button>
    </div>
  </div>
</section>

<style>
  /* Framed like the structure cards in ResourcePanel and the Combat panel, so
     every zone on the page reads as the same kind of object. */
  .panel {
    background: var(--bg-panel);
    border: var(--panel-border);
    border-top: 3px solid var(--accent);
    border-radius: var(--panel-radius);
    box-shadow: var(--panel-shadow);
    padding: var(--panel-pad);
    animation: fadeIn var(--fade-in);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  /* Settings can drop the colored accent strip; fall back to the plain frame. */
  :global(:root[data-accent-border='off']) .panel {
    border-top: var(--panel-border);
  }
  .tier,
  .workers {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .workers {
    border-top: 1px solid var(--border);
    padding-top: var(--space-4);
  }
  .info {
    display: flex;
    flex-direction: column;
  }
  .name {
    font-family: var(--font-display);
    font-size: 24px;
  }
  .workers .name {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  /* Only the settlement's own name is enlarged — the Workers header keeps the
     base size. */
  .tier .name {
    font-size: 32px;
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
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .cost-item.short {
    color: var(--bad);
  }
  .cost-item.met {
    color: var(--good);
  }
  /* A chip that links to its resource's row. Undoes the action-button styling
     the bare `button` rule below applies, so it still reads as a chip, and
     carries a hover underline as the only hint that it's clickable — a border
     or fill here would compete with the Upgrade button beside it.

     Selectors are deliberately scoped through .cost: that outranks both
     `button` and `button:hover:not(:disabled)` no matter which block the
     bundler emits first, which a bare `button.cost-item` would not. */
  .cost button.cost-item {
    padding: 0;
    border: 0;
    background: none;
    border-radius: 0;
    font: inherit;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
  }
  .cost button.cost-item:hover,
  .cost button.cost-item:focus-visible {
    background: none;
    color: var(--accent);
    text-decoration: underline;
    text-underline-offset: 2px;
    outline: none;
  }
  /* Bullet separating the spent cost from the held-requirement resources.
     Requirements share the same met (green) / short (red) coloring as the cost. */
  .cost-sep {
    color: var(--text-muted);
    display: inline-flex;
    align-items: center;
  }
  button {
    padding: 6px 16px;
    font-size: 15px;
    border: 1px solid var(--border);
    background: color-mix(in srgb, var(--accent) 22%, transparent);
    color: var(--text);
    border-radius: var(--radius);
    transition: background var(--transition);
    white-space: nowrap;
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

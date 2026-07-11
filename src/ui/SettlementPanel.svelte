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
  } from '../engine/selectors';
  import { formatNumber } from '../engine/numbers';
  import PersonStanding from '@lucide/svelte/icons/person-standing';

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

<section class="panel" data-nav="settlement">
  <div class="tier">
    <div class="info">
      <span class="name"><span class="lvl">Lvl {gs.level}</span> {tier?.name ?? `Level ${gs.level}`}</span>
      <span class="blurb">{tier?.blurb ?? ''}</span>
    </div>
    {#if next}
      <div class="action">
        <span class="cost">
          {#each costEntries(next.cost) as [rid, amt] (rid)}
            {@const met = gs.resources[rid].amount.gte(amt)}
            <span class="cost-item" class:short={!met} class:met>
              {formatNumber(amt)} {RESOURCES[rid].name}
            </span>
          {/each}
          {#if next.workersRequired}
            {@const met = gs.workers.trained >= next.workersRequired}
            <span class="cost-item" class:short={!met} class:met>
              {next.workersRequired} <PersonStanding
                size={13}
                color="var(--gold)"
                aria-hidden="true"
              /> trained
            </span>
          {/if}
          {#if next.requires}
            {#each costEntries(next.requires) as [rid, amt] (rid)}
              {@const met = gs.resources[rid].amount.gte(amt)}
              <span class="cost-item" class:short={!met} class:met>
                {formatNumber(amt)} {RESOURCES[rid].name}
              </span>
            {/each}
          {/if}
        </span>
        <button onclick={() => game.upgradeSettlement()} disabled={!canUpgradeSettlement(gs)}>
          Upgrade → {next.name}
        </button>
      </div>
    {:else}
      <span class="maxed">Largest settlement</span>
    {/if}
  </div>

  <div class="workers">
    <div class="info">
      <span class="name">Workers</span>
      <span class="blurb">{available} idle · {total} total</span>
    </div>
    <div class="action">
      <span class="cost">
        <span class="cost-item" class:short={!canTrainWorker(gs)}>
          {formatNumber(workerCost)} Food
        </span>
      </span>
      <button onclick={() => game.train()} disabled={!canTrainWorker(gs)}>Train worker</button>
    </div>
  </div>
</section>

<style>
  .panel {
    background: var(--bg-panel);
    border: var(--panel-border);
    border-radius: var(--panel-radius);
    box-shadow: var(--panel-shadow);
    padding: var(--panel-pad);
    animation: fadeIn var(--fade-in);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
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

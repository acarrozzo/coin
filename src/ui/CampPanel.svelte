<script lang="ts">
  import { game } from './gameStore.svelte';
  import { isAtCapacity } from '../engine/selectors';
  import { extraWorkerCost } from '../engine/actions';
  import { formatNumber } from '../engine/numbers';
  import Wheat from '@lucide/svelte/icons/wheat';
  import TreePine from '@lucide/svelte/icons/tree-pine';
  import Mountain from '@lucide/svelte/icons/mountain';
  import PersonStanding from '@lucide/svelte/icons/person-standing';

  const gs = $derived(game.state);
  // Working by hand matters until the Farm automates food (built at settlement 3).
  const showManual = $derived(gs.buildings.farm.level === 0);
  const showShop = $derived(gs.level >= 5);
  const recruitCost = $derived(extraWorkerCost(gs));
  const canRecruit = $derived(gs.resources.arrow.amount.gte(recruitCost));
</script>

{#if showManual || showShop}
  <section class="panel">
    {#if showManual}
      <h2>By Hand</h2>
      <p class="hint">Work the land yourself until your Farm and workforce take over.</p>
      <div class="actions">
        <button onclick={() => game.gather('food')} disabled={isAtCapacity(gs, 'food')}>
          <Wheat size={16} aria-hidden="true" /> Forage food
        </button>

        {#if gs.flags.hatchet}
          <button onclick={() => game.gather('wood')} disabled={isAtCapacity(gs, 'wood')}>
            <TreePine size={16} aria-hidden="true" /> Chop wood
          </button>
        {:else}
          <button
            onclick={() => game.buyTool('hatchet')}
            disabled={gs.resources.food.amount.lt(5)}
          >
            Fashion hatchet <span class="c">5 food</span>
          </button>
        {/if}

        {#if gs.flags.pickaxe}
          <button onclick={() => game.gather('stone')} disabled={isAtCapacity(gs, 'stone')}>
            <Mountain size={16} aria-hidden="true" /> Mine stone
          </button>
        {:else}
          <button
            onclick={() => game.buyTool('pickaxe')}
            disabled={gs.resources.wood.amount.lt(5)}
          >
            Fashion pickaxe <span class="c">5 wood</span>
          </button>
        {/if}
      </div>
    {/if}

    {#if showShop}
      <div class="shop" class:spaced={showManual}>
        <h2>Shop</h2>
        <p class="hint">Recruit an extra worker — paid in arrows, and costlier each time.</p>
        <div class="actions">
          <button onclick={() => game.recruit()} disabled={!canRecruit}>
            <PersonStanding size={16} aria-hidden="true" /> Recruit worker
            <span class="c" class:short={!canRecruit}>{formatNumber(recruitCost)} arrows</span>
          </button>
        </div>
      </div>
    {/if}
  </section>
{/if}

<style>
  .panel {
    background: var(--bg-panel);
    border: var(--panel-border);
    border-radius: var(--panel-radius);
    box-shadow: var(--panel-shadow);
    padding: var(--panel-pad);
    animation: fadeIn var(--fade-in);
  }
  h2 {
    font-size: 24px;
    font-family: var(--font-display);
    margin-bottom: var(--space-1);
  }
  .hint {
    color: var(--text-muted);
    font-size: 14px;
    margin-bottom: var(--space-3);
  }
  .shop.spaced {
    margin-top: var(--space-4);
    padding-top: var(--space-3);
    border-top: 1px solid var(--border);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    font-size: 15px;
    border: 1px solid var(--border);
    background: color-mix(in srgb, var(--accent) 18%, transparent);
    color: var(--text);
    border-radius: var(--radius);
    transition: background var(--transition);
  }
  button:hover:not(:disabled) {
    background: color-mix(in srgb, var(--accent) 36%, transparent);
  }
  button:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .c {
    color: var(--good);
    font-variant-numeric: tabular-nums;
  }
  .c.short {
    color: var(--bad);
  }
</style>

<script lang="ts">
  import { game } from './gameStore.svelte';
  import { extraWorkerCost } from '../engine/actions';
  import { formatNumber } from '../engine/numbers';
  import PersonStanding from '@lucide/svelte/icons/person-standing';
  import Store from '@lucide/svelte/icons/store';

  const gs = $derived(game.state);
  const recruitCost = $derived(extraWorkerCost(gs));
  const canRecruit = $derived(gs.resources.arrow.amount.gte(recruitCost));
</script>

<!-- The final main-content section: an always-visible panel matching the
     resource groups. data-nav lets the left rail scroll to it. -->
<section class="panel shop" data-nav="shop" aria-label="Shop">
  <header class="head">
    <Store size={22} color="var(--accent)" aria-hidden="true" />
    <h2>Shop</h2>
  </header>

  <p class="hint">Recruit an extra worker — paid in arrows, and costlier each time.</p>
  <div class="actions">
    <button class="buy" onclick={() => game.recruit()} disabled={!canRecruit}>
      <PersonStanding size={16} aria-hidden="true" /> Recruit worker
      <span class="c" class:short={!canRecruit}>{formatNumber(recruitCost)} arrows</span>
    </button>
  </div>
</section>

<style>
  .shop {
    background: var(--bg-panel);
    border: var(--panel-border);
    border-top: 3px solid var(--accent);
    border-radius: var(--panel-radius);
    box-shadow: var(--panel-shadow);
    padding: var(--panel-pad);
    animation: fadeIn var(--fade-in);
  }
  /* Settings can drop the colored accent strip; fall back to the plain frame. */
  :global(:root[data-accent-border='off']) .shop {
    border-top: var(--panel-border);
  }
  .head {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-1);
  }
  .head h2 {
    font-family: var(--font-display);
    font-size: 24px;
    color: var(--text);
  }
  .hint {
    color: var(--text-muted);
    font-size: 14px;
    margin-bottom: var(--space-3);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .buy {
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
  .buy:hover:not(:disabled) {
    background: color-mix(in srgb, var(--accent) 36%, transparent);
  }
  .buy:disabled {
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

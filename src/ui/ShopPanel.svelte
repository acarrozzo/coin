<script lang="ts">
  import { game } from './gameStore.svelte';
  import { extraWorkerCost } from '../engine/actions';
  import { formatNumber } from '../engine/numbers';
  import PersonStanding from '@lucide/svelte/icons/person-standing';
  import X from '@lucide/svelte/icons/x';

  let { onclose }: { onclose: () => void } = $props();

  const gs = $derived(game.state);
  const recruitCost = $derived(extraWorkerCost(gs));
  const canRecruit = $derived(gs.resources.arrow.amount.gte(recruitCost));
</script>

<aside class="side-panel shop-panel" aria-label="Shop">
  <div class="head">
    <h2>Shop</h2>
    <button class="close" onclick={onclose} title="Close shop" aria-label="Close shop">
      <X size={18} aria-hidden="true" />
    </button>
  </div>

  <div class="body">
    <section class="section">
      <p class="hint">Recruit an extra worker — paid in arrows, and costlier each time.</p>
      <div class="actions">
        <button class="buy" onclick={() => game.recruit()} disabled={!canRecruit}>
          <PersonStanding size={16} aria-hidden="true" /> Recruit worker
          <span class="c" class:short={!canRecruit}>{formatNumber(recruitCost)} arrows</span>
        </button>
      </div>
    </section>
  </div>
</aside>

<style>
  .side-panel {
    display: flex;
    flex-direction: column;
    background: var(--bg-panel);
    border: var(--panel-border);
    border-radius: var(--panel-radius);
    box-shadow: var(--panel-shadow);
    /* Desktop: a sticky column that scrolls independently, parked just below
       the sticky header — mirrors the Settings panel. */
    position: sticky;
    top: calc(var(--header-h, 56px) + var(--space-3));
    max-height: calc(100vh - var(--header-h, 56px) - var(--space-4));
    margin-top: var(--space-4);
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--border);
  }
  .head h2 {
    font-family: var(--font-display);
    font-size: 22px;
    color: var(--text);
  }
  .close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 0;
    color: var(--text-muted);
    padding: 4px;
    border-radius: var(--radius);
    cursor: pointer;
    transition: color var(--transition), background var(--transition);
  }
  .close:hover {
    color: var(--text);
    background: color-mix(in srgb, var(--text) 10%, transparent);
  }
  .body {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-4);
  }
  .section {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .hint {
    color: var(--text-muted);
    font-size: 14px;
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

  /* Below the split breakpoint, the panel detaches into a right-hand drawer
     that overlays the content — identical to the Settings drawer. */
  @media (max-width: 1023px) {
    .side-panel {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: min(380px, 92vw);
      max-height: none;
      margin-top: 0;
      z-index: 30;
      border: 0;
      border-left: 1px solid var(--border);
      border-radius: 0;
      box-shadow: -10px 0 30px rgba(0, 0, 0, 0.4);
      animation: drawerIn var(--transition);
    }
  }
  @keyframes drawerIn {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .side-panel {
      animation: none;
    }
  }
</style>

<script lang="ts">
  import { game } from './gameStore.svelte';
  import { formatNumber } from '../engine/numbers';
  import { RESOURCES } from '../content/resources';
  import {
    getNextSellTier,
    canSellTier,
    isRateUnlocked,
    canBuyRateUnlock,
    getNextWorkerContract,
    canBuyWorkerContract,
  } from '../engine/selectors';
  import {
    SELL_TIERS,
    SELLABLE_RESOURCES,
    RATE_UNLOCK_RESOURCES,
    RATE_UNLOCK_NUMERAL,
    RATE_UNLOCK_COST,
    WORKER_CONTRACTS,
    MAX_COIN_EARNED,
  } from '../content/market';
  import Store from '@lucide/svelte/icons/store';
  import Coins from '@lucide/svelte/icons/coins';
  import Gauge from '@lucide/svelte/icons/gauge';
  import PersonStanding from '@lucide/svelte/icons/person-standing';
  import HandCoins from '@lucide/svelte/icons/hand-coins';

  const gs = $derived(game.state);
  const coin = $derived(gs.resources.coin.amount);
  const nextContract = $derived(getNextWorkerContract(gs));
</script>

<!-- The Market: the coin economy. Sell weapons for coin, then spend it on
     rate-display unlocks and Worker Contracts. data-nav lets the rail scroll here. -->
<section class="panel market" data-nav="market" aria-label="Market">
  <header class="head">
    <Store size={22} color="var(--accent)" aria-hidden="true" />
    <h2>Market</h2>
    <span class="coins" title="Coin on hand — lifetime coin earned (of {MAX_COIN_EARNED} possible)">
      <Coins size={16} aria-hidden="true" />
      <span class="now">{formatNumber(coin)}</span>
      <span class="lifetime">{formatNumber(gs.market.coinEarned)}/{MAX_COIN_EARNED} earned</span>
    </span>
  </header>

  <!-- Sell weapons for coin — three one-time, escalating tiers each. -->
  <div class="block">
    <h3><HandCoins size={16} aria-hidden="true" /> Sell for coin</h3>
    <p class="hint">Each tier is a one-time sale. Stock is consumed.</p>
    <div class="actions">
      {#each SELLABLE_RESOURCES as id (id)}
        {@const tier = getNextSellTier(gs, id)}
        {@const done = gs.market.sellTier[id]}
        {@const ok = canSellTier(gs, id)}
        {#if tier}
          <button class="buy" onclick={() => game.sell(id)} disabled={!ok}>
            <span class="lbl">Sell {formatNumber(tier.amount)} {RESOURCES[id].name.toLowerCase()}s</span>
            <span class="c" class:short={!ok}>+{tier.coin} coin</span>
            <span class="sub">tier {done + 1} of {SELL_TIERS.length}</span>
          </button>
        {:else}
          <div class="buy done" aria-disabled="true">
            <span class="lbl">{RESOURCES[id].name}s — all sold</span>
            <span class="sub">3 of {SELL_TIERS.length} tiers</span>
          </div>
        {/if}
      {/each}
    </div>
  </div>

  <!-- Reveal the core resources' overall-rate displays. -->
  <div class="block">
    <h3><Gauge size={16} aria-hidden="true" /> Rate Displays</h3>
    <p class="hint">Unlock the live net-rate readout for each core resource — {RATE_UNLOCK_COST} coin each.</p>
    <div class="actions">
      {#each RATE_UNLOCK_RESOURCES as id (id)}
        {@const owned = isRateUnlocked(gs, id)}
        {@const ok = canBuyRateUnlock(gs, id)}
        {#if owned}
          <div class="buy done" aria-disabled="true">
            <span class="lbl">Rate Display {RATE_UNLOCK_NUMERAL[id]} — {RESOURCES[id].name}</span>
            <span class="sub">unlocked</span>
          </div>
        {:else}
          <button class="buy" onclick={() => game.unlockRate(id)} disabled={!ok}>
            <span class="lbl">Rate Display {RATE_UNLOCK_NUMERAL[id]} — {RESOURCES[id].name}</span>
            <span class="c" class:short={!ok}>{RATE_UNLOCK_COST} coin</span>
          </button>
        {/if}
      {/each}
    </div>
  </div>

  <!-- Worker Contracts — permanent bonus workers, bought in order. -->
  <div class="block">
    <h3><PersonStanding size={16} aria-hidden="true" /> Worker Contracts</h3>
    <p class="hint">Hire permanent workers with coin. Signed in order.</p>
    <div class="actions">
      {#if nextContract}
        {@const n = gs.market.workerContract + 1}
        {@const ok = canBuyWorkerContract(gs)}
        <button class="buy" onclick={() => game.buyWorkerContract()} disabled={!ok}>
          <span class="lbl"
            >Worker Contract {'I'.repeat(n)} — +{nextContract.workers} worker{nextContract.workers > 1
              ? 's'
              : ''}</span
          >
          <span class="c" class:short={!ok}>{nextContract.cost} coin</span>
        </button>
      {:else}
        <div class="buy done" aria-disabled="true">
          <span class="lbl">All {WORKER_CONTRACTS.length} contracts signed</span>
        </div>
      {/if}
    </div>
  </div>
</section>

<style>
  .market {
    background: var(--bg-panel);
    border: var(--panel-border);
    border-top: 3px solid var(--accent);
    border-radius: var(--panel-radius);
    box-shadow: var(--panel-shadow);
    padding: var(--panel-pad);
    animation: fadeIn var(--fade-in);
  }
  /* Settings can drop the colored accent strip; fall back to the plain frame. */
  :global(:root[data-accent-border='off']) .market {
    border-top: var(--panel-border);
  }
  .head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
    flex-wrap: wrap;
  }
  .head h2 {
    font-family: var(--font-display);
    font-size: 24px;
    color: var(--text);
  }
  .coins {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
    color: var(--gold);
    font-variant-numeric: tabular-nums;
  }
  .coins .now {
    font-size: 18px;
    font-weight: 600;
  }
  .coins .lifetime {
    color: var(--text-muted);
    font-size: 12px;
  }

  .block {
    padding-top: var(--space-3);
    margin-top: var(--space-3);
    border-top: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
  }
  .block:first-of-type {
    border-top: 0;
    margin-top: 0;
    padding-top: 0;
  }
  .block h3 {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-display);
    font-size: 17px;
    color: var(--text);
  }
  .hint {
    color: var(--text-muted);
    font-size: 13px;
    margin: 2px 0 var(--space-3);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .buy {
    display: inline-flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: 8px 14px;
    font-size: 15px;
    text-align: left;
    border: 1px solid var(--border);
    background: color-mix(in srgb, var(--accent) 18%, transparent);
    color: var(--text);
    border-radius: var(--radius);
    transition: background var(--transition);
  }
  button.buy:hover:not(:disabled) {
    background: color-mix(in srgb, var(--accent) 36%, transparent);
  }
  button.buy:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  /* A completed/exhausted entry: quiet, non-interactive. */
  .buy.done {
    background: color-mix(in srgb, var(--border) 30%, transparent);
    color: var(--text-muted);
  }
  .lbl {
    white-space: nowrap;
  }
  .c {
    color: var(--gold);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }
  .c.short {
    color: var(--bad);
  }
  .sub {
    color: var(--text-muted);
    font-size: 11px;
  }
</style>

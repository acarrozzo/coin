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
    canBuyFood,
  } from '../engine/selectors';
  import {
    SELL_TIER_DEFS,
    RATE_UNLOCK_RESOURCES,
    RATE_UNLOCK_NUMERAL,
    RATE_UNLOCK_COST,
    WORKER_CONTRACTS,
    MAX_COIN_EARNED,
    FOOD_PURCHASE_COST,
    FOOD_PURCHASE_AMOUNT,
    FOOD_PURCHASE_COUNT,
  } from '../content/market';
  import { FULL_MARKET_LEVEL } from './sections';
  import type { Component } from 'svelte';
  import type { SellableResource, RateUnlockResource } from '../content/market';
  import BuildingStore from './icons/BuildingStore.svelte';
  import Coins from './icons/Coins.svelte';
  import Gauge from '@lucide/svelte/icons/gauge';
  import Users from '@lucide/svelte/icons/users';
  import HandCoins from '@lucide/svelte/icons/hand-coins';
  import Check from '@lucide/svelte/icons/check';
  import TreePine from '@lucide/svelte/icons/tree-pine';
  import Mountain from '@lucide/svelte/icons/mountain';
  import Needle from './icons/Needle.svelte';
  import Trident from './icons/Trident.svelte';
  import Wheat from '@lucide/svelte/icons/wheat';

  // Button icons. Sells carry the stock's own resource icon; the coin sinks get
  // an icon for the thing they grant (food) or the feature they unlock.
  const SELL_ICON: Record<SellableResource, Component> = {
    wood: TreePine,
    stone: Mountain,
    arrow: Needle,
    spear: Trident,
  };

  // One line under each button's title. Flavour where the button is obvious,
  // plain explanation where it isn't (rate displays, contracts, food supplies).
  const SELL_QUIP: Record<SellableResource, string> = {
    wood: 'Timber is cheap. Coin is not.',
    stone: 'Heavy to haul, light to spend.',
    arrow: 'The fletchers have been busy.',
    spear: 'Pointy sticks at premium prices.',
  };
  const FOOD_QUIP = [
    'Rations to keep you going until the Farm turns over.',
    'One more sack. Do not eat it all at once.',
  ];
  const RATE_QUIP: Record<RateUnlockResource, string> = {
    wood: 'Shows live wood per second on its resource row.',
    stone: 'Shows live stone per second on its resource row.',
    food: 'Shows live food per second — spot a famine early.',
  };
  const CONTRACT_QUIP = [
    'A signature, a seal, and one new pair of hands.',
    'Word has spread. Two more sign on.',
    'Three at once. The realm is hiring.',
  ];

  const gs = $derived(game.state);
  const coin = $derived(gs.resources.coin.amount);
  const nextContract = $derived(getNextWorkerContract(gs));

  // Completion states
  const woodDone = $derived(gs.market.sellTier.wood >= SELL_TIER_DEFS.wood.length);
  const stoneDone = $derived(gs.market.sellTier.stone >= SELL_TIER_DEFS.stone.length);
  const arrowsDone = $derived(gs.market.sellTier.arrow >= SELL_TIER_DEFS.arrow.length);
  const spearsDone = $derived(gs.market.sellTier.spear >= SELL_TIER_DEFS.spear.length);
  const unlockedRates = $derived(RATE_UNLOCK_RESOURCES.filter((id) => isRateUnlocked(gs, id)));
  const signedContracts = $derived(WORKER_CONTRACTS.slice(0, gs.market.workerContract));

  // Active section visibility. Each section is split into its coin sells and its
  // coin buys, so the sub-rows are tracked separately from the section itself.
  const hasEarlySells = $derived(!woodDone || !stoneDone);
  const hasEarlyBuys = $derived(gs.market.foodBought < FOOD_PURCHASE_COUNT);
  const hasActiveEarly = $derived(hasEarlySells || hasEarlyBuys);
  const hasActiveAdvancedSells = $derived(gs.level >= FULL_MARKET_LEVEL && (!arrowsDone || !spearsDone));
  const hasActiveRates = $derived(gs.level >= FULL_MARKET_LEVEL && unlockedRates.length < RATE_UNLOCK_RESOURCES.length);
  const hasActiveContracts = $derived(gs.level >= FULL_MARKET_LEVEL && nextContract !== null);

  // Completed section visibility — same sell/buy split as the active sections.
  const doneEarlySells = $derived(woodDone || stoneDone);
  const doneEarlyBuys = $derived(gs.market.foodBought > 0);
  const doneAdvancedSells = $derived(arrowsDone || spearsDone);
  const doneAdvancedBuys = $derived(unlockedRates.length > 0 || signedContracts.length > 0);
  const hasEarlyCompleted = $derived(doneEarlySells || doneEarlyBuys);
  const hasAdvancedCompleted = $derived(
    gs.level >= FULL_MARKET_LEVEL && (doneAdvancedSells || doneAdvancedBuys),
  );
  const hasCompleted = $derived(hasEarlyCompleted || hasAdvancedCompleted);
</script>

<!-- The Market: the coin economy. Sell resources for coin, then spend it on
     food, rate-display unlocks, and Worker Contracts. data-nav lets the rail scroll here. -->
<section class="panel market" data-nav="market" aria-label="Market">
  <header class="head">
    <BuildingStore size={22} color="var(--accent)" aria-hidden="true" />
    <h2>Market</h2>
    <span class="coins" title="Coin on hand — lifetime coin earned (of {MAX_COIN_EARNED} possible)">
      <Coins size={16} aria-hidden="true" />
      <span class="now">{formatNumber(coin)}</span>
      <span class="lifetime">{formatNumber(gs.market.coinEarned)}/{MAX_COIN_EARNED} earned</span>
    </span>
  </header>

  <!-- 1-coin tier: active wood/stone sells + food buys. -->
  {#if hasActiveEarly}
  <div class="block">
    <h3><HandCoins size={16} aria-hidden="true" /> Early Market</h3>
    <p class="hint">One-time sales and food purchases — 1 coin each.</p>
    {#if hasEarlySells}
      <p class="sub-label">Sell</p>
      <div class="actions">
        {#if !woodDone}
          {@const tier = getNextSellTier(gs, 'wood')}
          {@const ok = canSellTier(gs, 'wood')}
          {#if tier}
            <button class="buy" onclick={() => game.sell('wood')} disabled={!ok}>
              <span class="bicon"><TreePine size={14} aria-hidden="true" /></span>
              <span class="buy-main">
                <span class="lbl">Sell {formatNumber(tier.amount)} woods</span>
                <span class="sub">{SELL_QUIP.wood}</span>
              </span>
              <span class="gain-pill" class:short={!ok}>+{tier.coin} coin</span>
            </button>
          {/if}
        {/if}
        {#if !stoneDone}
          {@const tier = getNextSellTier(gs, 'stone')}
          {@const ok = canSellTier(gs, 'stone')}
          {#if tier}
            <button class="buy" onclick={() => game.sell('stone')} disabled={!ok}>
              <span class="bicon"><Mountain size={14} aria-hidden="true" /></span>
              <span class="buy-main">
                <span class="lbl">Sell {formatNumber(tier.amount)} stones</span>
                <span class="sub">{SELL_QUIP.stone}</span>
              </span>
              <span class="gain-pill" class:short={!ok}>+{tier.coin} coin</span>
            </button>
          {/if}
        {/if}
      </div>
    {/if}
    {#if hasEarlyBuys}
      <p class="sub-label">Buy</p>
      <div class="actions">
        {#each { length: FOOD_PURCHASE_COUNT } as _, i (i)}
          {#if gs.market.foodBought <= i}
            {@const ok = canBuyFood(gs) && gs.market.foodBought === i}
            <button class="buy" onclick={() => game.buyFood()} disabled={!ok}>
              <span class="bicon"><Wheat size={14} aria-hidden="true" /></span>
              <span class="buy-main">
                <span class="lbl">Food Supply {i + 1} — {FOOD_PURCHASE_AMOUNT} food</span>
                <span class="sub">{FOOD_QUIP[i]}</span>
              </span>
              <span class="cost-pill" class:short={!ok}>-{FOOD_PURCHASE_COST} coin</span>
            </button>
          {/if}
        {/each}
      </div>
    {/if}
  </div>
  {/if}

  <!-- 10-coin tier: active arrow/spear sells. -->
  {#if hasActiveAdvancedSells}
  <div class="block">
    <h3><HandCoins size={16} aria-hidden="true" /> Advanced Market</h3>
    <p class="hint">Each tier is a one-time sale. Stock is consumed.</p>
    <p class="sub-label">Sell</p>
    <div class="actions">
      {#each (['arrow', 'spear'] as const) as id (id)}
        {#if !(id === 'arrow' ? arrowsDone : spearsDone)}
          {@const tier = getNextSellTier(gs, id)}
          {@const done = gs.market.sellTier[id]}
          {@const total = SELL_TIER_DEFS[id].length}
          {@const ok = canSellTier(gs, id)}
          {@const Icon = SELL_ICON[id]}
          {#if tier}
            <button class="buy" onclick={() => game.sell(id)} disabled={!ok}>
              <span class="bicon"><Icon size={14} aria-hidden="true" /></span>
              <span class="buy-main">
                <span class="lbl">Sell {formatNumber(tier.amount)} {RESOURCES[id].name.toLowerCase()}s</span>
                <span class="sub">{SELL_QUIP[id]} <span class="tier">· tier {done + 1} of {total}</span></span>
              </span>
              <span class="gain-pill" class:short={!ok}>+{tier.coin} coin</span>
            </button>
          {/if}
        {/if}
      {/each}
    </div>
  </div>
  {/if}

  <!-- Active rate displays. -->
  {#if hasActiveRates}
  <div class="block">
    <h3><Gauge size={16} aria-hidden="true" /> Rate Displays</h3>
    <p class="hint">Unlock the live net-rate readout for each core resource — {RATE_UNLOCK_COST} coin each.</p>
    <p class="sub-label">Buy</p>
    <div class="actions">
      {#each RATE_UNLOCK_RESOURCES as id (id)}
        {#if !isRateUnlocked(gs, id)}
          {@const ok = canBuyRateUnlock(gs, id)}
          <button class="buy" onclick={() => game.unlockRate(id)} disabled={!ok}>
            <span class="bicon"><Gauge size={14} aria-hidden="true" /></span>
            <span class="buy-main">
              <span class="lbl">Rate Display {RATE_UNLOCK_NUMERAL[id]} — {RESOURCES[id].name}</span>
              <span class="sub">{RATE_QUIP[id]}</span>
            </span>
            <span class="cost-pill" class:short={!ok}>-{RATE_UNLOCK_COST} coin</span>
          </button>
        {/if}
      {/each}
    </div>
  </div>
  {/if}

  <!-- Active worker contracts. -->
  {#if hasActiveContracts}
  <div class="block">
    <h3><Users size={16} aria-hidden="true" /> Worker Contracts</h3>
    <p class="hint">Hire permanent workers with coin. Signed in order.</p>
    <p class="sub-label">Buy</p>
    <div class="actions">
      {#if nextContract}
        {@const n = gs.market.workerContract + 1}
        {@const ok = canBuyWorkerContract(gs)}
        <button class="buy" onclick={() => game.buyWorkerContract()} disabled={!ok}>
          <span class="bicon"><Users size={14} aria-hidden="true" /></span>
          <span class="buy-main">
            <span class="lbl">Worker Contract {'I'.repeat(n)} — +{nextContract.workers} worker{nextContract.workers > 1 ? 's' : ''}</span>
            <span class="sub">{CONTRACT_QUIP[gs.market.workerContract]}</span>
          </span>
          <span class="cost-pill" class:short={!ok}>-{nextContract.cost} coin</span>
        </button>
      {/if}
    </div>
  </div>
  {/if}

  <!-- Completed items — all done purchases/sales, grouped by tier. -->
  {#if hasCompleted}
  <div class="block completed-block">
    <h3 class="completed-head">Completed</h3>

    {#if hasEarlyCompleted}
    <div class="tier-group">
      <p class="tier-label">Early Market</p>
      {#if doneEarlySells}
        <p class="sub-label">Sell</p>
        <div class="actions">
          {#if woodDone}
            {@const total = SELL_TIER_DEFS.wood[0]}
            <div class="done-item">
              <Check size={11} aria-hidden="true" />
              <span class="bicon"><TreePine size={11} aria-hidden="true" /></span>
              <span class="lbl">Sold {formatNumber(total.amount)} woods</span>
              <span class="sub">+{total.coin} coin</span>
            </div>
          {/if}
          {#if stoneDone}
            {@const total = SELL_TIER_DEFS.stone[0]}
            <div class="done-item">
              <Check size={11} aria-hidden="true" />
              <span class="bicon"><Mountain size={11} aria-hidden="true" /></span>
              <span class="lbl">Sold {formatNumber(total.amount)} stones</span>
              <span class="sub">+{total.coin} coin</span>
            </div>
          {/if}
        </div>
      {/if}
      {#if doneEarlyBuys}
        <p class="sub-label">Buy</p>
        <div class="actions">
          {#each { length: FOOD_PURCHASE_COUNT } as _, i (i)}
            {#if gs.market.foodBought > i}
              <div class="done-item">
                <Check size={11} aria-hidden="true" />
                <span class="bicon"><Wheat size={11} aria-hidden="true" /></span>
                <span class="lbl">Food Supply {i + 1} — {FOOD_PURCHASE_AMOUNT} food</span>
                <span class="sub">-{FOOD_PURCHASE_COST} coin</span>
              </div>
            {/if}
          {/each}
        </div>
      {/if}
    </div>
    {/if}

    {#if hasAdvancedCompleted}
    <div class="tier-group">
      <p class="tier-label">Advanced Market</p>
      {#if doneAdvancedSells}
        <p class="sub-label">Sell</p>
        <div class="actions">
          {#if arrowsDone}
            {@const total = SELL_TIER_DEFS.arrow.length}
            <div class="done-item">
              <Check size={11} aria-hidden="true" />
              <span class="bicon"><Needle size={11} aria-hidden="true" /></span>
              <span class="lbl">Arrows — all {total} tiers sold</span>
            </div>
          {/if}
          {#if spearsDone}
            {@const total = SELL_TIER_DEFS.spear.length}
            <div class="done-item">
              <Check size={11} aria-hidden="true" />
              <span class="bicon"><Trident size={11} aria-hidden="true" /></span>
              <span class="lbl">Spears — all {total} tiers sold</span>
            </div>
          {/if}
        </div>
      {/if}
      {#if doneAdvancedBuys}
        <p class="sub-label">Buy</p>
        <div class="actions">
          {#each unlockedRates as id (id)}
            <div class="done-item">
              <Check size={11} aria-hidden="true" />
              <span class="bicon"><Gauge size={11} aria-hidden="true" /></span>
              <span class="lbl">Rate Display {RATE_UNLOCK_NUMERAL[id]} — {RESOURCES[id].name}</span>
              <span class="sub">-{RATE_UNLOCK_COST} coin</span>
            </div>
          {/each}
          {#each signedContracts as contract, i (i)}
            <div class="done-item">
              <Check size={11} aria-hidden="true" />
              <span class="bicon"><Users size={11} aria-hidden="true" /></span>
              <span class="lbl">Worker Contract {'I'.repeat(i + 1)} — +{contract.workers} worker{contract.workers > 1 ? 's' : ''}</span>
              <span class="sub">-{contract.cost} coin</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
    {/if}
  </div>
  {/if}
</section>

<style>
  .market {
    padding: var(--panel-pad);
    animation: fadeIn var(--fade-in);
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
  /* Sell / Buy divider inside a section. */
  .sub-label {
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin: var(--space-3) 0 6px;
  }
  /* The first sub-row sits directly under the section's hint / tier label, which
     already spaces itself. (:first-of-type can't be used — .hint and .tier-label
     are <p> siblings too.) */
  .hint + .sub-label,
  .tier-label + .sub-label {
    margin-top: 0;
  }
  .buy {
    display: inline-flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    gap: 10px;
    padding: 8px 10px 8px 12px;
    font-size: 15px;
    text-align: left;
    border: 1px solid var(--border);
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    color: var(--text);
    border-radius: var(--radius);
    transition: background var(--transition);
  }
  button.buy:hover:not(:disabled) {
    background: color-mix(in srgb, var(--accent) 28%, transparent);
  }
  /* Unaffordable buttons stay at full opacity — the label has to remain legible
     so you can read what you're working toward. The flattened background plus
     the red cost/gain pill carry the "can't do this yet" signal instead. */
  button.buy:disabled {
    background: transparent;
    border-color: color-mix(in srgb, var(--border) 60%, transparent);
    cursor: not-allowed;
  }
  button.buy:disabled .bicon {
    color: var(--text-muted);
  }
  .buy-main {
    display: flex;
    flex-direction: column;
    gap: 2px;
    align-items: flex-start;
  }
  .lbl {
    white-space: nowrap;
    font-weight: 500;
  }
  .sub {
    color: var(--text-muted);
    font-size: 11px;
  }
  /* The quip line is the only thing here allowed to wrap — .lbl stays on one
     line, so a long quip widens the button rather than stretching the row. */
  .buy-main .sub {
    white-space: normal;
    max-width: 46ch;
  }
  /* Tier counter, trailing the quip. */
  .tier {
    opacity: 0.7;
  }
  /* Small resource/feature icon leading each button and completed pill. */
  .bicon {
    display: inline-flex;
    align-items: center;
    color: var(--accent);
    flex-shrink: 0;
  }
  .done-item .bicon {
    color: inherit;
  }
  /* Two pills, deliberately different: coin you PAY reads gold (.cost-pill, on
     every buy), coin you RECEIVE reads green (.gain-pill, on every sell). Same
     shape and position, so the only thing that changes is the direction of the
     coin. Both turn red when the button can't be pressed. */
  .cost-pill,
  .gain-pill {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .cost-pill {
    background: color-mix(in srgb, var(--gold) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--gold) 28%, transparent);
    color: var(--gold);
  }
  .gain-pill {
    background: color-mix(in srgb, var(--good) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--good) 32%, transparent);
    color: var(--good);
  }
  .cost-pill.short,
  .gain-pill.short {
    background: color-mix(in srgb, var(--bad) 10%, transparent);
    border-color: color-mix(in srgb, var(--bad) 25%, transparent);
    color: var(--bad);
  }

  /* Completed section */
  .completed-block {
    opacity: 0.6;
  }
  .completed-head {
    font-family: var(--font-display);
    font-size: 14px;
    color: var(--text-muted);
    margin-bottom: var(--space-2);
  }
  .tier-label {
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin: var(--space-2) 0 6px;
  }
  .tier-label:first-of-type {
    margin-top: 0;
  }
  .tier-group + .tier-group {
    margin-top: var(--space-3);
  }
  .done-item {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px 4px 7px;
    font-size: 12px;
    color: var(--text-muted);
    border-radius: 999px;
    background: color-mix(in srgb, var(--border) 22%, transparent);
    border: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
    flex-direction: row;
    flex-wrap: nowrap;
  }
  .done-item .lbl {
    white-space: nowrap;
  }
  .done-item .sub {
    font-size: 11px;
    opacity: 0.6;
    white-space: nowrap;
  }
</style>

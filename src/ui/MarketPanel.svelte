<script lang="ts">
  import { game } from './gameStore.svelte';
  import { formatNumber, D } from '../engine/numbers';
  import { RESOURCES } from '../content/resources';
  import {
    getSellOffer,
    canSell,
    isSellUnlocked,
    isFullMarketOpen,
    isRateUnlocked,
    canBuyRateUnlock,
    canBuyWorkerContract,
    canBuyFood,
    countSellOpportunities,
    countBuyOpportunities,
  } from '../engine/selectors';
  import {
    SELL_OFFERS,
    SELLABLE_RESOURCES,
    RATE_UNLOCK_RESOURCES,
    RATE_UNLOCK_COST,
    WORKER_CONTRACTS,
    WORKER_CONTRACT_IDS,
    MAX_COIN_EARNED,
    FOOD_PURCHASE_COST,
    FOOD_PURCHASE_AMOUNT,
    FULL_MARKET_LEVEL,
  } from '../content/market';
  import type { Component } from 'svelte';
  import type { SellableResource, RateUnlockResource } from '../content/market';
  import MarketOffer from './MarketOffer.svelte';
  import BuildingStore from './icons/BuildingStore.svelte';
  import Coins from './icons/Coins.svelte';
  import Gauge from '@lucide/svelte/icons/gauge';
  import Users from '@lucide/svelte/icons/users';
  import Check from '@lucide/svelte/icons/check';
  import TreePine from '@lucide/svelte/icons/tree-pine';
  import Mountain from '@lucide/svelte/icons/mountain';
  import Needle from './icons/Needle.svelte';
  import Trident from './icons/Trident.svelte';
  import Wheat from '@lucide/svelte/icons/wheat';

  // Offer icons. Sells carry the stock's own resource icon; the coin sinks get
  // an icon for the thing they grant (food) or the feature they unlock.
  const SELL_ICON: Record<SellableResource, Component> = {
    wood: TreePine,
    stone: Mountain,
    arrow: Needle,
    spear: Trident,
  };

  // One flavour line per offer.
  const SELL_QUIP: Record<SellableResource, string> = {
    wood: 'Timber is cheap. Coin is not.',
    stone: 'Heavy to haul, light to spend.',
    arrow: 'The fletchers have been busy.',
    spear: 'Pointy sticks at premium prices.',
  };
  const FOOD_QUIP = 'Rations to keep you going until the Farm turns over.';
  const RATE_QUIP: Record<RateUnlockResource, string> = {
    wood: 'Know the timber flow at a glance.',
    stone: 'Know what the quarry really yields.',
    food: 'Spot a famine before it starts.',
  };
  const CONTRACT_QUIP: Record<string, string> = {
    i: 'A signature, a seal, and one new pair of hands.',
    ii: 'Word has spread. Two more sign on.',
    iii: 'Three at once. The realm is hiring.',
  };

  const gs = $derived(game.state);
  const coin = $derived(gs.resources.coin.amount);
  const sold = $derived(gs.market.sold);

  // Tab badges: how many offers can actually be acted on right now. Level-gated
  // offers never count — the same two selectors drive the rail's alert dot.
  const sellCount = $derived(countSellOpportunities(gs));
  const buyCount = $derived(countBuyOpportunities(gs));

  const openSells = $derived(SELLABLE_RESOURCES.filter((id) => !sold[id]));
  const unlockedRates = $derived(RATE_UNLOCK_RESOURCES.filter((id) => isRateUnlocked(gs, id)));
  const openRates = $derived(RATE_UNLOCK_RESOURCES.filter((id) => !isRateUnlocked(gs, id)));
  const signedContracts = $derived(WORKER_CONTRACT_IDS.filter((id) => gs.market.contracts[id]));
  const openContracts = $derived(WORKER_CONTRACT_IDS.filter((id) => !gs.market.contracts[id]));
  const hasOpenBuys = $derived(
    !gs.market.foodBought || openRates.length > 0 || openContracts.length > 0,
  );

  // Completed offers, per tab — each tab carries its own filtered ledger.
  const soldCount = $derived(SELLABLE_RESOURCES.filter((id) => sold[id]).length);
  const boughtCount = $derived(
    (gs.market.foodBought ? 1 : 0) + unlockedRates.length + signedContracts.length,
  );

  type Tab = 'sell' | 'buy';
  // Which tab the player last chose. Null means "haven't chosen" — fall back to
  // Sell unless every sale is taken, so a late-game return doesn't always land
  // on an empty tab. Deliberately not persisted: it's view state, not progress.
  let chosen = $state<Tab | null>(null);
  const tab = $derived<Tab>(chosen ?? (openSells.length > 0 ? 'sell' : 'buy'));

  const TABS: { id: Tab; label: string }[] = [
    { id: 'sell', label: 'Sell' },
    { id: 'buy', label: 'Buy' },
  ];

  /** Left/right arrows move between tabs, per the tablist pattern. */
  function onTabKey(e: KeyboardEvent): void {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    chosen = tab === 'sell' ? 'buy' : 'sell';
  }
</script>

<!-- Every sale is the same offer shape, so one snippet covers all four. The
     level gate is per-offer data, so a locked sale still shows what it will be. -->
{#snippet sellOffer(id: SellableResource)}
  {@const offer = getSellOffer(gs, id)}
  {#if offer}
    {@const have = gs.resources[id].amount}
    {@const locked = isSellUnlocked(gs, id)
      ? undefined
      : `Requires Settlement Level ${offer.minLevel}`}
    {@const ok = !locked && canSell(gs, id)}
    {@const noun = offer.noun}
    <MarketOffer
      icon={SELL_ICON[id]}
      title="{noun[0].toUpperCase() + noun.slice(1)} Needed"
      kind="trade"
      give="{formatNumber(offer.amount)} {noun}"
      receive="+{formatNumber(offer.coin)} coin"
      quip={SELL_QUIP[id]}
      stock={{ have, need: offer.amount, noun }}
      {locked}
      affordable={ok}
      actionLabel={locked
        ? `Level ${offer.minLevel}`
        : ok
          ? `Sell for ${formatNumber(offer.coin)}`
          : `Need ${formatNumber(D(offer.amount).sub(have))} more`}
      onact={() => game.sell(id)}
    />
  {/if}
{/snippet}

<!-- A completed offer, as a ledger pill. -->
{#snippet done(Icon: Component, label: string, sub?: string)}
  <div class="done-item">
    <Check size={11} aria-hidden="true" />
    <span class="bicon"><Icon size={11} aria-hidden="true" /></span>
    <span class="lbl">{label}</span>
    {#if sub}<span class="sub">{sub}</span>{/if}
  </div>
{/snippet}

<!-- The Market: the coin economy, split into Sell and Buy. Every offer here is
     taken at most once. data-nav lets the rail scroll here. -->
<section class="panel market" data-nav="market" aria-label="Market">
  <header class="head">
    <BuildingStore size={22} color="var(--accent)" aria-hidden="true" />
    <h2>Market</h2>
    <span
      class="coins"
      title="Coin on hand — lifetime coin earned (of {formatNumber(MAX_COIN_EARNED)} possible)"
    >
      <Coins size={16} aria-hidden="true" />
      <span class="now">{formatNumber(coin)}</span>
      <span class="lifetime"
        >{formatNumber(gs.market.coinEarned)}/{formatNumber(MAX_COIN_EARNED)} earned</span
      >
    </span>
  </header>

  <!-- Sub-tabs. The badge counts what can be acted on right now, so a zero is
       meaningful ("nothing here yet") rather than noise — it stays, recessed. -->
  <div class="tabs" role="tablist" aria-label="Market sections">
    {#each TABS as t (t.id)}
      {@const count = t.id === 'sell' ? sellCount : buyCount}
      <button
        type="button"
        role="tab"
        id="market-tab-{t.id}"
        aria-selected={tab === t.id}
        aria-controls="market-panel-{t.id}"
        tabindex={tab === t.id ? 0 : -1}
        class:active={tab === t.id}
        onclick={() => (chosen = t.id)}
        onkeydown={onTabKey}
      >
        {t.label}
        <span class="badge" class:live={count > 0} aria-label="{count} available">{count}</span>
      </button>
    {/each}
  </div>

  {#if tab === 'sell'}
    <div
      class="tab-panel"
      role="tabpanel"
      id="market-panel-sell"
      aria-labelledby="market-tab-sell"
      tabindex="-1"
    >
      <!-- Flat: there are only ever four sales, so section headers would be
           overhead. The level gate lives on the locked card instead. -->
      {#if openSells.length}
        <div class="actions">
          {#each openSells as id (id)}{@render sellOffer(id)}{/each}
        </div>
      {:else}
        <p class="empty">The merchant needs nothing more.</p>
      {/if}

      {#if soldCount > 0}
        <details class="ledger">
          <summary>
            <span class="ledger-title">Unlock Ledger</span>
            <span class="ledger-count">{soldCount} sold</span>
          </summary>
          <div class="ledger-body">
            <div class="done-list">
              {#each SELLABLE_RESOURCES as id (id)}
                {#if sold[id]}
                  {@const o = SELL_OFFERS[id]}
                  {@render done(
                    SELL_ICON[id],
                    `Sold ${formatNumber(o.amount)} ${o.noun}`,
                    `+${o.coin} coin`,
                  )}
                {/if}
              {/each}
            </div>
          </div>
        </details>
      {/if}
    </div>
  {:else}
    <div
      class="tab-panel"
      role="tabpanel"
      id="market-panel-buy"
      aria-labelledby="market-tab-buy"
      tabindex="-1"
    >
      {#if hasOpenBuys}
        {#if !gs.market.foodBought}
          {@const ok = canBuyFood(gs)}
          <div class="group">
            <h3>Provisions</h3>
            <div class="actions">
              <MarketOffer
                icon={Wheat}
                title="Emergency Food Supply"
                kind="buy"
                benefit="+{FOOD_PURCHASE_AMOUNT} food"
                cost="−{FOOD_PURCHASE_COST} coin"
                quip={FOOD_QUIP}
                stock={{ have: coin, need: FOOD_PURCHASE_COST, noun: 'coin' }}
                affordable={ok}
                actionLabel={ok ? 'Buy food' : `Need ${FOOD_PURCHASE_COST} coin`}
                onact={() => game.buyFood()}
              />
            </div>
          </div>
        {/if}

        {#if openRates.length}
          {@const lock = isFullMarketOpen(gs)
            ? undefined
            : `Requires Settlement Level ${FULL_MARKET_LEVEL}`}
          <div class="group">
            <h3>Rate Displays</h3>
            <div class="actions">
              {#each openRates as id (id)}
                {@const ok = !lock && canBuyRateUnlock(gs, id)}
                <MarketOffer
                  icon={Gauge}
                  title="{RESOURCES[id].name} Rate Display"
                  kind="buy"
                  benefit="Live {RESOURCES[id].name.toLowerCase()} / sec"
                  cost="−{RATE_UNLOCK_COST} coin"
                  quip={RATE_QUIP[id]}
                  stock={{ have: coin, need: RATE_UNLOCK_COST, noun: 'coin' }}
                  locked={lock}
                  affordable={ok}
                  actionLabel={lock
                    ? `Level ${FULL_MARKET_LEVEL}`
                    : ok
                      ? 'Unlock'
                      : `Need ${RATE_UNLOCK_COST} coin`}
                  onact={() => game.unlockRate(id)}
                />
              {/each}
            </div>
          </div>
        {/if}

        {#if openContracts.length}
          {@const lock = isFullMarketOpen(gs)
            ? undefined
            : `Requires Settlement Level ${FULL_MARKET_LEVEL}`}
          <div class="group">
            <h3>Worker Contracts</h3>
            <div class="actions">
              {#each openContracts as id (id)}
                {@const contract = WORKER_CONTRACTS[id]}
                {@const ok = !lock && canBuyWorkerContract(gs, id)}
                <MarketOffer
                  icon={Users}
                  title="Worker Contract {contract.numeral}"
                  kind="buy"
                  benefit="+{contract.workers} permanent worker{contract.workers > 1 ? 's' : ''}"
                  cost="−{formatNumber(contract.cost)} coin"
                  quip={CONTRACT_QUIP[id]}
                  stock={{ have: coin, need: contract.cost, noun: 'coin' }}
                  locked={lock}
                  affordable={ok}
                  actionLabel={lock
                    ? `Level ${FULL_MARKET_LEVEL}`
                    : ok
                      ? `Hire ×${contract.workers}`
                      : `Need ${formatNumber(contract.cost)} coin`}
                  onact={() => game.buyWorkerContract(id)}
                />
              {/each}
            </div>
          </div>
        {/if}
      {:else}
        <p class="empty">Nothing left to buy.</p>
      {/if}

      {#if boughtCount > 0}
        <details class="ledger">
          <summary>
            <span class="ledger-title">Unlock Ledger</span>
            <span class="ledger-count">{boughtCount} purchased</span>
          </summary>
          <div class="ledger-body">
            <div class="done-list">
              {#if gs.market.foodBought}
                {@render done(
                  Wheat,
                  `Emergency Food Supply — ${FOOD_PURCHASE_AMOUNT} food`,
                  `-${FOOD_PURCHASE_COST} coin`,
                )}
              {/if}
              {#each unlockedRates as id (id)}
                {@render done(
                  Gauge,
                  `${RESOURCES[id].name} Rate Display`,
                  `-${RATE_UNLOCK_COST} coin`,
                )}
              {/each}
              {#each signedContracts as id (id)}
                {@const c = WORKER_CONTRACTS[id]}
                {@render done(
                  Users,
                  `Worker Contract ${c.numeral} — +${c.workers} worker${c.workers > 1 ? 's' : ''}`,
                  `-${c.cost} coin`,
                )}
              {/each}
            </div>
          </div>
        </details>
      {/if}
    </div>
  {/if}
</section>

<style>
  /* Framed like the structure cards in ResourcePanel and the Combat panel, so
     every zone on the page reads as the same kind of object. */
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
    margin-bottom: var(--space-2);
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

  /* Sub-tabs: an underlined rail rather than boxed buttons, so they read as a
     division of the panel below rather than as two more things to press. */
  .tabs {
    display: flex;
    gap: var(--space-3);
    border-bottom: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
    margin-bottom: var(--space-3);
  }
  .tabs button {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 7px 2px 8px;
    margin-bottom: -1px;
    background: none;
    border: 0;
    border-bottom: 2px solid transparent;
    font-family: var(--font-display);
    font-size: 17px;
    color: var(--text-muted);
    cursor: pointer;
    transition:
      color var(--transition),
      border-color var(--transition);
  }
  .tabs button:hover {
    color: var(--text);
  }
  .tabs button.active {
    color: var(--text);
    border-bottom-color: var(--accent);
  }
  .tabs button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  /* A zero still shows — "2 here, 0 there" is the useful comparison — but it
     recedes to a plain muted digit, and only a live count takes the gold. */
  .badge {
    min-width: 17px;
    padding: 1px 5px;
    border-radius: 999px;
    font-family: var(--font-body);
    font-size: 11px;
    font-weight: 700;
    line-height: 1.45;
    text-align: center;
    color: color-mix(in srgb, var(--text-muted) 70%, transparent);
    background: transparent;
    font-variant-numeric: tabular-nums;
  }
  .badge.live {
    color: var(--bg);
    background: var(--gold);
  }

  .tab-panel:focus {
    outline: none;
  }

  /* Buy groups. Sell has none — four cards need no headers. */
  .group + .group {
    margin-top: var(--space-3);
    padding-top: var(--space-3);
    border-top: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
  }
  .group h3 {
    font-family: var(--font-display);
    font-size: 16px;
    color: var(--text);
  }
  /* Offers are cards on a responsive grid — as many per row as the panel can
     fit at a readable width, reflowing on narrow screens without a breakpoint.
     `stretch` keeps every card in a row the same height so their pinned action
     buttons land on one line. */
  .actions {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(258px, 1fr));
    align-items: stretch;
    gap: 8px;
    margin-top: 7px;
  }
  .empty {
    margin: 0;
    padding: var(--space-3) 0;
    color: var(--text-muted);
    font-size: 13px;
  }

  /* Completed ledger — one per tab, filtered to that tab's offers. */
  .ledger {
    margin-top: var(--space-3);
    padding-top: var(--space-3);
    border-top: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
  }
  .ledger summary {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    cursor: pointer;
    color: var(--text-muted);
    list-style: none;
  }
  .ledger summary::-webkit-details-marker {
    display: none;
  }
  /* Own disclosure caret, so the row matches the panel's type rather than the
     browser's default triangle. */
  .ledger summary::after {
    content: '▾';
    font-size: 11px;
    transition: transform var(--transition);
  }
  .ledger[open] summary::after {
    transform: rotate(180deg);
  }
  .ledger summary:hover {
    color: var(--text);
  }
  .ledger-title {
    font-family: var(--font-display);
    font-size: 14px;
  }
  .ledger-count {
    font-size: 11px;
    opacity: 0.8;
    font-variant-numeric: tabular-nums;
  }
  .ledger-body {
    margin-top: var(--space-2);
    opacity: 0.6;
  }
  .done-list {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .done-item {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px 3px 6px;
    font-size: 11px;
    color: var(--text-muted);
    border-radius: 999px;
    background: color-mix(in srgb, var(--border) 22%, transparent);
    border: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
    flex-direction: row;
    flex-wrap: nowrap;
  }
  .done-item .bicon {
    display: inline-flex;
    align-items: center;
    color: inherit;
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

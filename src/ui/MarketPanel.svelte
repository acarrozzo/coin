<script lang="ts">
  import { game } from './gameStore.svelte';
  import { formatNumber, D } from '../engine/numbers';
  import { RESOURCES } from '../content/resources';
  import {
    getSellOffer,
    canSell,
    isRateUnlocked,
    canBuyRateUnlock,
    canBuyWorkerContract,
    canBuyFood,
  } from '../engine/selectors';
  import {
    SELL_OFFERS,
    RATE_UNLOCK_RESOURCES,
    RATE_UNLOCK_COST,
    WORKER_CONTRACTS,
    WORKER_CONTRACT_IDS,
    MAX_COIN_EARNED,
    FOOD_PURCHASE_COST,
    FOOD_PURCHASE_AMOUNT,
  } from '../content/market';
  import { FULL_MARKET_LEVEL } from './sections';
  import type { Component } from 'svelte';
  import type { SellableResource, RateUnlockResource } from '../content/market';
  import MarketOffer from './MarketOffer.svelte';
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

  // Offer icons. Sells carry the stock's own resource icon; the coin sinks get
  // an icon for the thing they grant (food) or the feature they unlock.
  const SELL_ICON: Record<SellableResource, Component> = {
    wood: TreePine,
    stone: Mountain,
    arrow: Needle,
    spear: Trident,
  };

  // One flavour line per offer. Flavour where the offer is obvious, plain
  // explanation where it isn't (rate displays, contracts, the food supply).
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

  // Level-gated offers stay on the board as locked cards rather than vanishing,
  // so the coin economy reads as a full ladder from the first minute.
  const advancedLock = $derived(
    gs.level < FULL_MARKET_LEVEL ? `Requires Settlement Level ${FULL_MARKET_LEVEL}` : undefined,
  );

  const sold = $derived(gs.market.sold);
  const unlockedRates = $derived(RATE_UNLOCK_RESOURCES.filter((id) => isRateUnlocked(gs, id)));
  const signedContracts = $derived(WORKER_CONTRACT_IDS.filter((id) => gs.market.contracts[id]));
  const openContracts = $derived(WORKER_CONTRACT_IDS.filter((id) => !gs.market.contracts[id]));

  // Active section visibility. Each section is split into its coin sells and its
  // coin buys, so the sub-rows are tracked separately from the section itself.
  // A section only disappears once its offers are taken — never because of the
  // level gate, which is expressed per card.
  const hasEarlySells = $derived(!sold.wood || !sold.stone);
  const hasEarlyBuys = $derived(!gs.market.foodBought);
  const hasActiveEarly = $derived(hasEarlySells || hasEarlyBuys);
  const hasActiveAdvancedSells = $derived(!sold.arrow || !sold.spear);
  const hasActiveRates = $derived(unlockedRates.length < RATE_UNLOCK_RESOURCES.length);

  // Completed section visibility — same sell/buy split as the active sections.
  const doneEarlySells = $derived(sold.wood || sold.stone);
  const doneEarlyBuys = $derived(gs.market.foodBought);
  const doneAdvancedSells = $derived(sold.arrow || sold.spear);
  const doneAdvancedBuys = $derived(unlockedRates.length > 0 || signedContracts.length > 0);
  const hasEarlyCompleted = $derived(doneEarlySells || doneEarlyBuys);
  const hasAdvancedCompleted = $derived(doneAdvancedSells || doneAdvancedBuys);
  const hasCompleted = $derived(hasEarlyCompleted || hasAdvancedCompleted);
  const completedCount = $derived(
    (sold.wood ? 1 : 0) +
      (sold.stone ? 1 : 0) +
      (sold.arrow ? 1 : 0) +
      (sold.spear ? 1 : 0) +
      (gs.market.foodBought ? 1 : 0) +
      unlockedRates.length +
      signedContracts.length,
  );
</script>

<!-- Every sale is the same offer shape, so one snippet covers all four
     resources; the caller supplies the level gate (or nothing). -->
{#snippet sellOffer(id: SellableResource, locked: string | undefined)}
  {@const offer = getSellOffer(gs, id)}
  {#if offer}
    {@const have = gs.resources[id].amount}
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
        ? `Level ${FULL_MARKET_LEVEL}`
        : ok
          ? `Sell for ${formatNumber(offer.coin)}`
          : `Need ${formatNumber(D(offer.amount).sub(have))} more`}
      onact={() => game.sell(id)}
    />
  {/if}
{/snippet}

<!-- The Market: the coin economy. Sell resources for coin, then spend it on
     food, rate-display unlocks, and Worker Contracts. Every offer here is taken
     at most once. data-nav lets the rail scroll here. -->
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

  <!-- 1-coin tier: wood/stone sells + the food purchase. -->
  {#if hasActiveEarly}
    <div class="block">
      <h3><HandCoins size={16} aria-hidden="true" /> Early Market</h3>
      <p class="hint">One-time sales and a food purchase — 1 coin each.</p>
      {#if hasEarlySells}
        <p class="sub-label">Sell</p>
        <div class="actions">
          {#if !sold.wood}{@render sellOffer('wood', undefined)}{/if}
          {#if !sold.stone}{@render sellOffer('stone', undefined)}{/if}
        </div>
      {/if}
      {#if hasEarlyBuys}
        {@const ok = canBuyFood(gs)}
        <p class="sub-label">Buy</p>
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
      {/if}
    </div>
  {/if}

  <!-- 10-coin tier: arrow/spear sells. Locked below FULL_MARKET_LEVEL. -->
  {#if hasActiveAdvancedSells}
    <div class="block">
      <h3><HandCoins size={16} aria-hidden="true" /> Advanced Market</h3>
      <p class="hint">One sale per resource. The stock is consumed.</p>
      <p class="sub-label">Sell</p>
      <div class="actions">
        {#if !sold.arrow}{@render sellOffer('arrow', advancedLock)}{/if}
        {#if !sold.spear}{@render sellOffer('spear', advancedLock)}{/if}
      </div>
    </div>
  {/if}

  <!-- Rate displays. -->
  {#if hasActiveRates}
    <div class="block">
      <h3><Gauge size={16} aria-hidden="true" /> Rate Displays</h3>
      <p class="hint">
        Unlock the live net-rate readout for each core resource — {RATE_UNLOCK_COST} coin each.
      </p>
      <p class="sub-label">Buy</p>
      <div class="actions">
        {#each RATE_UNLOCK_RESOURCES as id (id)}
          {#if !isRateUnlocked(gs, id)}
            {@const ok = !advancedLock && canBuyRateUnlock(gs, id)}
            <MarketOffer
              icon={Gauge}
              title="{RESOURCES[id].name} Rate Display"
              kind="buy"
              benefit="Live {RESOURCES[id].name.toLowerCase()} / sec"
              cost="−{RATE_UNLOCK_COST} coin"
              quip={RATE_QUIP[id]}
              stock={{ have: coin, need: RATE_UNLOCK_COST, noun: 'coin' }}
              locked={advancedLock}
              affordable={ok}
              actionLabel={advancedLock
                ? `Level ${FULL_MARKET_LEVEL}`
                : ok
                  ? 'Unlock'
                  : `Need ${RATE_UNLOCK_COST} coin`}
              onact={() => game.unlockRate(id)}
            />
          {/if}
        {/each}
      </div>
    </div>
  {/if}

  <!-- Worker contracts — three independent hires, offered together. -->
  {#if openContracts.length}
    <div class="block">
      <h3><Users size={16} aria-hidden="true" /> Worker Contracts</h3>
      <p class="hint">Hire permanent workers with coin. Sign them in any order.</p>
      <p class="sub-label">Buy</p>
      <div class="actions">
        {#each openContracts as id (id)}
          {@const contract = WORKER_CONTRACTS[id]}
          {@const ok = !advancedLock && canBuyWorkerContract(gs, id)}
          <MarketOffer
            icon={Users}
            title="Worker Contract {contract.numeral}"
            kind="buy"
            benefit="+{contract.workers} permanent worker{contract.workers > 1 ? 's' : ''}"
            cost="−{formatNumber(contract.cost)} coin"
            quip={CONTRACT_QUIP[id]}
            stock={{ have: coin, need: contract.cost, noun: 'coin' }}
            locked={advancedLock}
            affordable={ok}
            actionLabel={advancedLock
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

  <!-- Everything already taken, collapsed into a ledger so finished offers stay
       available as history rather than sitting on the board as dead cards. -->
  {#if hasCompleted}
    <div class="block">
      <details class="ledger">
        <summary>
          <span class="ledger-title">Unlock Ledger</span>
          <span class="ledger-count">{completedCount} completed</span>
        </summary>

        <div class="ledger-body">
          {#if hasEarlyCompleted}
            <div class="tier-group">
              <p class="tier-label">Early Market</p>
              {#if doneEarlySells}
                <p class="sub-label">Sell</p>
                <div class="done-list">
                  {#if sold.wood}
                    <div class="done-item">
                      <Check size={11} aria-hidden="true" />
                      <span class="bicon"><TreePine size={11} aria-hidden="true" /></span>
                      <span class="lbl"
                        >Sold {formatNumber(SELL_OFFERS.wood.amount)} {SELL_OFFERS.wood.noun}</span
                      >
                      <span class="sub">+{SELL_OFFERS.wood.coin} coin</span>
                    </div>
                  {/if}
                  {#if sold.stone}
                    <div class="done-item">
                      <Check size={11} aria-hidden="true" />
                      <span class="bicon"><Mountain size={11} aria-hidden="true" /></span>
                      <span class="lbl"
                        >Sold {formatNumber(SELL_OFFERS.stone.amount)}
                        {SELL_OFFERS.stone.noun}</span
                      >
                      <span class="sub">+{SELL_OFFERS.stone.coin} coin</span>
                    </div>
                  {/if}
                </div>
              {/if}
              {#if doneEarlyBuys}
                <p class="sub-label">Buy</p>
                <div class="done-list">
                  <div class="done-item">
                    <Check size={11} aria-hidden="true" />
                    <span class="bicon"><Wheat size={11} aria-hidden="true" /></span>
                    <span class="lbl">Emergency Food Supply — {FOOD_PURCHASE_AMOUNT} food</span>
                    <span class="sub">-{FOOD_PURCHASE_COST} coin</span>
                  </div>
                </div>
              {/if}
            </div>
          {/if}

          {#if hasAdvancedCompleted}
            <div class="tier-group">
              <p class="tier-label">Advanced Market</p>
              {#if doneAdvancedSells}
                <p class="sub-label">Sell</p>
                <div class="done-list">
                  {#if sold.arrow}
                    <div class="done-item">
                      <Check size={11} aria-hidden="true" />
                      <span class="bicon"><Needle size={11} aria-hidden="true" /></span>
                      <span class="lbl"
                        >Sold {formatNumber(SELL_OFFERS.arrow.amount)}
                        {SELL_OFFERS.arrow.noun}</span
                      >
                      <span class="sub">+{SELL_OFFERS.arrow.coin} coin</span>
                    </div>
                  {/if}
                  {#if sold.spear}
                    <div class="done-item">
                      <Check size={11} aria-hidden="true" />
                      <span class="bicon"><Trident size={11} aria-hidden="true" /></span>
                      <span class="lbl"
                        >Sold {formatNumber(SELL_OFFERS.spear.amount)}
                        {SELL_OFFERS.spear.noun}</span
                      >
                      <span class="sub">+{SELL_OFFERS.spear.coin} coin</span>
                    </div>
                  {/if}
                </div>
              {/if}
              {#if doneAdvancedBuys}
                <p class="sub-label">Buy</p>
                <div class="done-list">
                  {#each unlockedRates as id (id)}
                    <div class="done-item">
                      <Check size={11} aria-hidden="true" />
                      <span class="bicon"><Gauge size={11} aria-hidden="true" /></span>
                      <span class="lbl">{RESOURCES[id].name} Rate Display</span>
                      <span class="sub">-{RATE_UNLOCK_COST} coin</span>
                    </div>
                  {/each}
                  {#each signedContracts as id (id)}
                    {@const contract = WORKER_CONTRACTS[id]}
                    <div class="done-item">
                      <Check size={11} aria-hidden="true" />
                      <span class="bicon"><Users size={11} aria-hidden="true" /></span>
                      <span class="lbl"
                        >Worker Contract {contract.numeral} — +{contract.workers} worker{contract.workers >
                        1
                          ? 's'
                          : ''}</span
                      >
                      <span class="sub">-{contract.cost} coin</span>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        </div>
      </details>
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
  /* Section heading and its hint share one line — the hint is a caption, not a
     paragraph, and stacking them cost a row on every section. */
  .block h3 {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-display);
    font-size: 16px;
    color: var(--text);
  }
  .hint {
    display: inline;
    color: var(--text-muted);
    font-size: 11.5px;
    margin: 0 0 0 8px; /* no global p reset — kill the UA's vertical 1em */
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
  /* Sell / Buy divider inside a section. */
  .sub-label {
    font-size: 10px;
    color: var(--text-muted);
    opacity: 0.75;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: var(--space-2) 0 0;
  }
  /* The first sub-row sits directly under a tier label, which already spaces
     itself. (:first-of-type can't be used — .tier-label is a <p> sibling too.) */
  .tier-label + .sub-label {
    margin-top: 0;
  }

  /* Completed ledger */
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
  .tier-label {
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: var(--space-2) 0 4px;
  }
  .tier-label:first-of-type {
    margin-top: 0;
  }
  .tier-group + .tier-group {
    margin-top: var(--space-3);
  }
  .done-list {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 4px;
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

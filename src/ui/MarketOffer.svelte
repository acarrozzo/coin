<script lang="ts">
  /**
   * One Market offer, as a card.
   *
   * Every Market interaction — sells, provisions, permanent upgrades — renders
   * through this component, so adding a new kind of offer is a matter of
   * passing different props rather than writing new layout.
   *
   * The card reads top-to-bottom in four bands, in the order a player asks the
   * questions: what is this, what's the deal, can I take it, take it.
   *
   *   ┌──────────────────────────────┐
   *   │ ⌇ Arrow Sale                 │  what it is
   *   │ 100 arrows → +10 coin        │  the transaction
   *   │ 240 in stock                 │  where you stand
   *   │ The fletchers have been busy │  flavour
   *   │ [       Sell for 10       ]  │  the action, pinned to the floor
   *   └──────────────────────────────┘
   *
   * The action is pinned to the bottom (`margin-top: auto`) so buttons line up
   * across a row of cards no matter how much copy sits above them.
   *
   * Two rules the card holds to:
   *   - Shortfall is a hairline along the card's bottom edge, never a bar that
   *     costs a band. The card *is* the progress track.
   *   - Coin on hand is never repeated here — the panel header already carries
   *     it — so buys only mention coin when you're short of it.
   *
   * The card is presentational only: it reads nothing from the store and
   * mutates nothing. The panel supplies already-derived strings and flags.
   */
  import type { Component } from 'svelte';
  import { formatNumber, type Decimal } from '../engine/numbers';
  import Lock from '@lucide/svelte/icons/lock';

  /** What you hold vs. what the offer needs — drives the shortfall hairline. */
  interface Stock {
    have: Decimal;
    need: number;
    /** Plural noun for the held thing, e.g. "arrows", "coin". */
    noun: string;
  }

  interface Props {
    /** Leading resource / feature icon. */
    icon: Component;
    /** Offer name, the card's eyebrow. */
    title: string;
    kind: 'trade' | 'buy';
    /** trade: what is consumed, e.g. "100 arrows". */
    give?: string;
    /** trade: what is paid out, e.g. "+10 coin". */
    receive?: string;
    /** buy: the thing granted, e.g. "+2 permanent workers". */
    benefit?: string;
    /** buy: the coin price, e.g. "−5 coin". */
    cost?: string;
    /** Flavour, clamped to two lines at the card's foot. */
    quip?: string;
    stock?: Stock;
    /** When set, the offer is gated and the reason replaces the stock text. */
    locked?: string;
    actionLabel: string;
    onact: () => void;
    affordable: boolean;
  }

  const {
    icon: Icon,
    title,
    kind,
    give,
    receive,
    benefit,
    cost,
    quip,
    stock,
    locked,
    actionLabel,
    onact,
    affordable,
  }: Props = $props();

  // A locked offer is never "short" — the blocker is the level gate, not the
  // stock, so it gets its own recessed treatment rather than the red price tag.
  const short = $derived(!locked && !affordable);
  const showBar = $derived(short && !!stock);
  const pct = $derived(
    stock ? Math.min(100, Math.max(0, stock.have.div(stock.need).toNumber() * 100)) : 0,
  );

  // Where you stand on this offer. Locked says why; short says how far off; an
  // affordable trade says what's on hand. An affordable buy says nothing — the
  // panel header already shows the coin balance.
  const status = $derived.by(() => {
    if (locked) return locked;
    if (!stock) return undefined;
    if (short) return `${formatNumber(stock.have)} of ${formatNumber(stock.need)} ${stock.noun}`;
    return kind === 'trade' ? `${formatNumber(stock.have)} in stock` : undefined;
  });
</script>

<article class="offer" class:short class:locked={!!locked}>
  <div class="eyebrow">
    <span class="oicon">
      {#if locked}
        <Lock size={13} aria-hidden="true" />
      {:else}
        <Icon size={13} aria-hidden="true" />
      {/if}
    </span>
    <span class="name">{title}</span>
  </div>

  <div class="hero">
    {#if kind === 'trade'}
      <span class="give">{give}</span>
      <span class="arrow" aria-hidden="true">→</span>
      <span class="gain-pill" class:short>{receive}</span>
    {:else}
      <span class="benefit">{benefit}</span>
      <span class="cost-pill" class:short>{cost}</span>
    {/if}
  </div>

  {#if status}<p class="status" class:blocked={!!locked}>{status}</p>{/if}
  {#if quip}<p class="quip">{quip}</p>{/if}

  <div class="action">
    <button type="button" onclick={onact} disabled={!!locked || !affordable} title={locked}>
      {actionLabel}
    </button>
  </div>

  {#if showBar}<span class="fill" style="width:{pct}%"></span>{/if}
</article>

<style>
  .offer {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 5px;
    /* Fill the grid track so every card in a row is the same height. */
    height: 100%;
    padding: 10px 12px 11px;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
    border-radius: var(--radius);
    background: color-mix(in srgb, var(--accent) 8%, transparent);
    transition:
      background var(--transition),
      border-color var(--transition);
  }
  .offer:hover {
    background: color-mix(in srgb, var(--accent) 16%, transparent);
  }
  /* Out of reach: the tint drops away entirely, so affordable offers are the
     only coloured cards on the board and read as a group at a glance. */
  .offer.short,
  .offer.locked {
    background: transparent;
    border-color: color-mix(in srgb, var(--border) 45%, transparent);
  }
  .offer.short:hover,
  .offer.locked:hover {
    background: color-mix(in srgb, var(--border) 14%, transparent);
  }
  .offer.locked {
    border-style: dashed;
  }

  /* Band 1 — what it is. */
  .eyebrow {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  .oicon {
    display: inline-flex;
    align-items: center;
    color: var(--accent);
    flex-shrink: 0;
  }
  .offer.short .oicon,
  .offer.locked .oicon {
    color: color-mix(in srgb, var(--text-muted) 75%, transparent);
  }
  .name {
    font-size: 11px;
    letter-spacing: 0.04em;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Band 2 — the transaction. The card's headline. */
  .hero {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    font-size: 15px;
    line-height: 1.3;
    font-variant-numeric: tabular-nums;
  }
  .give {
    color: var(--text);
  }
  .benefit {
    color: var(--good);
    font-weight: 500;
  }
  .arrow {
    color: color-mix(in srgb, var(--text-muted) 80%, transparent);
  }
  .offer.short .give,
  .offer.locked .give,
  .offer.locked .benefit {
    color: var(--text-muted);
  }

  /* Two price tags: coin you PAY (.cost-pill) vs coin you RECEIVE (.gain-pill).
     One capsule treatment for both, so a price reads the same wherever it sits.
     The difference is carried by hue — gold for coin leaving, green for coin
     arriving — and by the −/+ sign. Both drop to red when the offer is
     unpressable, and there the sign is what separates them. */
  .cost-pill,
  .gain-pill {
    padding: 1px 7px;
    font-size: 12px;
    line-height: 1.4;
    white-space: nowrap;
    border-radius: 999px;
    border: 1px solid;
    font-weight: 600;
  }
  .gain-pill {
    background: color-mix(in srgb, var(--good) 20%, transparent);
    border-color: color-mix(in srgb, var(--good) 42%, transparent);
    color: var(--good);
  }
  .cost-pill {
    background: color-mix(in srgb, var(--gold) 20%, transparent);
    border-color: color-mix(in srgb, var(--gold) 42%, transparent);
    color: var(--gold);
  }
  .gain-pill.short,
  .cost-pill.short {
    background: color-mix(in srgb, var(--bad) 18%, transparent);
    border-color: color-mix(in srgb, var(--bad) 40%, transparent);
    color: var(--bad);
  }

  /* Band 3 — where you stand, then flavour. */
  .status {
    margin: 0;
    font-size: 11.5px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }
  .status.blocked {
    color: color-mix(in srgb, var(--text-muted) 85%, transparent);
  }
  /* Flavour is the first thing sacrificed when a card runs out of room. */
  .quip {
    margin: 0;
    font-size: 11px;
    line-height: 1.4;
    color: color-mix(in srgb, var(--text-muted) 72%, transparent);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Band 4 — the action, pinned to the floor so buttons align across a row of
     cards regardless of how much copy each one carries. The solid, saturated
     button is the only high-contrast element on the card, so "what can I do
     right now" is answered by scanning for filled buttons. */
  .action {
    margin-top: auto;
    padding-top: 5px;
  }
  .action button {
    width: 100%;
    border: 1px solid var(--accent);
    background: var(--accent);
    color: var(--bg);
    font-weight: 600;
    padding: 6px 10px;
    font-size: 12.5px;
    line-height: 1.4;
    border-radius: var(--radius);
    white-space: nowrap;
    cursor: pointer;
    transition:
      background var(--transition),
      border-color var(--transition);
  }
  .action button:hover:not(:disabled) {
    background: color-mix(in srgb, var(--accent) 80%, var(--text));
    border-color: color-mix(in srgb, var(--accent) 80%, var(--text));
  }
  .action button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .action button:disabled {
    background: transparent;
    border-color: color-mix(in srgb, var(--border) 55%, transparent);
    color: color-mix(in srgb, var(--text-muted) 85%, transparent);
    cursor: not-allowed;
  }

  /* Shortfall, as a hairline along the card's own bottom edge. Kept deliberately
     quiet: it marks an offer you *can't* take yet, and must never out-shout the
     solid buttons on the offers you can. */
  .fill {
    position: absolute;
    left: 0;
    bottom: 0;
    height: 2px;
    background: color-mix(in srgb, var(--accent) 38%, transparent);
  }
</style>

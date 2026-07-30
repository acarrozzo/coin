<script lang="ts">
  /**
   * One core-resource storage gauge in the sticky header: icon + amount/cap over
   * a fill bar, with the resource's hover card hanging off it so a line can be
   * staffed and diagnosed without leaving the top of the page.
   *
   * The gauge's icon+number stays a jump link (unchanged behaviour); the card is
   * a second, hover-only surface — the same ResourceFlyout the resource's own row
   * shows, opened by the shared HoverFlyout behaviour. Both live on the anchor
   * below, which is why the whole gauge (not just the link) is the hover zone.
   *
   * Pointer-driven only: on touch there is no hover, and a tap on the gauge jumps
   * to the resource exactly as it did before.
   */
  import type { Component } from 'svelte';
  import { RESOURCES, type ResourceId } from '../content/resources';
  import { formatNumber } from '../engine/numbers';
  import type { Decimal } from '../engine/numbers';
  import { HoverFlyout } from './hoverFlyout.svelte';
  import ResourceFlyout from './ResourceFlyout.svelte';

  interface Props {
    id: ResourceId;
    icon: Component;
    amount: Decimal;
    cap: Decimal;
    pct: number;
    /** Scroll to this resource's producer row (the existing gauge click). */
    onjump: (id: ResourceId) => void;
  }
  const { id, icon: Icon, amount, cap, pct, onjump }: Props = $props();

  const fly = new HoverFlyout();
  $effect(() => fly.dispose);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="store"
  onpointerenter={fly.onPointerEnter}
  onpointerleave={fly.scheduleClose}
  onfocusin={fly.show}
  onfocusout={fly.onFocusOut}
>
  <button
    type="button"
    class="store-jump"
    onclick={() => onjump(id)}
    title="{RESOURCES[id].name}: {formatNumber(amount)} / {formatNumber(cap)}"
    aria-label="Go to {RESOURCES[id].name}"
  >
    <Icon size={14} color="var(--gold)" aria-hidden="true" />
    <span class="store-num"
      >{formatNumber(amount)}<span class="store-cap">/{formatNumber(cap)}</span></span
    >
  </button>

  <span class="store-bar"><span class="store-fill" style:width="{pct}%"></span></span>

  <ResourceFlyout {id} open={fly.open} />
</div>

<style>
  /* Icon + amount on top, the fill bar wrapped onto its own line beneath them —
     narrower than carrying the bar inline, which matters in a header that also
     holds the wordmark and the worker readout. */
  .store {
    position: relative;
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 5px;
    row-gap: 4px;
    /* Holds the gauge steady as digits come and go (and keeps the bar from
       collapsing to the width of a one-digit amount). */
    min-width: 56px;
    color: var(--text-on-header);
    font-variant-numeric: tabular-nums;
  }
  /* Icon + amount together are the link to the full producer row. */
  .store-jump {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 0;
    background: none;
    border: 0;
    border-radius: var(--radius);
    color: inherit;
    font: inherit;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
    transition: color var(--transition);
  }
  .store-jump:hover {
    color: var(--gold);
  }
  .store-jump:focus-visible {
    outline: 2px solid var(--gold);
    outline-offset: 2px;
  }
  .store-num {
    font-size: 14px;
  }
  .store-cap {
    color: var(--text-muted);
  }
  .store-bar {
    display: block;
    flex-basis: 100%;
    height: 6px;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 999px;
    overflow: hidden;
  }
  .store-fill {
    display: block;
    height: 100%;
    background: var(--gold);
    border-radius: 999px;
    transition: width 0.2s linear;
  }

  /* Below 768px the /cap text is dropped — it wouldn't fit the narrow column,
     and the bar shows fullness on its own. */
  @media (max-width: 767.98px) {
    .store-cap {
      display: none;
    }
  }

  @media (max-width: 640px) {
    .store-num {
      font-size: 13px;
    }
  }
</style>

<script lang="ts">
  /**
   * One core-resource storage gauge in the sticky header: icon + amount/cap
   * over a fill bar, with a hover flyout for staffing the line without leaving
   * the top of the page.
   *
   * The gauge's icon+number stays a jump link (unchanged behaviour); the flyout
   * is a second, hover-only surface hanging off it. Because the flyout holds
   * clickable −/+ buttons, plain CSS :hover isn't enough — the cursor has to be
   * able to travel from the gauge into the flyout and click repeatedly. So open
   * state is tracked in JS across BOTH elements with a short close grace period.
   *
   * Pointer-driven only: on touch there is no hover, and a tap on the gauge
   * jumps to the resource exactly as it did before.
   */
  import type { Component } from 'svelte';
  import { game } from './gameStore.svelte';
  import { RESOURCES, type ResourceId } from '../content/resources';
  import { PRODUCERS } from '../content/producers';
  import { getAvailableWorkers, getMaxWorkers, isResourceUnlocked } from '../engine/selectors';
  import { formatNumber, formatCycleRate, type Decimal } from '../engine/numbers';

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

  const gs = $derived(game.state);
  const assigned = $derived(gs.workers.assigned[id]);
  const available = $derived(getAvailableWorkers(gs));
  const maxWorkers = $derived(getMaxWorkers(gs, id));
  const showMax = $derived(PRODUCERS[id]?.workerCap === 'level' || PRODUCERS[id]?.workerCap === 1);
  const cycleSeconds = $derived(PRODUCERS[id]?.cycleSeconds ?? 1);
  const outputPerCycle = $derived(PRODUCERS[id]?.outputPerCycle ?? 0);
  // The gauge appears as soon as the settlement grants storage, which can be
  // before the producing line exists (food has a cap at level 1, the Farm comes
  // later). Nothing to staff until then.
  const staffable = $derived(isResourceUnlocked(gs, id));

  // Open across gauge + flyout together. A leave starts a short timer instead
  // of closing outright, so crossing the gap between the two doesn't dismiss it
  // mid-click.
  let open = $state(false);
  let closeTimer = 0;
  const CLOSE_GRACE_MS = 200;

  function show() {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = 0;
    }
    open = true;
  }

  function scheduleClose() {
    if (closeTimer) clearTimeout(closeTimer);
    closeTimer = window.setTimeout(() => {
      open = false;
      closeTimer = 0;
    }, CLOSE_GRACE_MS);
  }

  /** Keyboard: focus opens it, and moving focus out of the group closes it at
      once — no grace period needed, focus doesn't travel through dead space. */
  function onFocusOut(e: FocusEvent) {
    const next = e.relatedTarget;
    if (next instanceof Node && e.currentTarget instanceof Node) {
      if (e.currentTarget.contains(next)) return;
    }
    open = false;
  }

  $effect(() => () => {
    if (closeTimer) clearTimeout(closeTimer);
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="store"
  onpointerenter={(e) => {
    if (e.pointerType !== 'touch') show();
  }}
  onpointerleave={scheduleClose}
  onfocusin={show}
  onfocusout={onFocusOut}
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

  {#if staffable}
    <div class="staff-flyout" class:open aria-hidden={!open}>
      <div class="staff-row">
        <button
          type="button"
          onclick={() => game.assign(id, -1)}
          disabled={assigned === 0}
          tabindex={open ? 0 : -1}
          aria-label="Remove worker from {RESOURCES[id].name}">−</button
        >
        <span class="staff-count"
          >{assigned}{#if showMax}<span class="staff-max">/{maxWorkers}</span>{/if}</span
        >
        <button
          type="button"
          onclick={() => game.assign(id, 1)}
          disabled={available <= 0 || assigned >= maxWorkers}
          tabindex={open ? 0 : -1}
          aria-label="Add worker to {RESOURCES[id].name}">+</button
        >
      </div>
      <span class="staff-rate" class:idle={assigned === 0}>
        +{formatCycleRate(
          assigned * outputPerCycle,
          RESOURCES[id].name.toLowerCase(),
          cycleSeconds,
        )}
      </span>
    </div>
  {/if}
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

  /* Staffing flyout. Sits flush under the gauge with a small visual offset, but
     the padding-top below keeps its hit area touching the gauge so the cursor
     never crosses a dead gap on the way down. */
  .staff-flyout {
    position: absolute;
    top: 100%;
    left: 50%;
    z-index: 20;
    /* The gap between gauge and card, as padding so it stays hoverable. */
    padding-top: 6px;
    width: max-content;
    opacity: 0;
    transform: translate(-50%, -4px);
    pointer-events: none;
    transition:
      opacity 0.15s ease,
      transform 0.15s ease;
  }
  .staff-flyout.open {
    opacity: 1;
    transform: translate(-50%, 0);
    pointer-events: auto;
  }
  .staff-row,
  .staff-rate {
    background: var(--bg-panel, #fff);
    color: var(--text, inherit);
    border: 1px solid var(--border);
  }
  .staff-row {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px;
    border-radius: var(--radius) var(--radius) 0 0;
    border-bottom: 0;
  }
  .staff-row button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font: inherit;
    font-size: 15px;
    line-height: 1;
    cursor: pointer;
    transition: background var(--transition);
  }
  .staff-row button:hover:not(:disabled) {
    background: color-mix(in srgb, var(--accent) 20%, transparent);
  }
  .staff-row button:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .staff-count {
    min-width: 34px;
    text-align: center;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
  .staff-max {
    color: var(--text-muted);
  }
  .staff-rate {
    display: block;
    padding: 3px 6px 4px;
    border-radius: 0 0 var(--radius) var(--radius);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
    font-size: 11px;
    color: var(--text-muted);
    text-align: center;
    white-space: nowrap;
  }
  .staff-rate.idle {
    opacity: 0.6;
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

  @media (prefers-reduced-motion: reduce) {
    .staff-flyout {
      transition: none;
    }
  }
</style>

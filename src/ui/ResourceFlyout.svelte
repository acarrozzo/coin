<script lang="ts">
  /**
   * The hover card for one core resource — everything about a line that doesn't
   * fit where the line is shown: staffing, its gross output, the Market-gated
   * live/target monitor, and every unlocked line pulling on it with its draw and
   * status.
   *
   * Rendered by both surfaces that report a core rate — the header gauge
   * (StoreGauge) and the rate cell in the resource row (RateCell) — so the two
   * hovers are the same card, not two similar ones. The host owns the anchor and
   * the open state (see HoverFlyout); this owns the card and where it hangs.
   *
   * `sections` is what differs between them, and only because of what each host
   * already shows. The header has nothing but a gauge, so it gets everything. The
   * resource row already carries the staffing buttons, the gross rate and the
   * live/target monitor inches away, so its card is `draws` — the one thing the
   * row has no space for.
   *
   * `align` is only about staying on screen: the header gauges are narrow and
   * centred in their own space, while the row's rate cell sits at the far right
   * of a panel, where a centred card would hang off the edge.
   */
  import { game } from './gameStore.svelte';
  import { RESOURCES, type ResourceId } from '../content/resources';
  import { PRODUCERS } from '../content/producers';
  import {
    getAvailableWorkers,
    getMaxWorkers,
    getResourceDraws,
    isRateUnlocked,
    isResourceUnlocked,
    type ResourceStatus,
  } from '../engine/selectors';
  import { formatCycleRate, formatSignedRate } from '../engine/numbers';
  import { jumpToResource } from './nav.svelte';
  import RateMonitor from './RateMonitor.svelte';

  interface Props {
    id: ResourceId;
    /** Held by the host, which owns the trigger the hover starts on. */
    open: boolean;
    /** How much of the card to show — see the note above. */
    sections?: 'full' | 'draws';
    /** Which edge the card hangs from — see the note above. */
    align?: 'center' | 'right';
  }
  const { id, open, sections = 'full', align = 'center' }: Props = $props();

  const gs = $derived(game.state);
  const assigned = $derived(gs.workers.assigned[id]);
  const available = $derived(getAvailableWorkers(gs));
  const maxWorkers = $derived(getMaxWorkers(gs, id));
  const showMax = $derived(PRODUCERS[id]?.workerCap === 'level' || PRODUCERS[id]?.workerCap === 1);
  const cycleSeconds = $derived(PRODUCERS[id]?.cycleSeconds ?? 1);
  const outputPerCycle = $derived(PRODUCERS[id]?.outputPerCycle ?? 0);

  // A gauge can exist before the line does (food has a cap at settlement level 1,
  // the Farm comes later), and there's nothing to say about a line that isn't
  // there yet.
  const staffable = $derived(isResourceUnlocked(gs, id));

  // The rate monitor is a Market purchase, per resource. Before it's bought the
  // card shows the gross line rate only — rather than dead "locked" text in a
  // small hover surface.
  const rateUnlocked = $derived(isRateUnlocked(gs, id));

  const draws = $derived(getResourceDraws(gs, id));

  // In `draws` mode the list is the whole card, so with nothing pulling (or the
  // rate display not yet bought) there is no card at all — RateCell makes the
  // same check and skips the trigger entirely.
  const empty = $derived(sections === 'draws' && (!rateUnlocked || draws.length === 0));

  /** The word beside a consumer that isn't running. Producing lines get none —
      their rate already says it. `wanted` reads as "needed": that line is idle
      *and* something downstream is stalled waiting on its output. */
  function statusWord(s: ResourceStatus): string {
    return s === 'starved' ? 'starved' : s === 'wanted' ? 'needed' : s === 'idle' ? 'idle' : '';
  }
</script>

{#if staffable && !empty}
  <div class="flyout {align}" class:open aria-hidden={!open}>
    <div class="card">
      {#if sections === 'full'}
        <span class="card-title">{RESOURCES[id].name}</span>

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

        <!-- The same monitor component the resource's row renders, behind the
             same Market unlock, so the two surfaces never disagree. -->
        {#if rateUnlocked}
          <span class="netrates"><RateMonitor {id} compact /></span>
        {/if}
      {/if}

      {#if rateUnlocked && draws.length > 0}
        <span class="draws-title">Pulling {RESOURCES[id].name.toLowerCase()}</span>
        <ul class="draws">
          {#each draws as d (d.id)}
            <li class="draw" title={d.reason}>
              <span class="ddot {d.status}" aria-hidden="true"></span>
              <button
                type="button"
                class="dname"
                onclick={() => jumpToResource(d.id)}
                tabindex={open ? 0 : -1}
                aria-label="Go to {RESOURCES[d.id].name}">{RESOURCES[d.id].name}</button
              >
              <span class="drate" class:drawing={d.rate.gt(0)}
                >{formatSignedRate(d.rate.neg())}</span
              >
              <span class="dstatus {d.status}">{statusWord(d.status)}</span>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* Sits flush under the trigger with a small visual offset, but the padding-top
     keeps its hit area touching it so the cursor never crosses a dead gap on the
     way down. */
  .flyout {
    position: absolute;
    top: 100%;
    z-index: 20;
    /* The gap between trigger and card, as padding so it stays hoverable. */
    padding-top: 6px;
    width: max-content;
    opacity: 0;
    pointer-events: none;
    transition:
      opacity 0.15s ease,
      transform 0.15s ease;
  }
  .flyout.center {
    left: 50%;
    transform: translate(-50%, -4px);
  }
  .flyout.center.open {
    transform: translate(-50%, 0);
  }
  /* Right-anchored: the trigger is already at the right edge of its container, so
     the card grows leftward instead of off the panel. */
  .flyout.right {
    right: 0;
    transform: translateY(-4px);
  }
  .flyout.right.open {
    transform: translateY(0);
  }
  .flyout.open {
    opacity: 1;
    pointer-events: auto;
  }
  /* One panel card, matching the header's other hover surface (the idle-worker
     flyout in App): the sections inside are separated by rules, not by being
     separate boxes. */
  .card {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
    min-width: 168px;
    max-width: min(260px, 80vw);
    padding: 8px 10px;
    background: var(--bg-panel, #fff);
    color: var(--text, inherit);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
    font-size: 12px;
    text-align: left;
  }
  .card-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .staff-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
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
    font-size: 11px;
    color: var(--good);
    text-align: center;
    white-space: nowrap;
  }
  .staff-rate.idle {
    color: var(--text-muted);
    opacity: 0.7;
  }

  /* Just the rule and the space around the monitor — RateMonitor owns how it
     lays itself out (see its `compact` form). */
  .netrates {
    display: flex;
    justify-content: center;
    padding-top: 6px;
    border-top: 1px solid var(--border);
  }

  .draws-title {
    padding-top: 6px;
    border-top: 1px solid var(--border);
    font-size: 10px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  /* Leading the card (the row's `draws` form): no rule, since there's nothing
     above to divide it from. */
  .card > .draws-title:first-child {
    padding-top: 0;
    border-top: 0;
  }
  .draws {
    display: flex;
    flex-direction: column;
    gap: 3px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  /* dot | name | rate | status — the rate column is pushed right so the numbers
     line up down the list however long the names are. */
  .draw {
    display: grid;
    grid-template-columns: 6px minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }
  /* Same four states and colours as the nav rail's status dots — one palette for
     "is this line working" across the whole UI. */
  .ddot {
    width: 6px;
    height: 6px;
    border-radius: 999px;
  }
  .ddot.producing {
    background: var(--good);
  }
  .ddot.starved {
    background: var(--warn);
  }
  .ddot.idle {
    background: color-mix(in srgb, var(--text-muted) 45%, transparent);
  }
  .ddot.wanted {
    background: var(--bad);
  }
  .dname {
    padding: 0;
    background: none;
    border: 0;
    color: inherit;
    font: inherit;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
    transition: color var(--transition);
  }
  .dname:hover,
  .dname:focus-visible {
    color: var(--accent);
    outline: none;
  }
  .drate {
    color: var(--text-muted);
  }
  /* Only a line actually drawing shows its draw in the deficit colour; an idle
     line's flat 0/s stays muted. */
  .drate.drawing {
    color: var(--bad);
  }
  .dstatus {
    color: var(--text-muted);
    font-size: 10px;
  }
  .dstatus.starved {
    color: var(--warn);
  }
  .dstatus.wanted {
    color: var(--bad);
  }

  @media (prefers-reduced-motion: reduce) {
    .flyout {
      transition: none;
    }
  }
</style>

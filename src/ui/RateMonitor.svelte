<script lang="ts">
  /**
   * A core resource's rate monitor: what its stock is doing right now, as a
   * state (colour + glyph) attached to the numbers rather than left implicit in
   * their sign.
   *
   * The live net rate is the headline, the nominal "target" rides beneath it,
   * and — for the two states that are actually moving — a deadline: how long
   * until the store empties or fills. Six states, because four separate
   * situations all print "0/s" (see getRateState).
   *
   * One component for both surfaces that show this (the Core rows in
   * ResourcePanel and the header gauge's flyout) so they can't drift apart:
   * `compact` is the flyout's smaller, centred form. Neither caller passes the
   * Market gate down — each keeps its own branch for a locked rate, because they
   * treat it differently (the row shows a placeholder, the flyout shows nothing).
   */
  import TrendingUp from '@lucide/svelte/icons/trending-up';
  import TrendingDown from '@lucide/svelte/icons/trending-down';
  import Minus from '@lucide/svelte/icons/minus';
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
  import ArrowUpToLine from '@lucide/svelte/icons/arrow-up-to-line';
  import Pause from '@lucide/svelte/icons/pause';
  import type { Component } from 'svelte';
  import { game } from './gameStore.svelte';
  import type { ResourceId } from '../content/resources';
  import {
    getLiveNetProductionRate,
    getNetProductionRate,
    getRateEta,
    getRateState,
    rateStateReason,
    type CoreRateState,
  } from '../engine/selectors';
  import { formatDuration, formatSignedRate } from '../engine/numbers';

  interface Props {
    id: ResourceId;
    /** The flyout's form: smaller, centred, deadline on its own line. */
    compact?: boolean;
  }
  const { id, compact = false }: Props = $props();

  const gs = $derived(game.state);
  const live = $derived(getLiveNetProductionRate(gs, id));
  const target = $derived(getNetProductionRate(gs, id));
  const state = $derived(getRateState(gs, id));
  const reason = $derived(rateStateReason(gs, id));
  const eta = $derived(getRateEta(gs, id));

  /** One glyph per state, so colour is never the only signal. */
  const ICON: Record<CoreRateState, Component> = {
    rising: TrendingUp,
    falling: TrendingDown,
    // Hit the ceiling: production has nowhere left to go.
    full: ArrowUpToLine,
    fragile: TriangleAlert,
    steady: Minus,
    idle: Pause,
  };
  const Icon = $derived(ICON[state]);
</script>

<span class="monitor {state}" class:compact title={reason}>
  <span class="head">
    <span class="glyph" role="img" aria-label={reason}>
      <Icon size={compact ? 12 : 14} aria-hidden="true" />
    </span>
    <span class="live">{formatSignedRate(live)}</span>
  </span>
  <span class="sub">
    <span class="target">{formatSignedRate(target)} target</span>
    {#if eta}
      <span class="eta"
        >{compact ? '' : '· '}{eta.kind === 'empty' ? 'empty' : 'full'} in {formatDuration(
          eta.seconds,
        )}</span
      >
    {/if}
  </span>
</span>

<style>
  /* Right-aligned stack in the row's trailing cell: headline rate, then the
     quieter target + deadline line. */
  .monitor {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 1px;
    line-height: 1.15;
    font-variant-numeric: tabular-nums;
  }
  .head {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .glyph {
    display: inline-flex;
    align-items: center;
  }
  .live {
    font-size: 15px;
    font-weight: 600;
    white-space: nowrap;
  }
  /* Context for the headline, not the headline itself. */
  .sub {
    display: inline-flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 4px;
    font-size: 11px;
    font-weight: 500;
    color: color-mix(in srgb, var(--text-muted) 70%, var(--bg-panel));
  }
  .target,
  .eta {
    white-space: nowrap;
  }

  /* Six states, six colours. Green/amber/red are the same tokens the status dots
     and alert dots use; gold is "at a cap you can raise", as everywhere else. */
  .monitor.rising {
    color: var(--good);
  }
  .monitor.falling {
    color: var(--bad);
  }
  .monitor.fragile {
    color: var(--warn);
  }
  .monitor.full {
    color: var(--gold);
  }
  .monitor.steady {
    color: var(--text-muted);
  }
  .monitor.idle {
    color: color-mix(in srgb, var(--text-muted) 55%, transparent);
  }
  /* The deadline inherits the state colour rather than staying muted: "empty in
     40s" is the urgent half of a falling rate, and reading it as an aside
     undersells it. The target beside it stays quiet. */
  .monitor.falling .eta,
  .monitor.rising .eta {
    color: inherit;
  }

  /* Flyout form: centred under the staffing row, deadline on its own line, and
     sized to the card's 12px type. */
  .monitor.compact {
    align-items: center;
    gap: 2px;
  }
  .monitor.compact .live {
    font-size: 12px;
    font-weight: 600;
  }
  .monitor.compact .sub {
    flex-direction: column;
    align-items: center;
    gap: 1px;
    font-size: 10px;
  }
</style>

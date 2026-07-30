<script lang="ts">
  /**
   * A core resource row's rate cell: the RateMonitor, with the same hover card the
   * header gauge carries hanging under it.
   *
   * Its own component rather than markup inside ResourcePanel's row loop because
   * the open state is per row — one instance per cell is what keeps three cards
   * from sharing one flag.
   *
   * The monitor sits inside a button: it is a disclosure, so it's focusable for a
   * keyboard, and a tap pins the card open on touch, where there is no hover at
   * all (the header gauge can't do this — a tap there jumps to the row instead).
   *
   * The card here is the `draws` form — only the breakdown of what's pulling this
   * resource. Everything else the full card carries (staffing, gross rate, the
   * live/target pair) is already on the row, inches away. With nothing pulling
   * yet there's nothing to disclose, so the monitor renders bare: no button, no
   * hover, nothing to open.
   */
  import { game } from './gameStore.svelte';
  import { RESOURCES, type ResourceId } from '../content/resources';
  import { getResourceDraws } from '../engine/selectors';
  import { HoverFlyout } from './hoverFlyout.svelte';
  import RateMonitor from './RateMonitor.svelte';
  import ResourceFlyout from './ResourceFlyout.svelte';

  interface Props {
    id: ResourceId;
  }
  const { id }: Props = $props();

  const hasDraws = $derived(getResourceDraws(game.state, id).length > 0);

  const fly = new HoverFlyout();
  $effect(() => fly.dispose);

  let wrap = $state<HTMLElement | undefined>();

  /** Clicking anywhere else drops a pinned card (the hover half needs no help —
      pointerleave already handles it). */
  function onWindowClick(e: MouseEvent) {
    if (fly.pinned && wrap && !wrap.contains(e.target as Node)) fly.dismiss();
  }
</script>

<svelte:window onclick={onWindowClick} onkeydown={fly.onWindowKeydown} />

{#if hasDraws}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <span
    class="cell"
    bind:this={wrap}
    onpointerenter={fly.onPointerEnter}
    onpointerleave={fly.scheduleClose}
    onfocusin={fly.show}
    onfocusout={fly.onFocusOut}
  >
    <button
      type="button"
      class="trigger"
      aria-expanded={fly.open}
      aria-label="What's pulling {RESOURCES[id].name}"
      onclick={fly.toggle}
    >
      <RateMonitor {id} />
    </button>
    <!-- Right-anchored: this cell sits at the far right of the row, where a
         centred card would hang off the panel. -->
    <ResourceFlyout {id} open={fly.open} sections="draws" align="right" />
  </span>
{:else}
  <RateMonitor {id} />
{/if}

<style>
  .cell {
    position: relative;
    display: inline-flex;
  }
  /* Invisible until focused: the monitor is the visible thing, and a rate readout
     shouldn't grow a button's chrome just because it can be opened. */
  .trigger {
    display: inline-flex;
    padding: 0;
    background: none;
    border: 0;
    border-radius: var(--radius);
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  .trigger:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
</style>

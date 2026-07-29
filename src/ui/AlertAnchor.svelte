<script lang="ts">
  /**
   * Hover/focus wrapper that hangs an AlertFlyout off whatever it wraps.
   *
   * AlertFlyout is fixed-positioned (it has to be — see that file), so someone
   * has to measure the anchor and say which edge to grow from. The tab bar and
   * the jump rail each do that themselves because they own a whole row of
   * anchors; anything standing on its own in the page uses this instead of
   * repeating the measurement.
   *
   * The whole wrapped element is the trigger, and focus is caught by bubbling
   * (focusin/focusout), so a button or link inside still raises it from the
   * keyboard. The flyout is aria-hidden, so whatever is wrapped must carry the
   * same information in its own accessible name.
   */
  import type { Snippet } from 'svelte';
  import AlertFlyout from './AlertFlyout.svelte';
  import type { TabAlert } from './sections';

  interface Props {
    /** Plain heading, for when there is no alert to list (or above the rows). */
    label?: string;
    alerts?: TabAlert[];
    children: Snippet;
  }
  const { label, alerts = [], children }: Props = $props();

  /** Roughly AlertFlyout's max width — enough to know if it would run off-screen. */
  const FLYOUT_MAX_W = 280;
  let tip = $state<{ x: number; y: number; side: 'left' | 'right' } | null>(null);

  function show(e: Event) {
    if (!label && alerts.length === 0) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    // Grow rightward when there's room for it, leftward when there isn't.
    const side = r.right + FLYOUT_MAX_W <= window.innerWidth ? 'right' : 'left';
    tip = {
      x: side === 'right' ? r.right + 8 : r.left - 8,
      y: r.top + r.height / 2,
      side,
    };
  }
  function hide() {
    tip = null;
  }
</script>

<span
  class="anchor"
  onmouseenter={show}
  onmouseleave={hide}
  onfocusin={show}
  onfocusout={hide}
  role="presentation"
>
  {@render children()}
</span>

{#if tip}
  <AlertFlyout {label} {alerts} x={tip.x} y={tip.y} side={tip.side} />
{/if}

<style>
  /* Purely a hit area: it must not disturb the layout of what it wraps. */
  .anchor {
    display: inline-flex;
    align-items: center;
  }
</style>

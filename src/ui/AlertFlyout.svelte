<script lang="ts">
  /**
   * The hover/focus label for an alert dot — on a tab, or on a jump-rail button.
   *
   * Fixed-positioned, and it has to be: the tab bar is `overflow-x: auto`, so an
   * absolutely-positioned child would be clipped the moment the bar scrolls.
   * The owner measures the anchor and passes the edge to grow from; `side` picks
   * which way it grows and centres it against the anchor.
   *
   * Purely presentational. It renders a plain label (the rail's section name), a
   * list of alerts, or both — the rail passes its section's one alert, a tab
   * passes all of its own.
   *
   * aria-hidden throughout: everything in here is already on the dot's own
   * aria-label, and a tooltip that duplicates its anchor just makes a screen
   * reader say it twice.
   */
  import type { TabAlert } from './sections';

  interface Props {
    /** Plain heading, used by the rail where the section name isn't on screen. */
    label?: string;
    alerts?: TabAlert[];
    x: number;
    y: number;
    side: 'left' | 'right';
  }

  const { label, alerts = [], x, y, side }: Props = $props();
</script>

<div
  class="flyout {side}"
  class:listing={alerts.length > 0}
  role="tooltip"
  aria-hidden="true"
  style="left: {x}px; top: {y}px"
>
  {#if label}
    <span class="label">{label}</span>
  {/if}
  {#each alerts as a (a.id)}
    <span class="row">
      <span class="dot" class:warn={a.severity === 'warn'} class:bad={a.severity === 'bad'}></span>
      <span class="what">
        <!-- The rail already names the section in `label`, so repeating it per
             row would just stutter. Tabs have no such heading and need it. -->
        {#if !label}<strong>{a.label}</strong> —
        {/if}{a.reason}
      </span>
    </span>
  {/each}
</div>

<style>
  .flyout {
    position: fixed;
    z-index: 50;
    width: max-content;
    max-width: 260px;
    padding: 5px 9px;
    background: var(--bg-panel, #fff);
    color: var(--text, inherit);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
    font-size: 12px;
    font-weight: 600;
    line-height: 1;
    white-space: nowrap;
    pointer-events: none;
  }
  /* With rows it becomes a small stack rather than a one-line tag. */
  .flyout.listing {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 7px 10px;
    line-height: 1.25;
    white-space: normal;
  }
  .flyout.right {
    transform: translateY(-50%);
  }
  .flyout.left {
    transform: translate(-100%, -50%);
  }
  .label {
    font-weight: 600;
  }
  /* A label above rows is a heading for them, so give it a little air. */
  .flyout.listing .label {
    margin-bottom: 1px;
  }
  .row {
    display: flex;
    align-items: baseline;
    gap: 7px;
  }
  .what {
    font-weight: 400;
    color: var(--text-muted);
  }
  /* Same severity language as the dot that opened this. No pulse on these ones
     — the row spells the reason out in words, so motion would only distract. */
  .dot {
    flex: 0 0 auto;
    width: 7px;
    height: 7px;
    margin-top: 1px;
    border-radius: 999px;
    background: var(--good);
  }
  .dot.warn {
    background: var(--warn);
  }
  .dot.bad {
    background: var(--bad);
  }
</style>

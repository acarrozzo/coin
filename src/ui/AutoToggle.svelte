<script lang="ts">
  /**
   * The auto-replenish switch for a toggle line (defense, ward) — the whole
   * workers cell for a line that costs no workers.
   *
   * Lives in its own component because two panels render the very same row:
   * ProducerRow over on Threats, and ResourcePanel's structure cards before
   * combat unlocks. The states are deliberately lopsided:
   *
   *   ON   quiet — a small check, no colour. Running is the normal condition
   *        and shouldn't shout for attention.
   *   OFF  red, with an alert icon. This is the state that costs you the run:
   *        the stat stops rebuilding while attacks keep grinding it down, and
   *        at 0 your stores are looted.
   *
   * The hover/focus explanation is the same AlertFlyout the tab bar and jump
   * rail use for their dots, so a danger reads identically wherever it's raised
   * — and it hangs off the WHOLE button, since the button is the thing you're
   * deciding about.
   */
  import { game } from './gameStore.svelte';
  import { RESOURCES, type ResourceId } from '../content/resources';
  import { isAutomationOn } from '../engine/selectors';
  import AlertAnchor from './AlertAnchor.svelte';
  import type { TabAlert } from './sections';
  import Check from '@lucide/svelte/icons/check';
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

  interface Props {
    /** The toggle line's output resource (defense, ward). */
    id: ResourceId;
  }
  const { id }: Props = $props();

  const on = $derived(isAutomationOn(game.state, id));
  const name = $derived(RESOURCES[id].name);
  const warning = $derived(
    `Auto-replenish is off — it will not rebuild. ` +
      `Every attack grinds it down, and at 0 your stores are looted.`,
  );
  // Switched off is an alert in the same language as every other dot in the
  // game; switched on is just a label, with nothing waiting on the player.
  const alerts = $derived<TabAlert[]>(
    on ? [] : [{ id, label: name, severity: 'bad', reason: warning }],
  );

</script>

<AlertAnchor label={on ? `Auto-replenish ${name}` : undefined} {alerts}>
  <button
    type="button"
    class="auto"
    class:on
    role="switch"
    aria-checked={on}
    onclick={() => game.setAuto(id, !on)}
    aria-label={on ? `Auto-replenish ${name}` : `Auto-replenish ${name}. ${warning}`}
  >
    <span class="box">
      {#if on}
        <Check size={12} strokeWidth={3} aria-hidden="true" />
      {:else}
        <TriangleAlert size={12} aria-hidden="true" />
      {/if}
    </span>
    <span class="auto-label">Auto {on ? 'ON' : 'OFF'}</span>
  </button>
</AlertAnchor>

<style>
  .auto {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    width: auto;
    height: 30px;
    padding: 0 10px 0 6px;
    font-size: 12px;
    letter-spacing: 0.04em;
    line-height: 1;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text-muted);
    border-radius: var(--radius);
    cursor: pointer;
    transition:
      background var(--transition),
      border-color var(--transition),
      color var(--transition);
  }
  /* The box holds the check when on and the alert glyph when off, at one size
     so the label never shifts as it flips. */
  .box {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border: 1px solid currentColor;
    border-radius: 3px;
  }
  /* Running: no accent colour, no outline — just the tick. */
  .auto.on {
    color: var(--text-muted);
  }
  .auto.on:hover,
  .auto.on:focus-visible {
    background: color-mix(in srgb, var(--accent) 20%, transparent);
    color: var(--text);
  }
  /* Off is the dangerous state, and says so. */
  .auto:not(.on) {
    color: var(--bad);
    border-color: color-mix(in srgb, var(--bad) 55%, transparent);
  }
  .auto:not(.on) .box {
    border-color: transparent;
  }
  .auto:not(.on):hover,
  .auto:not(.on):focus-visible {
    background: color-mix(in srgb, var(--bad) 18%, transparent);
    border-color: var(--bad);
  }
  @media (prefers-reduced-motion: reduce) {
    .auto {
      transition: none;
    }
  }
  /* Larger tap target on touch-sized screens, matching the worker buttons. */
  @media (max-width: 560px) {
    .auto {
      height: 40px;
    }
  }
</style>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import Info from '@lucide/svelte/icons/info';

  interface Props {
    /** Accessible label for the trigger and dialog (e.g. "Assault details"). */
    label: string;
    /** Accent colour for the flyout heading rule (a CSS colour / var). */
    accent?: string;
    /** Flyout body. */
    children: Snippet;
  }

  const { label, accent = 'var(--accent)', children }: Props = $props();

  // Hover (pointer devices) and pin (any device, via tap/click) are tracked
  // independently so they never fight each other: the flyout is shown when
  // either is active. Tap keeps it open after the pointer leaves; touch, which
  // never hovers, relies on the pin alone.
  let hovered = $state(false);
  let pinned = $state(false);
  const open = $derived(hovered || pinned);
  let wrap: HTMLElement;

  const canHover = () => window.matchMedia('(hover: hover)').matches;

  function onenter() {
    if (canHover()) hovered = true;
  }
  function onleave() {
    if (canHover()) hovered = false;
  }
  function toggle() {
    pinned = !pinned;
  }

  // Light dismiss: click outside or Escape clears both states.
  function onwindowclick(e: MouseEvent) {
    if (pinned && wrap && !wrap.contains(e.target as Node)) pinned = false;
  }
  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      pinned = false;
      hovered = false;
    }
  }
</script>

<svelte:window onclick={onwindowclick} onkeydown={onkeydown} />

<span
  class="flyout"
  bind:this={wrap}
  onmouseenter={onenter}
  onmouseleave={onleave}
  role="presentation"
>
  <button
    type="button"
    class="trigger"
    aria-label={label}
    aria-expanded={open}
    title={label}
    onclick={toggle}
  >
    <Info size={16} aria-hidden="true" />
  </button>

  {#if open}
    <div class="panel" role="dialog" aria-label={label} style:--flyout-accent={accent}>
      {@render children()}
    </div>
  {/if}
</span>

<style>
  .flyout {
    position: relative;
    display: inline-flex;
    vertical-align: middle;
  }
  .trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
    border: none;
    background: none;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: var(--radius);
    transition: color var(--transition);
  }
  .trigger:hover,
  .trigger[aria-expanded='true'] {
    color: var(--text);
  }
  .trigger:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .panel {
    position: absolute;
    top: calc(100% + 8px);
    /* Anchor to the trigger's right edge — the flyout triggers live on the
       right of the combat panel, so this keeps the popover off the viewport
       edge on narrow/mobile screens. */
    right: 0;
    z-index: 20;
    width: max-content;
    max-width: min(320px, 80vw);
    padding: var(--space-3);
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-top: 2px solid var(--flyout-accent);
    border-radius: var(--radius);
    box-shadow: 0 6px 20px rgb(0 0 0 / 35%);
    font-size: 13px;
    line-height: 1.5;
    text-align: left;
    white-space: normal;
    cursor: default;
    animation: flyIn 0.12s ease;
  }
  /* Little pointer up toward the trigger (which sits at the panel's right). */
  .panel::before {
    content: '';
    position: absolute;
    bottom: 100%;
    right: 6px;
    border: 6px solid transparent;
    border-bottom-color: var(--flyout-accent);
  }
  @keyframes flyIn {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .panel {
      animation: none;
    }
  }
</style>

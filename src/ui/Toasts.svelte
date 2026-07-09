<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { notify } from './notify.svelte';
</script>

<div class="toasts" aria-live="polite">
  {#each notify.toasts as toast (toast.id)}
    <button
      class="toast {toast.kind}"
      in:fly={{ y: 16, duration: 260 }}
      out:fade={{ duration: 200 }}
      onclick={() => notify.dismiss(toast.id)}
    >
      {#if toast.kind === 'level'}🏰 {/if}{toast.text}
    </button>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    left: 0;
    right: 0;
    bottom: var(--space-4);
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    pointer-events: none;
    padding: 0 var(--space-4);
  }
  .toast {
    pointer-events: auto;
    max-width: 90vw;
    font-family: var(--font-body);
    font-size: 15px;
    color: var(--text);
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-left-width: 4px;
    border-radius: var(--radius);
    padding: var(--space-2) var(--space-4);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
    cursor: pointer;
  }
  .toast.info {
    border-left-color: var(--accent);
  }
  .toast.good {
    border-left-color: var(--good);
  }
  .toast.level {
    border-left-color: var(--gold);
    color: var(--gold);
    font-family: var(--font-display);
    font-size: 20px;
    letter-spacing: 0;
    animation: pop 0.4s ease;
  }
  @keyframes pop {
    0% {
      transform: scale(0.9);
    }
    60% {
      transform: scale(1.06);
    }
    100% {
      transform: scale(1);
    }
  }
</style>

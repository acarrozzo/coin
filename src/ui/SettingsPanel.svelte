<script lang="ts">
  import { game } from './gameStore.svelte';
  import { sound } from './sound.svelte';
  import { format } from './format.svelte';
  import { look, PALETTES, FONTS, LAYOUTS, type Option } from './theme.svelte';
  import Palette from '@lucide/svelte/icons/palette';
  import Type from '@lucide/svelte/icons/type';
  import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
  import X from '@lucide/svelte/icons/x';

  let { onclose }: { onclose: () => void } = $props();

  let importText = $state('');
  let copied = $state(false);

  // Bucket a flat option list into ordered { label, items } groups for
  // <optgroup> rendering.
  function grouped(list: readonly Option[]) {
    const groups: { label: string; items: readonly Option[] }[] = [];
    for (const opt of list) {
      const last = groups[groups.length - 1];
      if (last && last.label === opt.group) (last.items as Option[]).push(opt);
      else groups.push({ label: opt.group, items: [opt] });
    }
    return groups;
  }

  const paletteGroups = grouped(PALETTES);
  const fontGroups = grouped(FONTS);
  const layoutFlat = LAYOUTS;

  async function copySave() {
    try {
      await navigator.clipboard.writeText(game.exportSave());
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      // clipboard blocked — the download button still works
    }
  }

  function downloadSave() {
    const blob = new Blob([game.exportSave()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'coin-castle-save.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function loadSave() {
    if (!importText.trim()) return;
    if (!game.importSave(importText.trim())) {
      alert('That doesn’t look like a valid save.');
    }
  }

  function reset() {
    if (confirm('Reset all progress? This cannot be undone.')) game.reset();
  }
</script>

<aside class="settings side-panel" aria-label="Settings">
  <div class="head">
    <h2>Settings</h2>
    <button class="close" onclick={onclose} title="Close settings" aria-label="Close settings">
      <X size={18} aria-hidden="true" />
    </button>
  </div>

  <div class="body">
    <section class="section">
      <h3 class="section-title">Look Explorer</h3>

      <div class="control" role="group" aria-label="Color palette">
        <span class="ctl-label"><Palette size={13} aria-hidden="true" /> Color</span>
        {#each paletteGroups as g (g.label)}
          <span class="group-label">{g.label}</span>
          <div class="options">
            {#each g.items as p (p.id)}
              <button
                type="button"
                class="option swatch-option"
                class:selected={look.palette === p.id}
                aria-pressed={look.palette === p.id}
                data-palette={p.id}
                onclick={() => (look.palette = p.id as typeof look.palette)}>
                <span class="swatches" aria-hidden="true">
                  <span class="swatch" style="background: var(--accent)"></span>
                  <span class="swatch" style="background: var(--good)"></span>
                  <span class="swatch" style="background: var(--bad)"></span>
                  <span class="swatch" style="background: var(--gold)"></span>
                </span>
                <span class="swatch-name">{p.name}</span>
              </button>
            {/each}
          </div>
        {/each}
      </div>

      <div class="control" role="group" aria-label="Font">
        <span class="ctl-label"><Type size={13} aria-hidden="true" /> Font</span>
        {#each fontGroups as g (g.label)}
          <span class="group-label">{g.label}</span>
          <div class="options">
            {#each g.items as f (f.id)}
              <button
                type="button"
                class="option"
                class:selected={look.font === f.id}
                aria-pressed={look.font === f.id}
                onclick={() => (look.font = f.id as typeof look.font)}>{f.name}</button>
            {/each}
          </div>
        {/each}
      </div>

      <div class="control" role="group" aria-label="Layout">
        <span class="ctl-label"><LayoutDashboard size={13} aria-hidden="true" /> Layout</span>
        <div class="options">
          {#each layoutFlat as l (l.id)}
            <button
              type="button"
              class="option"
              class:selected={look.layout === l.id}
              aria-pressed={look.layout === l.id}
              onclick={() => (look.layout = l.id as typeof look.layout)}>{l.name}</button>
          {/each}
        </div>
      </div>
    </section>

    <section class="section">
      <h3 class="section-title">Game</h3>

      <label class="row toggle">
        <span>Sound effects</span>
        <input type="checkbox" checked={sound.enabled} onchange={() => sound.toggle()} />
      </label>

      <label class="row toggle">
        <span>Round large numbers<small>Show 1.1K instead of 1112</small></span>
        <input type="checkbox" checked={format.rounding} onchange={() => format.toggle()} />
      </label>

      <div class="row">
        <span>Save data</span>
        <div class="actions">
          <button onclick={copySave}>{copied ? 'Copied!' : 'Copy'}</button>
          <button onclick={downloadSave}>Download</button>
        </div>
      </div>

      <div class="import">
        <textarea
          bind:value={importText}
          placeholder="Paste a save to import…"
          rows="2"
          spellcheck="false"
        ></textarea>
        <button onclick={loadSave} disabled={!importText.trim()}>Import</button>
      </div>

      <div class="row danger">
        <span>Danger zone</span>
        <button class="reset" onclick={reset}>Reset game</button>
      </div>
    </section>
  </div>
</aside>

<style>
  .settings {
    display: flex;
    flex-direction: column;
    background: var(--bg-panel);
    border: var(--panel-border);
    border-radius: var(--panel-radius);
    box-shadow: var(--panel-shadow);
    /* Desktop: a sticky right-hand column that scrolls independently. Parked
       just below the sticky header (its measured height + a gap) so scrolling
       never tucks the panel's title under the header. */
    position: sticky;
    top: calc(var(--header-h, 56px) + var(--space-3));
    max-height: calc(100vh - var(--header-h, 56px) - var(--space-4));
    /* Line the panel's top up with the first content panel (main's padding). */
    margin-top: var(--space-4);
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--border);
  }
  .head h2 {
    font-family: var(--font-display);
    font-size: 22px;
    color: var(--text);
  }
  .close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 0;
    color: var(--text-muted);
    padding: 4px;
    border-radius: var(--radius);
    cursor: pointer;
    transition: color var(--transition), background var(--transition);
  }
  .close:hover {
    color: var(--text);
    background: color-mix(in srgb, var(--text) 10%, transparent);
  }
  .body {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-4);
  }
  .section {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .section-title {
    font-family: var(--font-display);
    font-size: 18px;
    color: var(--text-muted);
    letter-spacing: var(--letter-spacing);
  }

  /* Look Explorer controls */
  .control {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .ctl-label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--text-muted);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }
  .group-label {
    color: var(--text-muted);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    opacity: 0.7;
  }
  .options {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .options .option {
    padding: 5px 10px;
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    transition:
      border-color var(--transition),
      background var(--transition);
  }
  .options .option:hover {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, transparent);
  }
  .options .option.selected {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 28%, transparent);
  }
  .options .option:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  /* Palette buttons preview their own theme: because each carries its own
     data-palette, the .option rules above resolve --bg/--text/--accent/--border
     from that theme, not the active one. The swatch dots surface the rest of
     the palette at a glance. */
  .swatch-option {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 5px 9px;
  }
  .swatch-option.selected {
    /* Ring in the theme's own accent, but keep the theme's own bg so the
       preview stays faithful rather than tinting toward the accent. */
    background: var(--bg);
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent);
  }
  .swatch-option:hover {
    background: var(--bg);
    border-color: var(--accent);
  }
  .swatches {
    display: inline-flex;
    gap: 2px;
    flex-shrink: 0;
  }
  .swatch {
    width: 9px;
    height: 9px;
    border-radius: 2px;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--text) 20%, transparent);
  }
  .swatch-name {
    white-space: nowrap;
  }

  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
  }
  .actions {
    display: flex;
    gap: var(--space-2);
  }
  .import {
    display: flex;
    gap: var(--space-2);
    align-items: stretch;
  }
  textarea {
    flex: 1;
    font-family: var(--font-body);
    font-size: 13px;
    background: var(--bg);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: var(--space-2);
    resize: vertical;
  }
  button {
    padding: 6px 14px;
    font-size: 14px;
    border: 1px solid var(--border);
    background: color-mix(in srgb, var(--accent) 18%, transparent);
    color: var(--text);
    border-radius: var(--radius);
    transition: background var(--transition);
  }
  button:hover:not(:disabled) {
    background: color-mix(in srgb, var(--accent) 34%, transparent);
  }
  button:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .toggle input {
    width: 18px;
    height: 18px;
  }
  .toggle span {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .toggle span small {
    color: var(--text-muted);
    font-size: 11px;
  }
  .reset {
    background: transparent;
    border-color: var(--bad);
    color: var(--bad);
  }
  .reset:hover:not(:disabled) {
    background: color-mix(in srgb, var(--bad) 18%, transparent);
  }

  /* Below the split breakpoint, settings detaches into a right-hand drawer
     that overlays the content. No backdrop — the content behind stays lit and
     interactive; close via the ✕ only. A shadow separates it from the page. */
  @media (max-width: 1023px) {
    .settings {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: min(380px, 92vw);
      max-height: none;
      margin-top: 0;
      z-index: 30;
      border: 0;
      border-left: 1px solid var(--border);
      border-radius: 0;
      box-shadow: -10px 0 30px rgba(0, 0, 0, 0.4);
      animation: drawerIn var(--transition);
    }
  }
  @keyframes drawerIn {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .settings {
      animation: none;
    }
  }
</style>

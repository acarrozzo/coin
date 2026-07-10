<script lang="ts">
  import { look, PALETTES, FONTS, LAYOUTS, type Option } from './theme.svelte';
  import Palette from '@lucide/svelte/icons/palette';
  import Type from '@lucide/svelte/icons/type';
  import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';

  // Whether the controls row is expanded. Persisted so the bar remembers.
  const OPEN_KEY = 'cc:explorer-open';
  let open = $state(localStorage.getItem(OPEN_KEY) !== 'false');

  function toggle() {
    open = !open;
    localStorage.setItem(OPEN_KEY, String(open));
  }

  // Bucket a flat option list into ordered { label, items } groups for
  // <optgroup> rendering. When everything shares one group we skip the
  // headings and render a plain list.
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
</script>

<div class="explorer" class:open>
  <button class="brand" onclick={toggle} aria-expanded={open} title="Show / hide look controls">
    <Palette size={15} aria-hidden="true" />
    <span class="brand-label">Look Explorer</span>
    <ChevronDown size={14} aria-hidden="true" class="chev" />
  </button>

  {#if open}
    <div class="controls">
      <label class="control">
        <span class="ctl-label"><Palette size={13} aria-hidden="true" /> Color</span>
        <select bind:value={look.palette} aria-label="Color palette">
          {#each paletteGroups as g (g.label)}
            <optgroup label={g.label}>
              {#each g.items as p (p.id)}
                <option value={p.id}>{p.name}</option>
              {/each}
            </optgroup>
          {/each}
        </select>
      </label>

      <label class="control">
        <span class="ctl-label"><Type size={13} aria-hidden="true" /> Font</span>
        <select bind:value={look.font} aria-label="Font">
          {#each fontGroups as g (g.label)}
            <optgroup label={g.label}>
              {#each g.items as f (f.id)}
                <option value={f.id}>{f.name}</option>
              {/each}
            </optgroup>
          {/each}
        </select>
      </label>

      <label class="control">
        <span class="ctl-label"><LayoutDashboard size={13} aria-hidden="true" /> Layout</span>
        <select bind:value={look.layout} aria-label="Layout">
          {#each layoutFlat as l (l.id)}
            <option value={l.id}>{l.name}</option>
          {/each}
        </select>
      </label>
    </div>
  {/if}
</div>

<style>
  .explorer {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
    padding: 6px var(--space-4);
    /* Deliberately neutral chrome so it reads as a tool, not part of the game,
       while still following the active palette. */
    background: color-mix(in srgb, var(--bg) 82%, #000 10%);
    border-bottom: 1px solid var(--border);
    font-family: var(--font-body);
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    border: 0;
    color: var(--text-muted);
    font-family: var(--font-body);
    font-size: 13px;
    letter-spacing: var(--letter-spacing);
    padding: 2px 4px;
  }
  .brand-label {
    white-space: nowrap;
  }
  .brand :global(.chev) {
    transition: transform var(--transition);
  }
  .explorer.open .brand :global(.chev) {
    transform: rotate(180deg);
  }

  .controls {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    flex-wrap: wrap;
  }
  .control {
    display: inline-flex;
    align-items: center;
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

  select {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text);
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 3px 6px;
    cursor: pointer;
    transition: border-color var(--transition);
  }
  select:hover {
    border-color: var(--accent);
  }
  select:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  @media (max-width: 480px) {
    .explorer {
      padding: 6px var(--space-3);
      gap: var(--space-2);
    }
    .controls {
      gap: var(--space-3);
      width: 100%;
    }
    .control {
      flex: 1 1 auto;
    }
    select {
      width: 100%;
    }
  }
</style>

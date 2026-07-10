<script lang="ts">
  import { game } from './gameStore.svelte';
  import { sound } from './sound.svelte';

  let importText = $state('');
  let copied = $state(false);

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

<details class="panel">
  <summary>Settings</summary>
  <div class="body">
    <label class="row toggle">
      <span>Sound effects</span>
      <input type="checkbox" checked={sound.enabled} onchange={() => sound.toggle()} />
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
  </div>
</details>

<style>
  .panel {
    background: var(--bg-panel);
    border: var(--panel-border);
    border-radius: var(--panel-radius);
    box-shadow: var(--panel-shadow);
    padding: var(--space-3) var(--space-4);
  }
  summary {
    font-family: var(--font-display);
    font-size: 20px;
    cursor: pointer;
    color: var(--text-muted);
  }
  summary:hover {
    color: var(--text);
  }
  .body {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin-top: var(--space-3);
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
  .reset {
    background: transparent;
    border-color: var(--bad);
    color: var(--bad);
  }
  .reset:hover:not(:disabled) {
    background: color-mix(in srgb, var(--bad) 18%, transparent);
  }
</style>

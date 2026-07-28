<script lang="ts">
  /**
   * The Prestige zone — the one screen in the game that destroys progress, so it
   * is built to be read before it is pressed.
   *
   * Framed as a card in the same idiom as ResourcePanel's structure groups, and
   * split into two sub-tabs like the Market: **Next** (the legacy on offer) and
   * **Taken** (the ones already claimed). Everything the button will cost you is
   * on screen before it is reachable — the held-not-spent threshold, what you
   * keep, what you lose — and the button itself is behind a two-step confirm.
   * Every other action in the game is recoverable by playing on; this one isn't.
   *
   * `prestige.level` is presented throughout as a **level**, the same way the
   * settlement's numeric level fronts a tier name.
   */
  import { game } from './gameStore.svelte';
  import { RESOURCES, type ResourceId } from '../content/resources';
  import type { ResourceCost } from '../content/settlement';
  import { PRESTIGE_TIERS, MAX_PRESTIGE, PRESTIGE_UNLOCK_LEVEL } from '../content/prestige';
  import { getNextPrestigeTier, canPrestige, getTotalWorkers } from '../engine/selectors';
  import { formatNumber } from '../engine/numbers';
  import { RESOURCE_ICON } from './resourceIcons';
  import { jumpToResource, hasResourceRow } from './nav.svelte';
  import Crown from '@lucide/svelte/icons/crown';
  import User from '@lucide/svelte/icons/user';
  import Check from '@lucide/svelte/icons/check';
  import X from '@lucide/svelte/icons/x';
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

  const gs = $derived(game.state);
  const level = $derived(gs.prestige.level);
  const next = $derived(getNextPrestigeTier(gs));
  const ready = $derived(canPrestige(gs));
  const total = $derived(getTotalWorkers(gs));
  const taken = $derived(PRESTIGE_TIERS.slice(0, level));

  type Tab = 'next' | 'taken';
  // Which sub-tab the player last chose. Null means "haven't chosen" — fall back
  // to Next unless every legacy is claimed, so a maxed player doesn't land on a
  // tab with nothing on it. View state, deliberately not persisted.
  let chosen = $state<Tab | null>(null);
  const tab = $derived<Tab>(chosen ?? (next ? 'next' : 'taken'));

  const TABS: { id: Tab; label: string }[] = [
    { id: 'next', label: 'Next' },
    { id: 'taken', label: 'Taken' },
  ];

  /** Left/right arrows move between tabs, per the tablist pattern. */
  function onTabKey(e: KeyboardEvent): void {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    chosen = tab === 'next' ? 'taken' : 'next';
  }

  /** Two-step confirm. Disarmed whenever the offer underneath it changes. */
  let confirming = $state(false);
  $effect(() => {
    // Touch the things that would make a pending confirm stale.
    void level;
    void ready;
    void tab;
    confirming = false;
  });

  function costEntries(cost: ResourceCost) {
    return Object.entries(cost) as [ResourceId, number][];
  }

  function act(): void {
    if (!confirming) {
      confirming = true;
      return;
    }
    game.prestige();
    // Land on the ledger of what was just claimed.
    chosen = 'taken';
  }

  const KEEPS = ['Honor and Wisdom', 'Your prestige level', 'Your starting workers, permanently'];
  const LOSES = [
    'Settlement level and every building',
    'All other resources',
    'Assault and hex progress',
    'Market offers (they return, unbought)',
  ];
  const jumpTo = jumpToResource;
</script>

<!-- One threshold chip: green when you hold it, red when you don't. Clickable
     only when the resource has a producer row to land on — honor, the tier-1
     threshold, is won in combat and has none, so that chip stays plain text. -->
{#snippet chipText(rid: ResourceId, amt: number)}
  {@const Icon = RESOURCE_ICON[rid]}
  <Icon size={13} aria-hidden="true" />
  {formatNumber(amt)}
  {RESOURCES[rid].name}
{/snippet}

{#snippet thresholdChip(rid: ResourceId, amt: number)}
  {@const met = gs.resources[rid].amount.gte(amt)}
  {#if hasResourceRow(gs, rid)}
    <button
      type="button"
      class="cost-item jump"
      class:short={!met}
      class:met
      title="Go to {RESOURCES[rid].name}"
      onclick={() => jumpTo(rid)}>{@render chipText(rid, amt)}</button
    >
  {:else}
    <span class="cost-item" class:short={!met} class:met>{@render chipText(rid, amt)}</span>
  {/if}
{/snippet}

<section class="panel prestige" data-nav="prestige" aria-label="Prestige">
  <header class="head">
    <Crown size={22} color="var(--accent)" aria-hidden="true" />
    <h2>Prestige</h2>
    {#if level > 0}
      <span class="lvl" title="Prestige level">Lvl {level}</span>
    {/if}
  </header>

  <!-- Sub-tabs, in the Market's idiom. The Next badge counts what can be acted
       on right now; the Taken badge is simply how many you've claimed. -->
  <div class="tabs" role="tablist" aria-label="Prestige sections">
    {#each TABS as t (t.id)}
      {@const count = t.id === 'next' ? (ready ? 1 : 0) : level}
      <button
        type="button"
        role="tab"
        id="prestige-tab-{t.id}"
        aria-selected={tab === t.id}
        aria-controls="prestige-panel-{t.id}"
        tabindex={tab === t.id ? 0 : -1}
        class:active={tab === t.id}
        onclick={() => (chosen = t.id)}
        onkeydown={onTabKey}
      >
        {t.label}
        <span class="badge" class:live={count > 0} aria-label="{count} available">{count}</span>
      </button>
    {/each}
  </div>

  {#if tab === 'next'}
    <div
      class="tab-panel"
      role="tabpanel"
      id="prestige-panel-next"
      aria-labelledby="prestige-tab-next"
      tabindex="-1"
    >
      {#if next}
        <div class="offer">
          <div class="info">
            <span class="name">
              <span class="tier-lvl">Lvl {next.n}</span>
              {next.name}
            </span>
            <span class="blurb">{next.blurb}</span>
          </div>

          <div class="action">
            <span class="cost">
              {#each costEntries(next.requires) as [rid, amt] (rid)}
                {@render thresholdChip(rid, amt)}
              {/each}
              {#if gs.level < PRESTIGE_UNLOCK_LEVEL}
                <span class="cost-item short">Settlement Level {PRESTIGE_UNLOCK_LEVEL}</span>
              {/if}
            </span>

            <button type="button" class:confirming onclick={act} disabled={!ready}>
              {#if confirming}
                <TriangleAlert size={14} aria-hidden="true" />
                Confirm — start over
              {:else}
                Prestige
              {/if}
            </button>
          </div>
        </div>

        <!-- Held, not spent: the same language settlement tiers use for `requires`. -->
        <p class="note">
          Held, not spent — prestiging doesn't consume your
          {costEntries(next.requires)
            .map(([rid]) => RESOURCES[rid].name)
            .join(' or ')}. You start again in the wilderness with
          <strong>{next.workers} workers</strong>
          instead of none{level > 0 ? ` (up from ${PRESTIGE_TIERS[level - 1].workers})` : ''}.
        </p>

        <div class="ledger">
          <div class="col keep">
            <h3><Check size={13} aria-hidden="true" /> You keep</h3>
            <ul>
              {#each KEEPS as k (k)}<li>{k}</li>{/each}
            </ul>
          </div>
          <div class="col lose">
            <h3><X size={13} aria-hidden="true" /> You lose</h3>
            <ul>
              {#each LOSES as l (l)}<li>{l}</li>{/each}
            </ul>
          </div>
        </div>
      {:else}
        <p class="empty">
          Every legacy claimed — Prestige Lvl {level} of {MAX_PRESTIGE}. You rule with {total} workers
          behind you and nothing left to walk away from, for now.
        </p>
      {/if}
    </div>
  {:else}
    <div
      class="tab-panel"
      role="tabpanel"
      id="prestige-panel-taken"
      aria-labelledby="prestige-tab-taken"
      tabindex="-1"
    >
      {#if taken.length > 0}
        <ol class="taken">
          {#each taken as t (t.n)}
            <li class="taken-row">
              <span class="tick"><Check size={13} aria-hidden="true" /></span>
              <span class="tname">
                <span class="tier-lvl">Lvl {t.n}</span>
                {t.name}
              </span>
              <span class="tmeta">
                {#each costEntries(t.requires) as [rid, amt] (rid)}
                  {@const Icon = RESOURCE_ICON[rid]}
                  <span class="chip" title="Threshold held, never spent">
                    <Icon size={12} aria-hidden="true" />
                    {formatNumber(amt)}
                    {RESOURCES[rid].name}
                  </span>
                {/each}
                <span class="chip grant" title="Workers this run starts with">
                  <User size={12} aria-hidden="true" />
                  {t.workers} to start
                </span>
              </span>
            </li>
          {/each}
        </ol>
      {:else}
        <p class="empty">
          No legacies yet. Repel an assault for honor, then walk away from it all — you'll come back
          with twenty-one at your back.
        </p>
      {/if}
    </div>
  {/if}
</section>

<style>
  /* Framed like the structure cards in ResourcePanel and the Combat panel, so
     every zone on the page reads as the same kind of object. */
  .prestige {
    background: var(--bg-panel);
    border: var(--panel-border);
    border-top: 3px solid var(--accent);
    border-radius: var(--panel-radius);
    box-shadow: var(--panel-shadow);
    padding: var(--panel-pad);
    animation: fadeIn var(--fade-in);
  }
  /* Settings can drop the colored accent strip; fall back to the plain frame. */
  :global(:root[data-accent-border='off']) .prestige {
    border-top: var(--panel-border);
  }

  .head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
    flex-wrap: wrap;
  }
  .head h2 {
    font-family: var(--font-display);
    font-size: 24px;
    color: var(--text);
  }
  .head .lvl {
    font-family: var(--font-display);
    font-size: 24px;
    color: var(--accent);
  }

  /* Sub-tabs: an underlined rail rather than boxed buttons, so they read as a
     division of the card below rather than as two more things to press. */
  .tabs {
    display: flex;
    gap: var(--space-3);
    border-bottom: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
    margin-bottom: var(--space-3);
  }
  .tabs button {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 7px 2px 8px;
    margin-bottom: -1px;
    background: none;
    border: 0;
    border-bottom: 2px solid transparent;
    font-family: var(--font-display);
    font-size: 17px;
    color: var(--text-muted);
    cursor: pointer;
    transition:
      color var(--transition),
      border-color var(--transition);
  }
  .tabs button:hover {
    color: var(--text);
  }
  .tabs button.active {
    color: var(--text);
    border-bottom-color: var(--accent);
  }
  .tabs button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .badge {
    min-width: 18px;
    padding: 0 5px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--border) 60%, transparent);
    color: var(--text-muted);
    font-family: var(--font-body, inherit);
    font-size: 11px;
    line-height: 17px;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  .badge.live {
    background: color-mix(in srgb, var(--gold) 30%, transparent);
    color: var(--gold);
  }

  .tab-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .tab-panel:focus {
    outline: none;
  }

  /* --- Next --- */
  .offer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .info {
    display: flex;
    flex-direction: column;
    /* Keeps the blurb from squeezing the cost/button column to nothing. */
    flex: 1 1 16rem;
  }
  .name {
    font-family: var(--font-display);
    font-size: 28px;
  }
  .tier-lvl {
    color: var(--accent);
  }
  .blurb {
    color: var(--text-muted);
    font-size: 14px;
  }
  .action {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  .cost {
    display: flex;
    gap: var(--space-3);
    font-size: 14px;
    flex-wrap: wrap;
  }
  .cost-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .cost-item.short {
    color: var(--bad);
  }
  .cost-item.met {
    color: var(--good);
  }
  /* A threshold chip that links to its resource's row. Undoes the zone's
     action-button styling (the button:not([role='tab']) rule below) so it still
     reads as a chip, not a second button beside Prestige.

     Scoped through .cost to outrank that rule and its :hover — a bare
     `button.cost-item` ties with `button:not([role='tab'])` on specificity and
     would lose on source order. */
  .cost button.cost-item {
    padding: 0;
    border: 0;
    background: none;
    border-radius: 0;
    gap: 4px;
    font: inherit;
    font-size: 14px;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
  }
  .cost button.cost-item:hover,
  .cost button.cost-item:focus-visible {
    background: none;
    color: var(--accent);
    text-decoration: underline;
    text-underline-offset: 2px;
    outline: none;
  }

  button:not([role='tab']) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 16px;
    font-size: 15px;
    border: 1px solid var(--border);
    background: color-mix(in srgb, var(--gold) 20%, transparent);
    color: var(--text);
    border-radius: var(--radius);
    transition: background var(--transition);
    white-space: nowrap;
  }
  button:not([role='tab']):hover:not(:disabled) {
    background: color-mix(in srgb, var(--gold) 38%, transparent);
  }
  button:not([role='tab']):disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  /* The armed state reads as a warning, not a second identical button. */
  button.confirming {
    background: color-mix(in srgb, var(--bad) 30%, transparent);
    border-color: var(--bad);
  }
  button.confirming:hover:not(:disabled) {
    background: color-mix(in srgb, var(--bad) 48%, transparent);
  }

  .note {
    color: color-mix(in srgb, var(--text-muted) 78%, var(--bg-panel));
    font-size: 13px;
    line-height: 1.5;
  }
  .note strong {
    color: var(--gold);
  }

  .ledger {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: var(--space-4);
    border-top: 1px solid var(--border);
    padding-top: var(--space-4);
  }
  .col h3 {
    display: flex;
    align-items: center;
    gap: 5px;
    font-family: var(--font-display);
    font-size: 15px;
    margin-bottom: var(--space-2);
  }
  .keep h3 {
    color: var(--good);
  }
  .lose h3 {
    color: var(--bad);
  }
  .col ul {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .col li {
    color: var(--text-muted);
    font-size: 13px;
  }

  /* --- Taken --- */
  .taken {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .taken-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
    padding: var(--space-2) 0;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
  }
  .taken-row:last-child {
    border-bottom: 0;
  }
  .tick {
    display: inline-flex;
    color: var(--good);
  }
  .tname {
    font-family: var(--font-display);
    font-size: 19px;
  }
  .tmeta {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
    margin-left: auto;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text-muted);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .chip.grant {
    color: var(--gold);
  }

  .empty {
    color: var(--text-muted);
    font-size: 14px;
    line-height: 1.5;
  }
</style>

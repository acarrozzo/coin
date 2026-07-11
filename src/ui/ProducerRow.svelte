<script lang="ts">
  import { game } from './gameStore.svelte';
  import { RESOURCES, type ResourceId } from '../content/resources';
  import { PRODUCERS } from '../content/producers';
  import {
    canStartCycle,
    getAvailableWorkers,
    getMaxWorkers,
    getCapacity,
  } from '../engine/selectors';
  import { formatNumber, formatCycleRate } from '../engine/numbers';
  import { RESOURCE_ICON, jumpToResource } from './resourceIcons';

  interface Props {
    id: ResourceId;
    /** Show `amount / cap` when the resource has a hard cap (e.g. Defense). */
    showCap?: boolean;
  }
  const { id, showCap = false }: Props = $props();

  const gs = $derived(game.state);
  const available = $derived(getAvailableWorkers(gs));

  const Icon = $derived(RESOURCE_ICON[id]);
  const assigned = $derived(gs.workers.assigned[id]);
  const maxWorkers = $derived(getMaxWorkers(gs, id));
  const showMax = $derived(PRODUCERS[id]?.workerCap === 'level' || PRODUCERS[id]?.workerCap === 1);
  const cycleSeconds = $derived(PRODUCERS[id]?.cycleSeconds ?? 1);
  const outputPerCycle = $derived(PRODUCERS[id]?.outputPerCycle ?? 0);
  const cap = $derived(showCap ? getCapacity(gs, id) : null);

  // A crafting line that can't muster a full batch of some input (needs
  // workers × qty of every ingredient, all-or-nothing) is "starved".
  const starved = $derived.by<ResourceId | null>(() => {
    const p = PRODUCERS[id];
    if (!p?.inputs || assigned === 0) return null;
    for (const [rid, qty] of Object.entries(p.inputs) as [ResourceId, number][]) {
      if (gs.resources[rid].amount.lt(assigned * qty)) return rid;
    }
    return null;
  });
  const producing = $derived(assigned > 0 && canStartCycle(gs, id));

  function inputEntries(): [ResourceId, number][] {
    return Object.entries(PRODUCERS[id]?.inputs ?? {}) as [ResourceId, number][];
  }

  let highlighted = $state<ResourceId | null>(null);
  let highlightTimer: ReturnType<typeof setTimeout> | undefined;
  function jump(rid: ResourceId) {
    jumpToResource(rid, (r) => {
      highlighted = r;
      clearTimeout(highlightTimer);
      highlightTimer = setTimeout(() => (highlighted = null), 1600);
    });
  }
</script>

<div class="row" data-res={id}>
  <span class="ricon">
    {#if Icon}<Icon size={18} color="var(--text-muted)" aria-hidden="true" />{/if}
  </span>

  <div class="bars">
    <div
      class="cyc"
      class:producing
      style:--cyc={cycleSeconds + 's'}
      title="Production cycle: {cycleSeconds}s"
    >
      <div class="cyc-fill"></div>
    </div>
  </div>

  <span class="label">
    <span class="amount">{formatNumber(gs.resources[id].amount)}</span>
    {#if cap && cap.gt(0)}<span class="cap">/ {formatNumber(cap)}</span>{/if}
    <span class="name" class:jumped={highlighted === id}>{RESOURCES[id].name}</span>
    {#each game.pops.filter((p) => p.id === id) as p (p.seq)}
      <span class="pop">+{formatNumber(p.amount)}</span>
    {/each}
  </span>

  <div class="workers">
    <button
      onclick={() => game.assign(id, -1)}
      disabled={assigned === 0}
      aria-label="Remove worker from {RESOURCES[id].name}">−</button
    >
    <span class="count">{assigned}{#if showMax}/{maxWorkers}{/if}</span>
    <button
      onclick={() => game.assign(id, 1)}
      disabled={available <= 0 || assigned >= maxWorkers}
      aria-label="Add worker to {RESOURCES[id].name}">+</button
    >
  </div>

  <span class="rate" class:idle={assigned === 0}>
    {#if starved}
      <span class="warn">needs {RESOURCES[starved].name}</span>
    {:else}
      +{formatCycleRate(assigned * outputPerCycle, RESOURCES[id].name.toLowerCase(), cycleSeconds)}
    {/if}
  </span>

  <span class="rcost">
    {#each inputEntries() as [rid, amt] (rid)}
      <span class="pill" class:short={gs.resources[rid].amount.lt(amt)}>
        <button type="button" class="req jump" onclick={() => jump(rid)}
          >{formatNumber(amt)} {RESOURCES[rid].name.toLowerCase()}</button
        ><span class="held">/{formatNumber(gs.resources[rid].amount)}</span>
      </span>
    {/each}
  </span>
</div>

<style>
  /* Same column layout as ResourcePanel's producer rows, so Defense in the
     Assault panel reads identically to every other resource line. */
  .row {
    display: grid;
    grid-template-columns: 20px 96px 150px 116px auto minmax(0, 1fr);
    column-gap: var(--space-3);
    align-items: center;
    scroll-margin-block: calc(var(--header-h, 72px) + var(--space-3));
  }
  .ricon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .bars {
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .cyc {
    height: 6px;
    background: color-mix(in srgb, var(--border) 40%, transparent);
    border-radius: 999px;
    overflow: hidden;
  }
  .cyc-fill {
    height: 100%;
    width: 0;
    background: var(--accent);
    border-radius: 999px;
  }
  .cyc.producing .cyc-fill {
    animation: cycleFill var(--cyc, 1s) linear infinite;
  }
  @keyframes cycleFill {
    from {
      width: 0%;
    }
    to {
      width: 100%;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .cyc.producing .cyc-fill {
      animation: none;
      width: 100%;
    }
  }
  .label {
    position: relative;
    display: inline-flex;
    align-items: baseline;
    gap: 4px;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .amount {
    font-size: 17px;
  }

  /* Floating "+X" that rises off the amount each time a cycle completes. */
  .pop {
    position: absolute;
    left: 0;
    bottom: 100%;
    color: var(--good);
    font-size: 13px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    pointer-events: none;
    animation: gainPop 1s ease-out forwards;
  }
  @keyframes gainPop {
    0% {
      opacity: 0;
      transform: translateY(6px);
    }
    18% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: translateY(-16px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .pop {
      animation: gainPopFade 1s ease-out forwards;
    }
    @keyframes gainPopFade {
      0%,
      70% {
        opacity: 1;
      }
      100% {
        opacity: 0;
      }
    }
  }
  .cap {
    color: var(--text-muted);
    font-size: 14px;
  }
  .name {
    margin-left: 2px;
  }
  .name.jumped {
    border-radius: 3px;
    animation: nameMark 1.6s ease-out;
  }
  @keyframes nameMark {
    0%,
    25% {
      background: color-mix(in srgb, var(--gold) 60%, transparent);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--gold) 60%, transparent);
    }
    100% {
      background: transparent;
      box-shadow: 0 0 0 2px transparent;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .name.jumped {
      animation: none;
      background: color-mix(in srgb, var(--gold) 45%, transparent);
    }
  }
  .workers {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 40px;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  .workers button {
    width: 30px;
    height: 30px;
    font-size: 18px;
    line-height: 1;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text);
    border-radius: var(--radius);
    transition: background var(--transition);
  }
  .workers button:hover:not(:disabled) {
    background: color-mix(in srgb, var(--accent) 20%, transparent);
  }
  .workers button:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .rate {
    color: var(--good);
    font-size: 0.9em;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    text-align: left;
  }
  .rate.idle {
    color: var(--text-muted);
  }
  .warn {
    color: var(--bad);
  }
  .rcost {
    display: inline-flex;
    gap: var(--space-2);
    justify-content: flex-end;
  }
  .pill {
    color: var(--good);
    font-size: 13px;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .pill .req {
    border-bottom: 1px solid var(--good);
    padding-bottom: 1px;
  }
  .pill.short {
    color: var(--bad);
  }
  .pill.short .req {
    border-bottom-color: var(--bad);
  }
  .pill .held {
    color: var(--text-muted);
    font-size: 11px;
  }
  button.jump {
    background: none;
    border: 0;
    padding: 0;
    margin: 0;
    font: inherit;
    cursor: pointer;
    color: inherit;
  }
  button.jump:hover,
  button.jump:focus-visible {
    color: var(--accent);
    outline: none;
  }
  button.req.jump:hover,
  button.req.jump:focus-visible {
    border-bottom-color: var(--accent);
  }
  /* Narrow card: fall back to the same wrapped, stacked layout ResourcePanel
     uses when its cards get tight (keyed on the hosting container's width). */
  @container (max-width: 700px) {
    .row {
      grid-template-columns: 20px 1fr auto;
      grid-template-areas:
        'icon label workers'
        'bar bar bar'
        'rate rate rcost';
      row-gap: var(--space-2);
    }
    .ricon {
      grid-area: icon;
    }
    .label {
      grid-area: label;
    }
    .workers {
      grid-area: workers;
    }
    .bars {
      grid-area: bar;
    }
    .rate {
      grid-area: rate;
      text-align: left;
    }
    .rcost {
      grid-area: rcost;
    }
  }

  @media (max-width: 560px) {
    .workers button {
      width: 40px;
      height: 40px;
      font-size: 20px;
    }
  }
</style>

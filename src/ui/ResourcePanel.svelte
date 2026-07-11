<script lang="ts">
  import type { Component } from 'svelte';
  import { fly } from 'svelte/transition';
  import { game } from './gameStore.svelte';
  import { RESOURCES, type ResourceId } from '../content/resources';
  import { PRODUCERS, resourceDecimals, type StructureId } from '../content/producers';
  import { BUILDINGS, type BuildingId } from '../content/buildings';
  import type { ResourceCost } from '../content/settlement';
  import {
    unlockedResources,
    getAvailableWorkers,
    getMaxWorkers,
    getStructureLevel,
    getNextBuildingLevel,
    canBuild,
    isBuildingAvailable,
    isCombatUnlocked,
    isHexUnlocked,
    canStartCycle,
    getNetProductionRate,
  } from '../engine/selectors';
  import { formatNumber, formatCycleRate, formatSignedRate } from '../engine/numbers';
  import { RESOURCE_ICON } from './resourceIcons';

  // Barracks group header icon (also a resource icon, sourced below).
  import Swords from '@lucide/svelte/icons/swords';

  // Structure header icons.
  import Trees from '@lucide/svelte/icons/trees';
  import Pickaxe from '@lucide/svelte/icons/pickaxe';
  import Hammer from '@lucide/svelte/icons/hammer';
  import House from '@lucide/svelte/icons/house';
  import TowerControl from '@lucide/svelte/icons/tower-control';
  import Castle from '@lucide/svelte/icons/castle';
  import Landmark from '@lucide/svelte/icons/landmark';
  import Cloud from '@lucide/svelte/icons/cloud';

  const gs = $derived(game.state);
  const available = $derived(getAvailableWorkers(gs));
  const unlocked = $derived(unlockedResources(gs));

  // Each group is a structure card: a header (name + level + upgrade), the
  // resources it produces as single rows, and — for Core Resources — the Farm
  // upgrade as a footer (it blends settlement gathering + the Farm).
  interface GroupDef {
    key: string;
    label: string;
    icon: Component;
    /** Building whose upgrade this group owns (null = no upgrade, e.g. pure gathering). */
    building: BuildingId | null;
    /** Structures whose producers appear in this group, in row order. */
    structures: StructureId[];
    /** Core blends structures; its upgrade sits in a footer, not the header. */
    upgradeInFooter?: boolean;
  }

  const GROUP_DEFS: GroupDef[] = [
    {
      key: 'core',
      label: 'Core Resources',
      icon: Trees,
      building: 'farm',
      structures: ['settlement', 'farm'],
      upgradeInFooter: true,
    },
    {
      key: 'hunterscabin',
      label: "Hunter's Cabin",
      icon: House,
      building: 'hunterscabin',
      structures: ['hunterscabin'],
    },
    {
      key: 'blacksmith',
      label: 'Blacksmith',
      icon: Hammer,
      building: 'blacksmith',
      structures: ['blacksmith'],
    },
    {
      key: 'barracks',
      label: 'Barracks',
      icon: Swords,
      building: 'barracks',
      structures: ['barracks'],
    },
    {
      key: 'castle',
      label: 'Castle',
      icon: Castle,
      building: 'castle',
      structures: ['castle'],
    },
    {
      key: 'wizardtower',
      label: 'Wizard Tower',
      icon: TowerControl,
      building: 'wizardtower',
      structures: ['wizardtower'],
    },
    {
      key: 'deepmine',
      label: 'Deep Mine',
      icon: Pickaxe,
      building: 'deepmine',
      structures: ['deepmine'],
    },
    {
      key: 'bank',
      label: 'Bank',
      icon: Landmark,
      building: 'bank',
      structures: ['bank'],
    },
    {
      key: 'cloudshaman',
      label: 'Cloud Shaman',
      icon: Cloud,
      building: 'cloudshaman',
      structures: ['cloudshaman'],
    },
  ];

  // Once assault unlocks (settlement 7), Defense leaves the Castle card and
  // lives in the Assault panel instead — the Castle keeps its quest converters.
  // Likewise, once hex unlocks (settlement 8), Ward leaves the Wizard Tower card
  // and lives in the Hex panel — the Wizard Tower keeps its ether converter.
  const combatUnlocked = $derived(isCombatUnlocked(gs));
  const hexUnlocked = $derived(isHexUnlocked(gs));

  const groups = $derived(
    GROUP_DEFS.map((g) => ({
      ...g,
      ids: unlocked.filter(
        (id) =>
          g.structures.includes(PRODUCERS[id]?.structure as StructureId) &&
          !(id === 'defense' && combatUnlocked) &&
          !(id === 'ward' && hexUnlocked),
      ),
    })).filter(
      // Show a group once its resources exist, or once its building can be
      // built/upgraded (so an unbuilt structure is still reachable). Core is
      // always present.
      (g) =>
        g.key === 'core' ||
        g.ids.length > 0 ||
        (g.building !== null && isBuildingAvailable(gs, g.building)),
    ),
  );

  function costEntries(cost: ResourceCost) {
    return Object.entries(cost) as [ResourceId, number][];
  }

  function inputEntries(id: ResourceId) {
    return Object.entries(PRODUCERS[id]?.inputs ?? {}) as [ResourceId, number][];
  }

  // A crafting line with workers that can't muster a full batch of some input
  // (needs workers × qty of every ingredient, all-or-nothing) is "starved".
  function starvedInput(id: ResourceId): ResourceId | null {
    const p = PRODUCERS[id];
    const workers = gs.workers.assigned[id];
    if (!p?.inputs || workers === 0) return null;
    for (const [rid, qty] of Object.entries(p.inputs) as [ResourceId, number][]) {
      if (gs.resources[rid].amount.lt(workers * qty)) return rid;
    }
    return null;
  }

  // Clicking a resource name inside a recipe/build cost scrolls to that
  // resource's producer row and briefly calls it out.
  let highlighted = $state<ResourceId | null>(null);
  let highlightTimer: ReturnType<typeof setTimeout> | undefined;

  function jumpTo(rid: ResourceId) {
    const el = document.querySelector<HTMLElement>(`[data-res="${rid}"]`);
    if (!el) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    highlighted = rid;
    clearTimeout(highlightTimer);
    highlightTimer = setTimeout(() => (highlighted = null), 1600);
  }
</script>

<section class="panel">
  <div class="stack">
    {#each groups as group (group.key)}
      {@const GroupIcon = group.icon}
      {@const level = group.building ? getStructureLevel(gs, group.building) : 0}
      {@const next = group.building ? getNextBuildingLevel(gs, group.building) : null}
      {@const buildName = group.building ? BUILDINGS[group.building].name : ''}
      <div class="group" transition:fly={{ y: 10, duration: 300 }}>
        <header class="ghead">
          <div class="gtitle">
            <GroupIcon size={22} color="var(--accent)" aria-hidden="true" />
            <span class="gname"
              >{group.label}{#if !group.upgradeInFooter && level > 0}<span class="lvl">
                  Lvl {level}</span
                >{/if}</span
            >
          </div>
          {#if !group.upgradeInFooter && group.building && !next}
            <span class="maxed">MAX</span>
          {/if}
        </header>

        {#if !group.upgradeInFooter && next}
          <div class="upgrade-row">
            <button
              class="upgrade"
              onclick={() => game.build(group.building!)}
              disabled={!canBuild(gs, group.building!)}
            >
              {level === 0 ? 'Build' : 'Upgrade'}
            </button>
            <div class="uinfo">
              <p class="gsummary">{next.summary}</p>
              <p class="gcost">
                <span class="cost-label">cost:</span>
                {#each costEntries(next.cost) as [rid, amt] (rid)}
                  <button
                    type="button"
                    class="cost-num jump"
                    class:short={gs.resources[rid].amount.lt(amt)}
                    onclick={() => jumpTo(rid)}
                    >{formatNumber(amt)} {RESOURCES[rid].name.toLowerCase()}</button
                  >
                {/each}
              </p>
            </div>
          </div>
        {/if}

        <div class="rows">
          {#each group.ids as id (id)}
            {@const Icon = RESOURCE_ICON[id]}
            {@const assigned = gs.workers.assigned[id]}
            {@const maxWorkers = getMaxWorkers(gs, id)}
            {@const showMax = PRODUCERS[id]?.workerCap === 'level'}
            {@const starved = starvedInput(id)}
            {@const cycleSeconds = PRODUCERS[id]?.cycleSeconds ?? 1}
            {@const outputPerCycle = PRODUCERS[id]?.outputPerCycle ?? 0}
            {@const producing = assigned > 0 && canStartCycle(gs, id)}
            <div class="row" data-res={id} transition:fly={{ y: 8, duration: 260 }}>
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
                <span class="amount">{formatNumber(gs.resources[id].amount, resourceDecimals(id))}</span>
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
                <span class="count"
                  >{assigned}{#if showMax}/{maxWorkers}{/if}</span
                >
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
                {#if group.key === 'core'}
                  {@const net = getNetProductionRate(gs, id)}
                  <span
                    class="netrate"
                    class:pos={net.gt(0)}
                    class:neg={net.lt(0)}
                    title="Overall {RESOURCES[id].name.toLowerCase()} rate — production minus everything that consumes it"
                    >{formatSignedRate(net)}</span
                  >
                {:else}
                  {#each inputEntries(id) as [rid, amt] (rid)}
                    <span class="pill" class:short={gs.resources[rid].amount.lt(amt)}>
                      <button type="button" class="req jump" onclick={() => jumpTo(rid)}
                        >{formatNumber(amt)} {RESOURCES[rid].name.toLowerCase()}</button
                      ><span class="held">/{formatNumber(gs.resources[rid].amount, resourceDecimals(rid))}</span>
                    </span>
                  {/each}
                {/if}
              </span>
            </div>
          {/each}
        </div>

        {#if group.upgradeInFooter && group.building}
          {@const fLevel = getStructureLevel(gs, group.building)}
          {@const fNext = getNextBuildingLevel(gs, group.building)}
          <div class="footer">
            {#if fNext}
              <button
                class="upgrade"
                onclick={() => game.build(group.building!)}
                disabled={!canBuild(gs, group.building)}
              >
                {fLevel === 0
                  ? `Build ${buildName}`
                  : `Upgrade ${buildName} to Level ${fLevel + 1}`}
              </button>
              <div class="finfo">
                <p class="gsummary">{fNext.summary}</p>
                <p class="gcost">
                  <span class="cost-label">cost:</span>
                  {#each costEntries(fNext.cost) as [rid, amt] (rid)}
                    <button
                      type="button"
                      class="cost-num jump"
                      class:short={gs.resources[rid].amount.lt(amt)}
                      onclick={() => jumpTo(rid)}
                      >{formatNumber(amt)} {RESOURCES[rid].name.toLowerCase()}</button
                    >
                  {/each}
                </p>
              </div>
            {:else}
              <span class="maxed">MAX</span>
            {/if}
          </div>
        {/if}
      </div>
    {/each}
  </div>
</section>

<style>
  .panel {
    animation: fadeIn var(--fade-in);
  }
  .stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .group {
    background: var(--bg-panel);
    border: var(--panel-border);
    border-top: 3px solid var(--accent);
    border-radius: var(--panel-radius);
    box-shadow: var(--panel-shadow);
    padding: var(--panel-pad);
    /* Rows reflow based on THIS card's width (see @container below), so they
       stack whether the viewport is small or the settings drawer pushed the
       content column narrow. */
    container-type: inline-size;
  }

  /* --- Group header --- */
  .ghead {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .gtitle {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }
  .gname {
    font-family: var(--font-display);
    font-size: 24px;
  }
  .lvl {
    color: var(--accent);
    margin-left: var(--space-2);
  }
  .gsummary {
    color: color-mix(in srgb, var(--text-muted) 78%, var(--bg-panel));
    font-size: 13px;
    margin-top: var(--space-1);
  }
  .gcost {
    font-size: 13px;
    margin-top: 2px;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  /* Header upgrade: button on the left, with cost then summary stacked to its
     right and vertically centered against the button. */
  .upgrade-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
    margin-top: var(--space-2);
  }
  .uinfo {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .uinfo .gsummary,
  .uinfo .gcost {
    margin: 0;
  }
  .cost-label {
    color: color-mix(in srgb, var(--text-muted) 78%, var(--bg-panel));
  }
  .cost-num {
    color: var(--good);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .cost-num.short {
    color: var(--bad);
  }

  /* --- Resource rows ---
     A single grid owns the columns; each row is a subgrid spanning them, so the
     worker/rate/cost columns share one width across every row in the card and
     line up vertically. */
  .rows {
    display: grid;
    /* Fixed widths through the worker column so the −/count/+ clusters (and the
       rate) sit at the same x in every card, not just within one card. */
    grid-template-columns: 20px 96px 150px 116px auto minmax(0, 1fr);
    column-gap: var(--space-3);
  }
  .row {
    display: grid;
    grid-column: 1 / -1;
    grid-template-columns: subgrid;
    align-items: center;
    padding-top: var(--space-3);
    margin-top: var(--space-3);
    border-top: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
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
    gap: 3px;
  }
  /* Cycle bar: a smooth loop timed to the line's cycleSeconds, running only
     while the line is actively producing. It's decoupled from the discrete
     0.1s simulation step on purpose — binding the width to the real per-tick
     progress makes it lurch in 10% jumps. The `producing` gate (canStartCycle)
     still stops it the instant a line can't run. */
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
  .name {
    margin-left: 2px;
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

  /* Core rows: the running net rate (production − consumption) for wood/stone/
     food, sitting where crafting rows show their input pills — far right. */
  .netrate {
    color: var(--text-muted);
    font-size: 15px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .netrate.pos {
    color: var(--good);
  }
  .netrate.neg {
    color: var(--bad);
  }

  /* Clickable cost/recipe entry — the whole container jumps to that resource's
     row. Inherits its container's text color; hover/focus tints it accent. */
  button.jump {
    background: none;
    border: 0;
    padding: 0;
    margin: 0;
    font: inherit;
    cursor: pointer;
  }
  button.req.jump {
    color: inherit;
  }
  button.jump:hover,
  button.jump:focus-visible {
    color: var(--accent);
    outline: none;
  }
  /* cost-num has no underline of its own, so add one on hover as the affordance. */
  button.cost-num.jump:hover,
  button.cost-num.jump:focus-visible {
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  /* .req already carries a bottom border; recolor it to match on hover. */
  button.req.jump:hover,
  button.req.jump:focus-visible {
    border-bottom-color: var(--accent);
  }

  /* --- Jump target call-out ---
     A row scrolled-to via a recipe link flashes a marker highlight on its
     name label, fading over ~1.6s. */
  .row {
    /* Land clear of the sticky header (--header-h set on the layout). */
    scroll-margin-block: calc(var(--header-h, 72px) + var(--space-3));
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

  /* --- Core footer upgrade --- */
  .footer {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
    margin-top: var(--space-3);
    padding-top: var(--space-3);
    border-top: 1px solid var(--border);
  }
  .footer .finfo {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .footer .gsummary,
  .footer .gcost {
    margin: 0;
  }

  /* --- Buttons --- */
  button.upgrade {
    padding: 6px 16px;
    font-size: 15px;
    border: 1px solid var(--border);
    background: color-mix(in srgb, var(--accent) 22%, transparent);
    color: var(--text);
    border-radius: var(--radius);
    transition: background var(--transition);
    white-space: nowrap;
  }
  button.upgrade:hover:not(:disabled) {
    background: color-mix(in srgb, var(--accent) 40%, transparent);
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
  button:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .maxed {
    color: var(--gold);
  }

  /* --- Narrow card: rows fall back to a wrapped, stacked layout (no subgrid).
     Keyed on the CARD's own width, so this triggers both on small screens and
     when the settings drawer pushes the content column narrow on desktop —
     the fixed 6-column grid would otherwise collide the rate onto the cost
     pills. ~700px is the point below which those columns stop fitting. --- */
  @container (max-width: 700px) {
    .rows {
      display: block;
    }
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

  /* Larger tap targets on actual touch-sized screens. */
  @media (max-width: 560px) {
    .workers button {
      width: 40px;
      height: 40px;
      font-size: 20px;
    }
  }
</style>

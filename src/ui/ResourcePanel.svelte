<script lang="ts">
  import type { Component } from 'svelte';
  import { fly } from 'svelte/transition';
  import { game } from './gameStore.svelte';
  import { RESOURCES, type ResourceId } from '../content/resources';
  import { PRODUCERS, type StructureId } from '../content/producers';
  import { BUILDINGS, type BuildingId } from '../content/buildings';
  import type { ResourceCost } from '../content/settlement';
  import {
    unlockedResources,
    isAtCapacity,
    getAvailableWorkers,
    getMaxWorkers,
    getStructureLevel,
    getNextBuildingLevel,
    canBuild,
    isBuildingAvailable,
  } from '../engine/selectors';
  import { formatNumber, formatCycleRate } from '../engine/numbers';

  // Resource row icons (Lucide — approximate matches for the fantasy items).
  import TreePine from '@lucide/svelte/icons/tree-pine';
  import Mountain from '@lucide/svelte/icons/mountain';
  import Wheat from '@lucide/svelte/icons/wheat';
  import Blocks from '@lucide/svelte/icons/blocks';
  import Layers from '@lucide/svelte/icons/layers';
  import Gem from '@lucide/svelte/icons/gem';
  import Feather from '@lucide/svelte/icons/feather';
  import Swords from '@lucide/svelte/icons/swords';
  import Sword from '@lucide/svelte/icons/sword';
  import Wand2 from '@lucide/svelte/icons/wand-2';
  import Shirt from '@lucide/svelte/icons/shirt';
  import PawPrint from '@lucide/svelte/icons/paw-print';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import Shield from '@lucide/svelte/icons/shield';
  import Target from '@lucide/svelte/icons/target';
  import ShieldHalf from '@lucide/svelte/icons/shield-half';
  import WandSparkles from '@lucide/svelte/icons/wand-sparkles';

  // Structure header icons.
  import Trees from '@lucide/svelte/icons/trees';
  import Pickaxe from '@lucide/svelte/icons/pickaxe';
  import Hammer from '@lucide/svelte/icons/hammer';
  import House from '@lucide/svelte/icons/house';
  import TowerControl from '@lucide/svelte/icons/tower-control';

  const RESOURCE_ICON: Partial<Record<ResourceId, Component>> = {
    wood: TreePine,
    stone: Mountain,
    food: Wheat,
    iron: Blocks,
    steel: Layers,
    mithril: Gem,
    arrow: Feather,
    spear: Swords,
    sword: Sword,
    staff: Wand2,
    leather: Shirt,
    fur: PawPrint,
    ether: Sparkles,
    ward: Shield,
    archer: Target,
    warrior: ShieldHalf,
    mage: WandSparkles,
  };

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
      key: 'deepmine',
      label: 'Deep Mine',
      icon: Pickaxe,
      building: 'deepmine',
      structures: ['deepmine'],
    },
    {
      key: 'blacksmith',
      label: 'Blacksmith',
      icon: Hammer,
      building: 'blacksmith',
      structures: ['blacksmith'],
    },
    {
      key: 'hunterscabin',
      label: "Hunter's Cabin",
      icon: House,
      building: 'hunterscabin',
      structures: ['hunterscabin'],
    },
    {
      key: 'wizardtower',
      label: 'Wizard Tower',
      icon: TowerControl,
      building: 'wizardtower',
      structures: ['wizardtower'],
    },
    {
      key: 'barracks',
      label: 'Barracks',
      icon: Swords,
      building: 'barracks',
      structures: ['barracks'],
    },
  ];

  const groups = $derived(
    GROUP_DEFS.map((g) => ({
      ...g,
      ids: unlocked.filter((id) => g.structures.includes(PRODUCERS[id]?.structure as StructureId)),
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

  // A crafting line with workers but a completely empty input is "starved".
  function starvedInput(id: ResourceId): ResourceId | null {
    const p = PRODUCERS[id];
    if (!p?.inputs || gs.workers.assigned[id] === 0) return null;
    for (const rid of Object.keys(p.inputs) as ResourceId[]) {
      if (gs.resources[rid].amount.lte(0)) return rid;
    }
    return null;
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
          {#if !group.upgradeInFooter && group.building}
            {#if next}
              <button
                class="upgrade"
                onclick={() => game.build(group.building!)}
                disabled={!canBuild(gs, group.building)}
              >
                {level === 0 ? 'Build' : 'Upgrade'}
              </button>
            {:else}
              <span class="maxed">MAX</span>
            {/if}
          {/if}
        </header>

        {#if !group.upgradeInFooter && next}
          <p class="gsummary">{next.summary}</p>
          <p class="gcost">
            <span class="cost-label">cost:</span>
            {#each costEntries(next.cost) as [rid, amt] (rid)}
              <span class="cost-num" class:short={gs.resources[rid].amount.lt(amt)}
                >{formatNumber(amt)} {RESOURCES[rid].name.toLowerCase()}</span
              >
            {/each}
          </p>
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
            {@const producing = assigned > 0 && !starved && !isAtCapacity(gs, id)}
            <div class="row" transition:fly={{ y: 8, duration: 260 }}>
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
                <span class="name">{RESOURCES[id].name}</span>
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
                  +{formatCycleRate(assigned * outputPerCycle, cycleSeconds)}
                {/if}
              </span>

              <span class="rcost">
                {#each inputEntries(id) as [rid, amt] (rid)}
                  <span class="pill" class:short={gs.resources[rid].amount.lt(amt)}>
                    {formatNumber(amt)}
                    {RESOURCES[rid].name}
                  </span>
                {/each}
              </span>
            </div>
          {/each}
        </div>

        {#if group.upgradeInFooter && group.building}
          {@const fLevel = getStructureLevel(gs, group.building)}
          {@const fNext = getNextBuildingLevel(gs, group.building)}
          <div class="footer">
            <div class="finfo">
              {#if fNext}
                <p class="gsummary">{fNext.summary}</p>
                <p class="gcost">
                  <span class="cost-label">cost:</span>
                  {#each costEntries(fNext.cost) as [rid, amt] (rid)}
                    <span class="cost-num" class:short={gs.resources[rid].amount.lt(amt)}
                      >{formatNumber(amt)} {RESOURCES[rid].name.toLowerCase()}</span
                    >
                  {/each}
                </p>
              {/if}
            </div>
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
    color: var(--text-muted);
    font-size: 14px;
    margin-top: var(--space-1);
  }
  .gcost {
    font-size: 14px;
    margin-top: 2px;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .cost-label {
    color: var(--text-muted);
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
  /* Cycle bar: a cosmetic loop timed to the line's base cycleSeconds, running
     only while the line is actively producing. */
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
    display: inline-flex;
    align-items: baseline;
    gap: 4px;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .amount {
    font-size: 17px;
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
    gap: var(--space-1);
    justify-content: flex-end;
  }
  .pill {
    background: color-mix(in srgb, var(--good) 22%, transparent);
    color: var(--good);
    border-radius: var(--radius);
    padding: 2px 8px;
    font-size: 13px;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .pill.short {
    background: color-mix(in srgb, var(--bad) 22%, transparent);
    color: var(--bad);
  }

  /* --- Core footer upgrade --- */
  .footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
    margin-top: var(--space-3);
    padding-top: var(--space-3);
    border-top: 1px solid var(--border);
  }
  .footer .gsummary,
  .footer .gcost {
    margin-top: 0;
  }
  .footer .gcost {
    margin-top: 2px;
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

  /* --- Mobile: rows fall back to a wrapped, stacked layout (no subgrid) --- */
  @media (max-width: 560px) {
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
    .workers button {
      width: 40px;
      height: 40px;
      font-size: 20px;
    }
  }
</style>

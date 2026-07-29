<script lang="ts">
  /**
   * One threat track, as its own panel: assault or hex.
   *
   * The two tracks are the same machine with different numbers — that's already
   * true in content/combat.ts, where ASSAULT and HEX are two ThreatConfigs of
   * the same shape. So this is one generic panel rendered twice rather than two
   * near-identical components, and adding a third track would be a TRACK_UI
   * entry, not new markup.
   *
   * What content/combat.ts can't carry is the *voice* — a hex doesn't "hit for"
   * damage the way a siege does, and its wave is a Trial, not a Level. Those
   * strings live in TRACK_UI below, beside the icon and accent colour, because
   * they're presentation rather than simulation.
   *
   * Each track self-gates on its own unlock, so App can render both
   * unconditionally and neither leaves an empty frame behind.
   */
  import type { Component } from 'svelte';
  import { game } from './gameStore.svelte';
  import {
    isCombatUnlocked,
    isHexUnlocked,
    getCapacity,
    getNextAssaultPower,
    getNextHexPower,
    willRepelAssault,
    willBreakHex,
  } from '../engine/selectors';
  import { ASSAULT, HEX, WIPE_ON_BREACH, type ThreatConfig } from '../content/combat';
  import { RESOURCES, type ResourceId } from '../content/resources';
  import { formatNumber } from '../engine/numbers';
  import ProducerRow from './ProducerRow.svelte';
  import InfoFlyout from './InfoFlyout.svelte';
  import Star from '@lucide/svelte/icons/star';
  import Book from './icons/Book.svelte';
  import Swords from '@lucide/svelte/icons/swords';
  import Skull from '@lucide/svelte/icons/skull';

  export type TrackId = 'assault' | 'hex';

  interface Props {
    track: TrackId;
  }
  const { track }: Props = $props();

  /** Everything about a track that isn't already in its ThreatConfig. */
  interface TrackUI {
    cfg: ThreatConfig;
    name: string;
    icon: Component;
    /** CSS colour driving the panel's accent strip, wave label and timer bar. */
    accent: string;
    /** What one of this track's waves is called: "Lvl 3", "Trial 3". */
    waveWord: string;
    /** Verdict when the stat is high enough, and when it isn't. */
    hold: string;
    fail: string;
    rewardIcon: Component;
    rewardColor: string;
    /** The unit the line consumes — "spends ___ to raise ___" in the flyout. */
    worker: string;
    capBuilding: string;
    /**
     * Whether the verdict line repeats the stat inline. Only Hex does today —
     * kept as data rather than unified so this split changes structure and
     * nothing a player reads.
     */
    statInVerdict: boolean;
  }

  const TRACK_UI: Record<TrackId, TrackUI> = {
    assault: {
      cfg: ASSAULT,
      name: 'Assault',
      icon: Swords,
      accent: 'var(--bad)',
      waveWord: 'Lvl',
      hold: 'your walls will hold',
      fail: 'your walls will fall',
      rewardIcon: Star,
      rewardColor: 'var(--gold)',
      worker: 'an archer',
      capBuilding: 'Castle',
      statInVerdict: false,
    },
    hex: {
      cfg: HEX,
      name: 'Hex',
      icon: Skull,
      accent: 'var(--wisdom)',
      waveWord: 'Trial',
      hold: 'your wards will resist',
      fail: 'the hex will land',
      rewardIcon: Book,
      rewardColor: 'var(--wisdom)',
      worker: 'a mage',
      capBuilding: 'Wizard Tower',
      statInVerdict: true,
    },
  };

  const gs = $derived(game.state);
  const ui = $derived(TRACK_UI[track]);
  const cfg = $derived(ui.cfg);
  const state = $derived(gs.combat[track]);

  const unlocked = $derived(track === 'assault' ? isCombatUnlocked(gs) : isHexUnlocked(gs));
  const incoming = $derived(track === 'assault' ? getNextAssaultPower(gs) : getNextHexPower(gs));
  const holding = $derived(track === 'assault' ? willRepelAssault(gs) : willBreakHex(gs));

  const stat = $derived(cfg.defenseStat as ResourceId);
  const statNow = $derived(gs.resources[stat].amount);
  const statMax = $derived(getCapacity(gs, stat));

  // Fraction of the interval elapsed — the bar fills as the next attack nears.
  const progressPct = $derived(
    Math.max(0, Math.min(100, (1 - state.timer / cfg.intervalSeconds) * 100)),
  );

  // The resources looted if a threat lands with the stat already at zero.
  const wipeNames = WIPE_ON_BREACH.map((id) => RESOURCES[id].name).join(', ');

  function countdown(seconds: number): string {
    const s = Math.max(0, Math.ceil(seconds));
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
  }
</script>

{#if unlocked}
  <section class="panel" data-nav="combat:{track}" style:--track-accent={ui.accent}>
    <div class="chead">
      <h2>
        <ui.icon size={22} color={ui.accent} aria-hidden="true" />
        {ui.name} <span class="lvl">{ui.waveWord} {state.wave + 1}</span>
      </h2>
      <div class="incoming" title="Time until the next {ui.name.toLowerCase()}">
        <span class="in-label">Incoming in {countdown(state.timer)}</span>
        <span class="bar"><span class="bar-fill" style:width="{progressPct}%"></span></span>
      </div>
      <InfoFlyout label="{ui.name} details" accent={ui.accent}>
        {@render trackDetails()}
      </InfoFlyout>
      <span class="reward" style:color={ui.rewardColor} title="{RESOURCES[cfg.reward].name} won">
        <ui.rewardIcon size={16} color={ui.rewardColor} aria-hidden="true" />
        {formatNumber(gs.resources[cfg.reward].amount)}
        {RESOURCES[cfg.reward].name}
      </span>
    </div>

    <p class="verdict-line">
      <span class="req"
        >{ui.waveWord}
        {state.wave + 1} hits for {formatNumber(incoming)}{#if ui.statInVerdict}
          · {RESOURCES[stat].name.toLowerCase()}
          {formatNumber(statNow)}{#if statMax}
            / {formatNumber(statMax)}{/if}{/if} —</span
      >
      {#if holding}
        <span class="ok">{ui.hold}</span>
      {:else}
        <span class="bad">{ui.fail}</span>
      {/if}
      <span class="tally">· {state.wins}W / {state.losses}L</span>
    </p>

    <div class="def-row">
      <ProducerRow id={stat} showCap />
    </div>
  </section>
{/if}

{#snippet trackDetails()}
  <p class="fly-how">
    Switch <strong>Auto</strong> on and this line spends {ui.worker} to raise
    <strong>{RESOURCES[stat].name}</strong>
    on its own (up to your {ui.capBuilding}'s cap). It costs no workers.
  </p>
  <dl class="fly-stats">
    <div>
      <dt>{RESOURCES[stat].name}</dt>
      <dd>
        {formatNumber(statNow)}{#if statMax}
          / {formatNumber(statMax)}{/if}
      </dd>
    </div>
    <div>
      <dt>Incoming</dt>
      <dd>{formatNumber(incoming)}</dd>
    </div>
    <div>
      <dt>Margin</dt>
      <dd class={holding ? 'ok' : 'bad'}>{formatNumber(statNow.minus(incoming))}</dd>
    </div>
    <div>
      <dt>Every</dt>
      <dd>{cfg.intervalSeconds}s</dd>
    </div>
    <div>
      <dt>Record</dt>
      <dd>{state.wins}W / {state.losses}L</dd>
    </div>
  </dl>
  <ul class="fly-outcomes">
    <li>
      <span class="ok">Win</span> +1 {RESOURCES[cfg.reward].name}; next hit escalates to
      {formatNumber(incoming.times(cfg.growth))}.
    </li>
    <li>
      <span class="bad">Loss</span> −{cfg.lossAmount}
      {RESOURCES[stat].name}. If it hits 0, your {wipeNames} are looted and the wave resets.
    </li>
  </ul>
  <p class="fly-tip">
    Tip: when the wave outgrows your cap, upgrade the {ui.capBuilding} to raise the ceiling.
  </p>
{/snippet}

<style>
  /* The accent strip takes the track's own colour — martial red for assaults,
     arcane purple for hexes — rather than one shared red for both. */
  .panel {
    background: var(--bg-panel);
    border: var(--panel-border);
    border-top: 3px solid var(--track-accent, var(--bad));
    border-radius: var(--panel-radius);
    box-shadow: var(--panel-shadow);
    padding: var(--panel-pad);
    animation: fadeIn var(--fade-in);
  }
  /* Settings can drop the colored accent strip; fall back to the plain frame. */
  :global(:root[data-accent-border='off']) .panel {
    border-top: var(--panel-border);
  }
  .chead {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    flex-wrap: wrap;
  }
  h2 {
    font-family: var(--font-display);
    font-size: 26px;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .lvl {
    color: var(--track-accent, var(--bad));
    font-size: 0.7em;
  }
  /* Incoming countdown: label + a bar that drains as the attack nears. */
  .incoming {
    flex: 1 1 200px;
    min-width: 160px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .in-label {
    color: var(--text-muted);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }
  .bar {
    display: block;
    height: 8px;
    background: color-mix(in srgb, var(--border) 45%, transparent);
    border-radius: 999px;
    overflow: hidden;
  }
  .bar-fill {
    display: block;
    height: 100%;
    background: var(--track-accent, var(--bad));
    border-radius: 999px;
    transition: width 0.2s linear;
  }
  .reward {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .verdict-line {
    margin-top: var(--space-2);
    font-size: 14px;
    font-variant-numeric: tabular-nums;
  }
  .req {
    color: var(--text-muted);
  }
  .ok {
    color: var(--good);
  }
  .bad {
    color: var(--bad);
  }
  .tally {
    color: var(--text-muted);
  }
  .def-row {
    margin-top: var(--space-3);
    padding-top: var(--space-3);
    border-top: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
    /* Establish a query container so the stat row can stack on narrow cards,
       exactly like ResourcePanel's rows do. */
    container-type: inline-size;
  }
  /* Flyout content */
  .fly-how {
    margin: 0 0 var(--space-3);
    color: var(--text);
  }
  .fly-how strong {
    color: var(--text);
  }
  .fly-stats {
    margin: 0 0 var(--space-3);
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-1) var(--space-3);
    font-variant-numeric: tabular-nums;
  }
  .fly-stats div {
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
  }
  .fly-stats dt {
    color: var(--text-muted);
  }
  .fly-stats dd {
    margin: 0;
  }
  .fly-outcomes {
    margin: 0 0 var(--space-3);
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    color: var(--text-muted);
  }
  .fly-outcomes .ok,
  .fly-outcomes .bad {
    font-weight: bold;
    margin-right: var(--space-1);
  }
  .fly-tip {
    margin: 0;
    color: var(--text-muted);
    border-top: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
    padding-top: var(--space-2);
  }
</style>

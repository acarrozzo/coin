<script lang="ts">
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
  import { RESOURCES } from '../content/resources';
  import { formatNumber, type Decimal } from '../engine/numbers';
  import ProducerRow from './ProducerRow.svelte';
  import InfoFlyout from './InfoFlyout.svelte';
  import Star from '@lucide/svelte/icons/star';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import Swords from '@lucide/svelte/icons/swords';
  import Skull from '@lucide/svelte/icons/skull';

  const gs = $derived(game.state);
  const ward = $derived(gs.resources.ward.amount);
  const wardMax = $derived(getCapacity(gs, 'ward'));

  // The resources looted if a threat lands with the stat already at zero.
  const wipeNames = WIPE_ON_BREACH.map((id) => RESOURCES[id].name).join(', ');

  interface TrackInfo {
    accent: string;
    worker: string;
    capBuilding: string;
    rewardName: string;
    statName: string;
    incoming: string;
    nextAfterWin: string;
    statNow: string;
    statMax: string | null;
    margin: string;
    holding: boolean;
    interval: number;
    wins: number;
    losses: number;
    lossAmount: number;
  }

  function trackInfo(cfg: ThreatConfig, opts: {
    accent: string;
    worker: string;
    capBuilding: string;
    incoming: Decimal;
    holding: boolean;
    wins: number;
    losses: number;
  }): TrackInfo {
    const statNow = gs.resources[cfg.defenseStat].amount;
    const statMax = getCapacity(gs, cfg.defenseStat);
    return {
      accent: opts.accent,
      worker: opts.worker,
      capBuilding: opts.capBuilding,
      rewardName: RESOURCES[cfg.reward].name,
      statName: RESOURCES[cfg.defenseStat].name,
      incoming: formatNumber(opts.incoming),
      nextAfterWin: formatNumber(opts.incoming.times(cfg.growth)),
      statNow: formatNumber(statNow),
      statMax: statMax ? formatNumber(statMax) : null,
      margin: formatNumber(statNow.minus(opts.incoming)),
      holding: opts.holding,
      interval: cfg.intervalSeconds,
      wins: opts.wins,
      losses: opts.losses,
      lossAmount: cfg.lossAmount,
    };
  }

  const assaultInfo = $derived(
    trackInfo(ASSAULT, {
      accent: 'var(--bad)',
      worker: 'an archer',
      capBuilding: 'Castle',
      incoming: getNextAssaultPower(gs),
      holding: willRepelAssault(gs),
      wins: gs.combat.assault.wins,
      losses: gs.combat.assault.losses,
    }),
  );
  const hexInfo = $derived(
    trackInfo(HEX, {
      accent: 'var(--wisdom)',
      worker: 'a mage',
      capBuilding: 'Wizard Tower',
      incoming: getNextHexPower(gs),
      holding: willBreakHex(gs),
      wins: gs.combat.hex.wins,
      losses: gs.combat.hex.losses,
    }),
  );

  // Fraction of the interval elapsed — the bar fills as the next attack nears.
  const assaultProgressPct = $derived(
    Math.max(0, Math.min(100, (1 - gs.combat.assault.timer / ASSAULT.intervalSeconds) * 100)),
  );
  const hexProgressPct = $derived(
    Math.max(0, Math.min(100, (1 - gs.combat.hex.timer / HEX.intervalSeconds) * 100)),
  );

  function countdown(seconds: number): string {
    const s = Math.max(0, Math.ceil(seconds));
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
  }
</script>

{#if isCombatUnlocked(gs)}
  <section class="panel" data-nav="combat">
    <!-- Assault header: level, incoming countdown bar, honor -->
    <div class="chead">
      <h2>
        <Swords size={22} color="var(--bad)" aria-hidden="true" />
        Assault <span class="lvl">Lvl {gs.combat.assault.wave + 1}</span>
      </h2>
      <div class="incoming" title="Time until the next assault">
        <span class="in-label">Incoming in {countdown(gs.combat.assault.timer)}</span>
        <span class="bar"><span class="bar-fill" style:width="{assaultProgressPct}%"></span></span>
      </div>
      <InfoFlyout label="Assault details" accent="var(--bad)">
        {@render trackDetails(assaultInfo)}
      </InfoFlyout>
      <span class="honor" title="Honor won from repelled assaults">
        <Star size={16} color="var(--gold)" aria-hidden="true" />
        {formatNumber(gs.resources.honor.amount)} Honor
      </span>
    </div>

    <p class="verdict-line">
      <span class="req">Wave {gs.combat.assault.wave + 1} hits for {formatNumber(getNextAssaultPower(gs))} —</span>
      {#if willRepelAssault(gs)}
        <span class="ok">your walls will hold</span>
      {:else}
        <span class="bad">your walls will fall</span>
      {/if}
      <span class="tally">· {gs.combat.assault.wins}W / {gs.combat.assault.losses}L</span>
    </p>

    <div class="def-row">
      <ProducerRow id="defense" showCap />
    </div>

    <!-- Hex track -->
    {#if isHexUnlocked(gs)}
      <div class="chead hex-head">
        <h2>
          <Skull size={22} color="var(--wisdom)" aria-hidden="true" />
          Hex <span class="lvl">Trial {gs.combat.hex.wave + 1}</span>
        </h2>
        <div class="incoming" title="Time until the next hex">
          <span class="in-label">Incoming in {countdown(gs.combat.hex.timer)}</span>
          <span class="bar"><span class="bar-fill" style:width="{hexProgressPct}%"></span></span>
        </div>
        <InfoFlyout label="Hex details" accent="var(--wisdom)">
          {@render trackDetails(hexInfo)}
        </InfoFlyout>
        <span class="honor" title="Wisdom won from resisted hexes">
          <Sparkles size={16} color="var(--wisdom)" aria-hidden="true" />
          {formatNumber(gs.resources.wisdom.amount)} Wisdom
        </span>
      </div>

      <p class="verdict-line">
        <span class="req"
          >Trial {gs.combat.hex.wave + 1} hits for {formatNumber(getNextHexPower(gs))} · ward {formatNumber(
            ward,
          )}{#if wardMax} / {formatNumber(wardMax)}{/if} —</span
        >
        {#if willBreakHex(gs)}
          <span class="ok">your wards will resist</span>
        {:else}
          <span class="bad">the hex will land</span>
        {/if}
        <span class="tally">· {gs.combat.hex.wins}W / {gs.combat.hex.losses}L</span>
      </p>

      <div class="def-row">
        <ProducerRow id="ward" showCap />
      </div>
    {/if}
  </section>
{/if}

{#snippet trackDetails(t: TrackInfo)}
  <p class="fly-how">
    Dedicate {t.worker} to raise <strong>{t.statName}</strong> (up to your {t.capBuilding}'s cap).
  </p>
  <dl class="fly-stats">
    <div><dt>{t.statName}</dt><dd>{t.statNow}{#if t.statMax} / {t.statMax}{/if}</dd></div>
    <div><dt>Incoming</dt><dd>{t.incoming}</dd></div>
    <div>
      <dt>Margin</dt>
      <dd class={t.holding ? 'ok' : 'bad'}>{t.margin}</dd>
    </div>
    <div><dt>Every</dt><dd>{t.interval}s</dd></div>
    <div><dt>Record</dt><dd>{t.wins}W / {t.losses}L</dd></div>
  </dl>
  <ul class="fly-outcomes">
    <li>
      <span class="ok">Win</span> +1 {t.rewardName}; next hit escalates to {t.nextAfterWin}.
    </li>
    <li>
      <span class="bad">Loss</span> −{t.lossAmount} {t.statName}. If it hits 0, your {wipeNames} are
      looted and the wave resets.
    </li>
  </ul>
  <p class="fly-tip">
    Tip: when the wave outgrows your cap, upgrade the {t.capBuilding} to raise the ceiling.
  </p>
{/snippet}

<style>
  .panel {
    background: var(--bg-panel);
    border: var(--panel-border);
    border-top: 3px solid var(--bad);
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
  .hex-head {
    margin-top: var(--space-4);
    padding-top: var(--space-4);
    border-top: 1px solid var(--border);
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
    color: var(--bad);
    font-size: 0.7em;
  }
  /* The hex track reads as arcane, not martial — recolor it purple. */
  .hex-head .lvl {
    color: var(--wisdom);
  }
  .hex-head .bar-fill {
    background: var(--wisdom);
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
    background: var(--bad);
    border-radius: 999px;
    transition: width 0.2s linear;
  }
  .honor {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--gold);
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
    /* Establish a query container so the Defense row can stack on narrow cards,
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

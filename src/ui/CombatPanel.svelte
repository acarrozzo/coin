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
  import { ASSAULT, HEX } from '../content/combat';
  import { formatNumber } from '../engine/numbers';
  import ProducerRow from './ProducerRow.svelte';
  import Star from '@lucide/svelte/icons/star';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import Swords from '@lucide/svelte/icons/swords';
  import Skull from '@lucide/svelte/icons/skull';

  const gs = $derived(game.state);
  const ward = $derived(gs.resources.ward.amount);
  const wardMax = $derived(getCapacity(gs, 'ward'));

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
  <section class="panel">
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
    <p class="hint">Dedicate an archer to the walls to raise defense (up to your Castle's cap).</p>

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
      <p class="hint">Dedicate a mage to weave wards (up to your Wizard Tower's cap).</p>
    {/if}
  </section>
{/if}

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
  .hint {
    margin-top: var(--space-2);
    color: var(--text-muted);
    font-size: 13px;
  }
</style>

<script lang="ts">
  import { game } from './gameStore.svelte';
  import { RESOURCES } from '../content/resources';
  import { UNIT_IDS } from '../content/combat';
  import {
    isCombatUnlocked,
    isHexUnlocked,
    getArmyPower,
    getWardPower,
    getNextAssaultPower,
    getNextHexPower,
    willRepelAssault,
    willBreakHex,
  } from '../engine/selectors';
  import { formatNumber } from '../engine/numbers';

  const gs = $derived(game.state);

  function countdown(seconds: number): string {
    const s = Math.max(0, Math.ceil(seconds));
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
  }
</script>

{#if isCombatUnlocked(gs)}
  <section class="panel">
    <h2>Defense</h2>

    <div class="army">
      <span class="label">Standing army</span>
      <span class="power">⚔ {formatNumber(getArmyPower(gs))} power</span>
    </div>
    <div class="units">
      {#each UNIT_IDS as id (id)}
        <span class="unit">{formatNumber(gs.resources[id].amount)} {RESOURCES[id].name}</span>
      {/each}
    </div>

    <!-- Assault track -->
    <div class="threat">
      <div class="info">
        <span class="name">Next assault · wave {gs.combat.assault.wave + 1}</span>
        <span class="sub">in {countdown(gs.combat.assault.timer)}</span>
      </div>
      <div class="verdict">
        <span class="req">needs {formatNumber(getNextAssaultPower(gs))}</span>
        {#if willRepelAssault(gs)}
          <span class="ok">will hold</span>
        {:else}
          <span class="bad">will fall</span>
        {/if}
      </div>
    </div>
    <div class="tally">
      🏆 {formatNumber(gs.resources.honor.amount)} honor · {gs.combat.assault.wins}W / {gs.combat
        .assault.losses}L
    </div>

    <!-- Hex track -->
    {#if isHexUnlocked(gs)}
      <div class="threat hex">
        <div class="info">
          <span class="name">Next hex · trial {gs.combat.hex.wave + 1}</span>
          <span class="sub">in {countdown(gs.combat.hex.timer)}</span>
        </div>
        <div class="verdict">
          <span class="req">wards {formatNumber(getWardPower(gs))} / {formatNumber(getNextHexPower(gs))}</span>
          {#if willBreakHex(gs)}
            <span class="ok">will resist</span>
          {:else}
            <span class="bad">will land</span>
          {/if}
        </div>
      </div>
      <div class="tally">
        ✨ {formatNumber(gs.resources.wisdom.amount)} wisdom · {gs.combat.hex.wins}W / {gs.combat.hex
          .losses}L
      </div>
    {/if}
  </section>
{/if}

<style>
  .panel {
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: var(--space-4);
    animation: fadeIn var(--fade-in);
  }
  h2 {
    font-size: 28px;
    margin-bottom: var(--space-3);
  }
  .army {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .label {
    font-size: 17px;
  }
  .power {
    color: var(--gold);
    font-variant-numeric: tabular-nums;
  }
  .units {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    color: var(--text-muted);
    font-size: 14px;
    margin-top: var(--space-1);
  }
  .threat {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
    margin-top: var(--space-4);
    padding-top: var(--space-3);
    border-top: 1px solid var(--border);
    flex-wrap: wrap;
  }
  .info {
    display: flex;
    flex-direction: column;
  }
  .name {
    font-size: 16px;
  }
  .sub {
    color: var(--text-muted);
    font-size: 14px;
    font-variant-numeric: tabular-nums;
  }
  .verdict {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    font-variant-numeric: tabular-nums;
  }
  .req {
    color: var(--text-muted);
    font-size: 14px;
  }
  .ok {
    color: var(--good);
  }
  .bad {
    color: var(--bad);
  }
  .tally {
    margin-top: var(--space-2);
    color: var(--text-muted);
    font-size: 14px;
    font-variant-numeric: tabular-nums;
  }
</style>

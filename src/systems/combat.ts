import { D } from '../engine/numbers';
import type { GameState, ThreatState } from '../engine/state';
import { isCombatUnlocked, isHexUnlocked, getThreatPower } from '../engine/selectors';
import { ASSAULT, HEX, WIPE_ON_BREACH, type ThreatConfig } from '../content/combat';

export interface CombatEvent {
  kind: 'assault' | 'hex';
  won: boolean;
  /** Wave number that was fought. */
  wave: number;
  /** True when the defense stat hit zero and core resources were looted. */
  breached?: boolean;
}

/**
 * Advance the combat timers by `dt` and resolve any attacks that come due.
 * Deterministic: if the defending stat (defense / ward) meets the wave's attack
 * power you repel it, it escalates, and you gain honor/wisdom. Fall short and
 * you lose `lossAmount` of the stat — and if it hits zero, core resources are
 * looted — while the attacker resets to wave 0.
 * Runs both in the live loop and during offline catch-up (see tick/offline).
 */
export function runCombat(state: GameState, dt: number): CombatEvent[] {
  const events: CombatEvent[] = [];

  if (isCombatUnlocked(state)) {
    advance(state.combat.assault, dt, ASSAULT.intervalSeconds, () =>
      resolve(state, state.combat.assault, ASSAULT, 'assault', events),
    );
  }
  if (isHexUnlocked(state)) {
    advance(state.combat.hex, dt, HEX.intervalSeconds, () =>
      resolve(state, state.combat.hex, HEX, 'hex', events),
    );
  }

  return events;
}

/** Tick a threat timer down, firing `resolve` for each attack that comes due. */
function advance(track: ThreatState, dt: number, interval: number, resolve: () => void): void {
  track.timer -= dt;
  let guard = 0;
  while (track.timer <= 0 && guard++ < 100) {
    resolve();
    track.timer += interval;
  }
}

function resolve(
  state: GameState,
  track: ThreatState,
  cfg: ThreatConfig,
  kind: CombatEvent['kind'],
  events: CombatEvent[],
): void {
  const stat = state.resources[cfg.defenseStat];
  const attackPower = getThreatPower(cfg, track.wave);
  const won = stat.amount.gte(attackPower);

  if (won) {
    track.wins += 1;
    track.wave += 1;
    state.resources[cfg.reward].amount = state.resources[cfg.reward].amount.plus(1);
    events.push({ kind, won: true, wave: track.wave });
    return;
  }

  track.losses += 1;
  stat.amount = stat.amount.minus(cfg.lossAmount);
  let breached = false;
  if (stat.amount.lte(0)) {
    stat.amount = D(0);
    breached = true;
    for (const id of WIPE_ON_BREACH) state.resources[id].amount = D(0);
  }
  // A failed defense sends the attacker back to the start.
  track.wave = 0;
  events.push({ kind, won: false, wave: track.wave, breached });
}

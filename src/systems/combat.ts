import type { GameState, ThreatState } from '../engine/state';
import {
  isCombatUnlocked,
  isHexUnlocked,
  getArmyPower,
  getWardPower,
  getNextAssaultPower,
  getNextHexPower,
} from '../engine/selectors';
import {
  ASSAULT,
  HEX,
  UNIT_IDS,
  HONOR_PER_WIN,
  WISDOM_PER_WIN,
  ASSAULT_CASUALTY_RATE,
  HEX_WARD_LOSS_RATE,
} from '../content/combat';

export interface CombatEvent {
  kind: 'assault' | 'hex';
  won: boolean;
  /** Wave number that was fought. */
  wave: number;
}

/**
 * Advance the combat timers by `dt` and resolve any attacks that come due.
 * Deterministic power-vs-power: meet the threat → win, it escalates, you gain
 * honor/wisdom; fall short → you take casualties and face the same wave again.
 * Runs only in the live loop (see tick/offline), never during offline catch-up.
 */
export function runCombat(state: GameState, dt: number): CombatEvent[] {
  const events: CombatEvent[] = [];

  if (isCombatUnlocked(state)) {
    advance(
      state.combat.assault,
      dt,
      ASSAULT.intervalSeconds,
      () => resolveAssault(state, events),
    );
  }
  if (isHexUnlocked(state)) {
    advance(state.combat.hex, dt, HEX.intervalSeconds, () => resolveHex(state, events));
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

function resolveAssault(state: GameState, events: CombatEvent[]): void {
  const track = state.combat.assault;
  const won = getArmyPower(state).gte(getNextAssaultPower(state));
  events.push({ kind: 'assault', won, wave: track.wave + 1 });

  if (won) {
    track.wins += 1;
    track.wave += 1;
    state.resources.honor.amount = state.resources.honor.amount.plus(HONOR_PER_WIN);
  } else {
    track.losses += 1;
    for (const id of UNIT_IDS) {
      const survivors = state.resources[id].amount.times(1 - ASSAULT_CASUALTY_RATE).floor();
      state.resources[id].amount = survivors;
    }
  }
}

function resolveHex(state: GameState, events: CombatEvent[]): void {
  const track = state.combat.hex;
  const won = getWardPower(state).gte(getNextHexPower(state));
  events.push({ kind: 'hex', won, wave: track.wave + 1 });

  if (won) {
    track.wins += 1;
    track.wave += 1;
    state.resources.wisdom.amount = state.resources.wisdom.amount.plus(WISDOM_PER_WIN);
  } else {
    track.losses += 1;
    state.resources.ward.amount = state.resources.ward.amount.times(1 - HEX_WARD_LOSS_RATE).floor();
  }
}

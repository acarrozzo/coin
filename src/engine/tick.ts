import type { GameState } from './state';
import { runProduction, type GainHandler } from '../systems/production';
import { runCombat, type CombatEvent } from '../systems/combat';

export interface TickOptions {
  /** Whether combat resolves this tick. Off during offline catch-up. */
  combat?: boolean;
  /**
   * Called once per completed production cycle with the resource and the amount
   * emitted. Used by the live loop to float a "+X" pop; left unset during
   * offline catch-up so long absences don't build a huge event list.
   */
  onGain?: GainHandler;
}

/**
 * Advance the whole simulation by `dt` seconds and return any combat events.
 * This is the single source of forward motion — the live loop, offline
 * catch-up, and tests all go through here. Systems run in a fixed order.
 */
export function tick(state: GameState, dt: number, opts: TickOptions = {}): CombatEvent[] {
  if (dt <= 0) return [];
  runProduction(state, dt, opts.onGain);
  state.playtime += dt;
  return opts.combat === false ? [] : runCombat(state, dt);
}

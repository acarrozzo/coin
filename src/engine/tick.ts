import type { GameState } from './state';
import { runProduction } from '../systems/production';

/**
 * Advance the whole simulation by `dt` seconds.
 * This is the single source of forward motion — the live loop, offline
 * catch-up, and tests all go through here. Systems run in a fixed order.
 */
export function tick(state: GameState, dt: number): void {
  if (dt <= 0) return;
  runProduction(state, dt);
  state.playtime += dt;
}

import { Decimal } from './numbers';
import type { GameState, ResourceId } from './state';
import { tick } from './tick';
import { RESOURCE_IDS } from '../content/resources';

/** How much offline time counts toward catch-up (8 hours). */
export const MAX_OFFLINE_SECONDS = 8 * 60 * 60;

export interface OfflineSummary {
  /** Seconds actually simulated (after capping). */
  elapsedSeconds: number;
  /** True if the real gap exceeded the cap. */
  capped: boolean;
  /** Per-resource gains during the catch-up. */
  gains: Partial<Record<ResourceId, Decimal>>;
}

/**
 * Simulate time elapsed since the last save and advance `lastTick` to `now`.
 *
 * Current production is linear and capacity-clamped, so a single `tick(elapsed)`
 * is exact. If a future system is non-linear (interacting rates), this is where
 * we'd switch to fixed-step chunking.
 */
export function applyOffline(state: GameState, now: number): OfflineSummary {
  const rawElapsed = Math.max(0, (now - state.lastTick) / 1000);
  const elapsed = Math.min(rawElapsed, MAX_OFFLINE_SECONDS);

  const before = {} as Record<ResourceId, Decimal>;
  for (const id of RESOURCE_IDS) before[id] = state.resources[id].amount;

  if (elapsed > 0) tick(state, elapsed);
  state.lastTick = now;

  const gains: Partial<Record<ResourceId, Decimal>> = {};
  for (const id of RESOURCE_IDS) {
    const gain = state.resources[id].amount.minus(before[id]);
    if (gain.gt(0)) gains[id] = gain;
  }

  return { elapsedSeconds: elapsed, capped: rawElapsed > elapsed, gains };
}

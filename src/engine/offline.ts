import { Decimal } from './numbers';
import type { GameState, ResourceId } from './state';
import { tick } from './tick';
import { RESOURCE_IDS } from '../content/resources';

/** How much offline time counts toward catch-up (8 hours). */
export const MAX_OFFLINE_SECONDS = 8 * 60 * 60;

/** Upper bound on catch-up iterations, so long absences stay fast. */
const MAX_STEPS = 10_000;

export interface OfflineSummary {
  /** Seconds actually simulated (after capping). */
  elapsedSeconds: number;
  /** True if the real gap exceeded the cap. */
  capped: boolean;
  /** Per-resource gains during the catch-up. */
  gains: Partial<Record<ResourceId, Decimal>>;
}

/**
 * Simulate `seconds` of game time in fixed chunks.
 *
 * Crafting chains (food → iron → steel) depend on same-tick ordering, so we
 * step rather than run one giant tick — a single huge dt would let a chain
 * over-produce. Chunk size scales with the span to keep iterations bounded.
 */
export function simulate(state: GameState, seconds: number): void {
  if (seconds <= 0) return;
  const step = Math.max(1, seconds / MAX_STEPS);
  let remaining = seconds;
  while (remaining > 0) {
    const dt = Math.min(step, remaining);
    tick(state, dt, { combat: false }); // combat only resolves while actively playing
    remaining -= dt;
  }
}

/** Simulate time elapsed since the last save and advance `lastTick` to `now`. */
export function applyOffline(state: GameState, now: number): OfflineSummary {
  const rawElapsed = Math.max(0, (now - state.lastTick) / 1000);
  const elapsed = Math.min(rawElapsed, MAX_OFFLINE_SECONDS);

  const before = {} as Record<ResourceId, Decimal>;
  for (const id of RESOURCE_IDS) before[id] = state.resources[id].amount;

  simulate(state, elapsed);
  state.lastTick = now;

  const gains: Partial<Record<ResourceId, Decimal>> = {};
  for (const id of RESOURCE_IDS) {
    const gain = state.resources[id].amount.minus(before[id]);
    if (gain.gt(0)) gains[id] = gain;
  }

  return { elapsedSeconds: elapsed, capped: rawElapsed > elapsed, gains };
}

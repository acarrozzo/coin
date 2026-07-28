import { createInitialState, type GameState } from '../engine/state';
import { canPrestige, getNextPrestigeTier } from '../engine/selectors';

/**
 * Resources that survive a prestige. Honor and wisdom are earned only by
 * repelling assaults and breaking hexes — they're the record of what you
 * actually withstood, so they're the one thing the reset doesn't take. Keeping
 * honor also means tier 1's threshold stays satisfied on every later run.
 */
const CARRIED_RESOURCES = ['honor', 'wisdom'] as const;

/**
 * Take a prestige: tear the settlement back down to the Wilderness and rebuild
 * from a fresh state, keeping only the prestige level, honor/wisdom, and the
 * lifetime clocks. Returns whether it happened.
 *
 * The tier's `requires` is a standing threshold and is deliberately **not**
 * deducted — you must hold the honor / star metal to walk away, but prestiging
 * doesn't spend it. (Honor then carries; star metal doesn't, so it's re-earned.)
 *
 * Written as "build a fresh state, then copy the survivors back" rather than
 * zeroing fields by hand, so that **any state added later resets by default**
 * and carrying something through becomes an explicit opt-in. The result is
 * copied key-by-key into the caller's object because the live game state is a
 * Svelte `$state` proxy that can't be reassigned.
 */
export function doPrestige(state: GameState): boolean {
  if (!canPrestige(state)) return false;

  const tier = getNextPrestigeTier(state);
  if (!tier) return false;

  const fresh = createInitialState(state.lastTick);

  // Lifetime clocks: a prestige is a new run, not a new save.
  fresh.createdAt = state.createdAt;
  fresh.playtime = state.playtime;
  fresh.lastTick = state.lastTick;

  fresh.prestige.level = state.prestige.level + 1;
  // Absolute, not additive — the Market's Worker Contracts reset too, so an
  // accumulating bonus would let those +6 workers compound every run.
  fresh.workers.bonus = tier.workers;

  for (const id of CARRIED_RESOURCES) {
    fresh.resources[id].amount = state.resources[id].amount;
  }

  for (const key of Object.keys(fresh) as (keyof GameState)[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (state as any)[key] = fresh[key];
  }
  return true;
}

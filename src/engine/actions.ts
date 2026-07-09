import type { GameState, ResourceId } from './state';
import {
  getAvailableWorkers,
  getMaxWorkers,
  isResourceUnlocked,
  canTrainWorker,
  getWorkerCost,
} from './selectors';

/**
 * Move workers on/off a production line. `delta` is typically +1 / -1.
 * Clamps to [0, min(line cap, assigned + available pool)].
 */
export function assignWorker(state: GameState, id: ResourceId, delta: number): void {
  if (delta === 0 || !isResourceUnlocked(state, id)) return;

  const current = state.workers.assigned[id];

  if (delta > 0) {
    const available = getAvailableWorkers(state);
    if (available <= 0) return;
    const headroom = getMaxWorkers(state, id) - current;
    if (headroom <= 0) return;
    state.workers.assigned[id] = current + Math.min(delta, available, headroom);
  } else {
    state.workers.assigned[id] = Math.max(0, current + delta);
  }
}

/** Train one worker, paying the current food cost. Returns whether it happened. */
export function trainWorker(state: GameState): boolean {
  if (!canTrainWorker(state)) return false;
  state.resources.food.amount = state.resources.food.amount.minus(getWorkerCost(state));
  state.workers.trained += 1;
  return true;
}

import type { GameState, ResourceId } from './state';
import { getAvailableWorkers, isResourceUnlocked } from './selectors';

/**
 * Move workers on/off a resource. `delta` is typically +1 / -1.
 * Clamps to [0, assigned + available] so you can never over- or under-assign.
 */
export function assignWorker(state: GameState, id: ResourceId, delta: number): void {
  if (delta === 0 || !isResourceUnlocked(state, id)) return;

  const current = state.workers.assigned[id];

  if (delta > 0) {
    const available = getAvailableWorkers(state);
    if (available <= 0) return;
    state.workers.assigned[id] = current + Math.min(delta, available);
  } else {
    state.workers.assigned[id] = Math.max(0, current + delta);
  }
}

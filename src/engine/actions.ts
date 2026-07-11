import { D, type Decimal } from './numbers';
import type { GameState, ResourceId } from './state';
import {
  getAvailableWorkers,
  getMaxWorkers,
  isResourceUnlocked,
  canTrainWorker,
  getWorkerCost,
  getCapacity,
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

// ---------- Manual early game ----------
//
// The very first resources come from working by hand, before you have the
// workforce/buildings to automate. Foraging is always available; chopping and
// mining need a hatchet/pickaxe. (coin-old gated these behind a coin economy
// that was never finished, so we use a small coherent food/wood cost instead.)

const TOOL_COST = { hatchet: { food: 5 }, pickaxe: { wood: 5 } } as const;

/** Add one unit of a gathered resource by hand, respecting storage caps. */
function gatherByHand(state: GameState, id: ResourceId): boolean {
  const cap = getCapacity(state, id);
  if (cap !== null && state.resources[id].amount.gte(cap)) return false;
  state.resources[id].amount = state.resources[id].amount.plus(1);
  return true;
}

export function forage(state: GameState): boolean {
  return gatherByHand(state, 'food');
}

export function chopWood(state: GameState): boolean {
  if (!state.flags.hatchet) return false;
  return gatherByHand(state, 'wood');
}

export function mineStone(state: GameState): boolean {
  if (!state.flags.pickaxe) return false;
  return gatherByHand(state, 'stone');
}

/** Buy an early-game tool, unlocking a manual gathering action. */
export function buyTool(state: GameState, tool: 'hatchet' | 'pickaxe'): boolean {
  if (state.flags[tool]) return false;
  const cost = TOOL_COST[tool];
  for (const [rid, amount] of Object.entries(cost) as [ResourceId, number][]) {
    if (state.resources[rid].amount.lt(amount)) return false;
  }
  for (const [rid, amount] of Object.entries(cost) as [ResourceId, number][]) {
    state.resources[rid].amount = state.resources[rid].amount.minus(amount);
  }
  state.flags[tool] = true;
  return true;
}

// ---------- Shop ----------
//
// Extra workers can be recruited with arrows, scaling steeply (coin-old sold
// them for 1k / 10k / 100k … arrows).
export function extraWorkerCost(state: GameState): Decimal {
  return D(1000).times(D(10).pow(state.workers.bonus));
}

export function buyExtraWorker(state: GameState): boolean {
  const cost = extraWorkerCost(state);
  if (state.resources.arrow.amount.lt(cost)) return false;
  state.resources.arrow.amount = state.resources.arrow.amount.minus(cost);
  state.workers.bonus += 1;
  return true;
}

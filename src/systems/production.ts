import { D } from '../engine/numbers';
import type { GameState, ResourceId } from '../engine/state';
import { getCapacity, isResourceUnlocked } from '../engine/selectors';
import { PRODUCERS, PRODUCER_IDS } from '../content/producers';

/**
 * Advance every production line by `dt` seconds.
 *
 * Each line wants to make `workers × rate × dt` of its output, but is limited by:
 *   1. remaining storage capacity of the output, and
 *   2. available inputs (crafting is throttled to what the inputs can supply).
 * Inputs are consumed in proportion to what was actually produced.
 *
 * Producers run in dependency order (upstream before downstream), so within a
 * single small tick a chain like food → iron → steel behaves correctly.
 */
export function runProduction(state: GameState, dt: number): void {
  for (const id of PRODUCER_IDS) {
    const workers = state.workers.assigned[id];
    if (workers <= 0 || !isResourceUnlocked(state, id)) continue;

    const p = PRODUCERS[id];
    if (!p) continue;
    const perWorkerPerSec = p.outputPerCycle / p.cycleSeconds;
    let output = D(workers * perWorkerPerSec * dt);
    if (output.lte(0)) continue;

    // Capacity limit.
    const cap = getCapacity(state, id);
    if (cap !== null) {
      const remaining = cap.minus(state.resources[id].amount);
      if (remaining.lte(0)) continue;
      if (output.gt(remaining)) output = remaining;
    }

    // Input limit — throttle output to what inputs can supply.
    if (p.inputs) {
      for (const [rid, qty] of Object.entries(p.inputs) as [ResourceId, number][]) {
        const perOutput = qty / p.outputPerCycle;
        const maxByInput = state.resources[rid].amount.div(perOutput);
        if (maxByInput.lt(output)) output = maxByInput;
      }
    }

    if (output.lte(0)) continue;

    // Consume inputs proportional to actual output.
    if (p.inputs) {
      for (const [rid, qty] of Object.entries(p.inputs) as [ResourceId, number][]) {
        const perOutput = qty / p.outputPerCycle;
        state.resources[rid].amount = state.resources[rid].amount.minus(output.times(perOutput));
      }
    }

    state.resources[id].amount = state.resources[id].amount.plus(output);
  }

  clampNegatives(state);
}

/** Guard against tiny floating drift pushing an input just below zero. */
function clampNegatives(state: GameState): void {
  for (const id of PRODUCER_IDS) {
    if (state.resources[id].amount.lt(0)) state.resources[id].amount = D(0);
  }
}

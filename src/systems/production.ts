import { D, type Decimal } from '../engine/numbers';
import type { GameState, ResourceId } from '../engine/state';
import { getCapacity, canStartCycle } from '../engine/selectors';
import { PRODUCERS, PRODUCER_IDS } from '../content/producers';

/** Notified with each completed cycle's output — see tick's `onGain`. */
export type GainHandler = (id: ResourceId, amount: Decimal) => void;

/**
 * Advance every production line by `dt` seconds — atomic-cycle model.
 *
 * A line does not trickle output. It accumulates elapsed time toward one
 * `cycleSeconds`-long cycle and only ever emits a whole cycle's worth at once:
 * `workers × outputPerCycle`. This keeps integer resources on the integers
 * (metals and coin emit fractions per cycle by design and stay decimal).
 *
 * A cycle is gated by `canStartCycle` at its START only — full ingredients for
 * every worker, and some capacity headroom. Once a cycle is committed it runs to
 * completion regardless of what happens to the inputs in the meantime; the input
 * deduction lands at completion and is allowed to go negative (we never clamp —
 * the negative is shown as-is and recovers as upstream lines refill).
 *
 * Producers run upstream → downstream, so a chain like food → iron settles in
 * order within one tick.
 */
export function runProduction(state: GameState, dt: number, onGain?: GainHandler): void {
  for (const id of PRODUCER_IDS) {
    const p = PRODUCERS[id];
    if (!p) continue;
    const workers = state.workers.assigned[id];
    const cs = p.cycleSeconds;

    // An unstaffed (or locked) line holds no progress.
    if (workers <= 0) {
      state.production.progress[id] = 0;
      continue;
    }

    let t = state.production.progress[id];
    let budget = dt;

    while (budget > 0) {
      // At the start of a cycle (t === 0) the line must pass the gate; if it
      // can't, it sits idle and no time accrues (bar stays empty).
      if (t === 0 && !canStartCycle(state, id)) break;

      const need = cs - t;
      if (budget >= need) {
        completeCycle(state, id, workers, onGain);
        t = 0;
        budget -= need;
      } else {
        t += budget;
        budget = 0;
      }
    }

    state.production.progress[id] = t;
  }
}

/**
 * Emit one committed cycle: add `workers × outputPerCycle` (clamped to remaining
 * capacity so we never overflow) and subtract the full ingredient cost. The
 * input subtraction may drive a resource negative — that is intentional and left
 * unclamped.
 */
function completeCycle(
  state: GameState,
  id: ResourceId,
  workers: number,
  onGain?: GainHandler,
): void {
  const p = PRODUCERS[id];
  if (!p) return;

  let output = D(workers * p.outputPerCycle);
  const cap = getCapacity(state, id);
  if (cap !== null) {
    const remaining = cap.minus(state.resources[id].amount);
    if (output.gt(remaining)) output = remaining;
  }
  state.resources[id].amount = state.resources[id].amount.plus(output);
  if (onGain && output.gt(0)) onGain(id, output);

  if (p.inputs) {
    for (const [rid, qty] of Object.entries(p.inputs) as [ResourceId, number][]) {
      state.resources[rid].amount = state.resources[rid].amount.minus(workers * qty);
    }
  }
}

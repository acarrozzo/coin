import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/engine/state';
import { assignWorker, trainWorker } from '../src/engine/actions';
import { buildBuilding } from '../src/systems/buildings';
import { upgradeSettlement } from '../src/systems/settlement';
import { simulate } from '../src/engine/offline';
import { isResourceUnlocked, getCapacity } from '../src/engine/selectors';

// Plays the actual early game through the same functions the UI calls, proving
// the systems compose into a real progression loop — not just in isolation.
// Values track the original coin-old balance (tiny early caps, 2 starting
// workers, Farm at settlement level 3).
describe('progression (integration)', () => {
  it('goes from a Small Shack up to a Farm producing food', () => {
    const s = createInitialState(0); // level 1, 2 workers, caps 3

    // Gather to the tier-2 cost (3 each) and upgrade to Large Shack (caps 25).
    assignWorker(s, 'wood', 1);
    assignWorker(s, 'stone', 1);
    simulate(s, 20);
    expect(s.resources.wood.amount.toNumber()).toBe(3);
    expect(s.resources.stone.amount.toNumber()).toBe(3);
    expect(upgradeSettlement(s)).toBe(true);
    expect(s.level).toBe(2);
    expect(getCapacity(s, 'wood')!.toNumber()).toBe(25);

    // Refill toward the tier-3 cost (20 each) and upgrade to Small Cabin.
    simulate(s, 120);
    expect(upgradeSettlement(s)).toBe(true); // needs 20/20 + 2 workers (we have 2)
    expect(s.level).toBe(3);
    expect(getCapacity(s, 'wood')!.toNumber()).toBe(50);

    // Refill, then build the Farm (unlocked at settlement level 3).
    simulate(s, 120);
    expect(buildBuilding(s, 'farm')).toBe(true);
    expect(isResourceUnlocked(s, 'food')).toBe(true);

    // Put a worker on food and watch it accrue, then train a worker with it.
    assignWorker(s, 'wood', -1);
    assignWorker(s, 'food', 1);
    simulate(s, 60); // ~0.33 food/s → ~20 food
    expect(s.resources.food.amount.toNumber()).toBeGreaterThan(4);

    const before = s.workers.trained;
    expect(trainWorker(s)).toBe(true);
    expect(s.workers.trained).toBe(before + 1);
  });
});

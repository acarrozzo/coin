import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/engine/state';
import { assignWorker, trainWorker } from '../src/engine/actions';
import { buildBuilding } from '../src/systems/buildings';
import { upgradeSettlement } from '../src/systems/settlement';
import { simulate } from '../src/engine/offline';
import { isResourceUnlocked, getCapacity } from '../src/engine/selectors';

// Plays the actual early game through the same functions the UI calls, proving
// the systems compose into a real progression loop — not just in isolation.
describe('progression (integration)', () => {
  it('goes from a Small Shack to a Farm producing food', () => {
    const s = createInitialState(0);

    // Gather wood + stone toward the tier-2 cost (20 each).
    assignWorker(s, 'wood', 2);
    assignWorker(s, 'stone', 1);
    simulate(s, 120); // fills to the level-1 caps (25 each)
    expect(s.resources.wood.amount.toNumber()).toBe(25);
    expect(s.resources.stone.amount.toNumber()).toBe(25);

    // Upgrade to Large Shack (caps rise to 50).
    expect(upgradeSettlement(s)).toBe(true);
    expect(s.level).toBe(2);
    expect(getCapacity(s, 'wood')!.toNumber()).toBe(50);

    // Refill, then build a Farm (unlocked at level 2).
    simulate(s, 120);
    expect(buildBuilding(s, 'farm')).toBe(true);
    expect(isResourceUnlocked(s, 'food')).toBe(true);

    // Put a worker on food and watch it accrue, then train a worker with it.
    assignWorker(s, 'wood', -1);
    assignWorker(s, 'food', 1);
    simulate(s, 30); // 0.5 food/s → ~15 food
    expect(s.resources.food.amount.toNumber()).toBeGreaterThan(4);

    const before = s.workers.trained;
    expect(trainWorker(s)).toBe(true);
    expect(s.workers.trained).toBe(before + 1);
  });
});

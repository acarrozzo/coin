import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/engine/state';
import { D } from '../src/engine/numbers';
import { assignWorker, trainWorker } from '../src/engine/actions';
import { buildBuilding } from '../src/systems/buildings';
import { upgradeSettlement } from '../src/systems/settlement';
import { simulate } from '../src/engine/offline';
import { isResourceUnlocked, getCapacity } from '../src/engine/selectors';

// Plays the actual early game through the same functions the UI calls, proving
// the systems compose into a real progression loop — not just in isolation.
// Starts with 1 worker; the second worker is free to train (food cost = 0 at trained=1).
describe('progression (integration)', () => {
  it('goes from the Wilderness up to a Farm producing food', () => {
    const s = createInitialState(0); // level 0 (Wilderness), 0 workers, caps 3/3

    // Train the first worker for free (n=0 → cost 0).
    expect(trainWorker(s)).toBe(true);
    expect(s.workers.trained).toBe(1);

    // Gather 3 wood then 3 stone to afford the Build Shack cost.
    assignWorker(s, 'wood', 1);
    simulate(s, 5); // fills to cap (3)
    assignWorker(s, 'wood', -1);
    assignWorker(s, 'stone', 1);
    simulate(s, 10); // fills to cap (3)

    expect(s.resources.wood.amount.toNumber()).toBe(3);
    expect(s.resources.stone.amount.toNumber()).toBe(3);

    // Build Shack: 0 → 1.
    expect(upgradeSettlement(s)).toBe(true);
    expect(s.level).toBe(1);
    expect(getCapacity(s, 'wood')!.toNumber()).toBe(3); // still 3 at Small Shack

    // Gather again toward Large Shack (costs 3/3/1food).
    assignWorker(s, 'stone', -1);
    assignWorker(s, 'wood', 1);
    simulate(s, 5);
    assignWorker(s, 'wood', -1);
    assignWorker(s, 'stone', 1);
    simulate(s, 10);
    s.resources.food.amount = D(1); // inject 1 food for the upgrade cost
    expect(upgradeSettlement(s)).toBe(true); // 1 → 2
    expect(s.level).toBe(2);
    expect(getCapacity(s, 'wood')!.toNumber()).toBe(25);

    // Train the second worker (costs 1 food; inject directly since Market is not under test).
    s.resources.food.amount = D(1);
    expect(trainWorker(s)).toBe(true);
    expect(s.workers.trained).toBe(2);

    // Upgrade to Large Cabin (costs 30/30/15food, no worker minimum).
    // Cost 30 exceeds the L2 cap of 25 — inject directly to bypass storage limit.
    assignWorker(s, 'stone', -1);
    assignWorker(s, 'wood', 1);
    assignWorker(s, 'stone', 1);
    s.resources.wood.amount = D(30);
    s.resources.stone.amount = D(30);
    s.resources.food.amount = D(15);
    expect(upgradeSettlement(s)).toBe(true); // 2 → 3
    expect(s.level).toBe(3);
    expect(getCapacity(s, 'wood')!.toNumber()).toBe(250);

    // Build the Farm (available at level 2+).
    simulate(s, 120);
    expect(buildBuilding(s, 'farm')).toBe(true);
    expect(isResourceUnlocked(s, 'food')).toBe(true);

    // Put a worker on food, let it accrue, then train a third worker.
    assignWorker(s, 'wood', -1);
    assignWorker(s, 'food', 1);
    simulate(s, 60);
    expect(s.resources.food.amount.toNumber()).toBeGreaterThan(2);

    const before = s.workers.trained;
    expect(trainWorker(s)).toBe(true);
    expect(s.workers.trained).toBe(before + 1);
  });
});

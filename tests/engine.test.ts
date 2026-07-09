import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/engine/state';
import { D } from '../src/engine/numbers';
import { tick } from '../src/engine/tick';
import { assignWorker } from '../src/engine/actions';
import { buildBuilding } from '../src/systems/buildings';
import { applyOffline, MAX_OFFLINE_SECONDS } from '../src/engine/offline';
import { serialize, deserialize } from '../src/engine/save';
import {
  getCapacity,
  getAvailableWorkers,
  isResourceUnlocked,
  canBuild,
  getProductionRate,
} from '../src/engine/selectors';

describe('production tick', () => {
  it('produces at rate = workers × perWorker', () => {
    const s = createInitialState(0);
    assignWorker(s, 'wood', 2); // 2 workers × 1/s
    tick(s, 5);
    expect(s.resources.wood.amount.toNumber()).toBe(10);
    expect(getProductionRate(s, 'wood').toNumber()).toBe(2);
  });

  it('clamps production at storage capacity', () => {
    const s = createInitialState(0);
    assignWorker(s, 'wood', 3); // 3/s, cap 50
    tick(s, 1000); // would be 3000 uncapped
    expect(s.resources.wood.amount.toNumber()).toBe(50);
    expect(getCapacity(s, 'wood').toNumber()).toBe(50);
  });

  it('does not produce locked resources', () => {
    const s = createInitialState(0);
    expect(isResourceUnlocked(s, 'stone')).toBe(false);
    assignWorker(s, 'stone', 1); // ignored — stone is locked
    tick(s, 10);
    expect(s.resources.stone.amount.toNumber()).toBe(0);
    expect(s.workers.assigned.stone).toBe(0);
  });
});

describe('worker assignment', () => {
  it('never over-assigns beyond the pool', () => {
    const s = createInitialState(0); // 3 workers
    assignWorker(s, 'wood', 5); // only 3 available
    expect(s.workers.assigned.wood).toBe(3);
    expect(getAvailableWorkers(s)).toBe(0);
  });

  it('never goes below zero', () => {
    const s = createInitialState(0);
    assignWorker(s, 'wood', -1);
    expect(s.workers.assigned.wood).toBe(0);
  });
});

describe('buildings', () => {
  it('builds the cabin, unlocks stone, and spends resources', () => {
    const s = createInitialState(0);
    s.resources.wood.amount = D(10);

    expect(canBuild(s, 'cabin')).toBe(true);
    expect(buildBuilding(s, 'cabin')).toBe(true);

    expect(s.buildings.cabin.level).toBe(1);
    expect(s.resources.wood.amount.toNumber()).toBe(0);
    expect(s.level).toBe(2);
    expect(isResourceUnlocked(s, 'stone')).toBe(true);
  });

  it('applies the level-2 capacity multiplier', () => {
    const s = createInitialState(0);
    s.resources.wood.amount = D(10);
    buildBuilding(s, 'cabin'); // L1 → level 2, unlocks stone
    s.resources.wood.amount = D(30);
    s.resources.stone.amount = D(15);
    expect(buildBuilding(s, 'cabin')).toBe(true); // L2 → +50% cap

    expect(s.buildings.cabin.level).toBe(2);
    expect(getCapacity(s, 'wood').toNumber()).toBe(75); // 50 × 1.5
  });

  it('refuses to build when unaffordable', () => {
    const s = createInitialState(0);
    expect(canBuild(s, 'cabin')).toBe(false);
    expect(buildBuilding(s, 'cabin')).toBe(false);
    expect(s.buildings.cabin.level).toBe(0);
  });
});

describe('offline catch-up', () => {
  it('awards linear production for the elapsed time', () => {
    const s = createInitialState(0);
    assignWorker(s, 'wood', 2); // 2/s
    const summary = applyOffline(s, 10_000); // 10s later
    expect(summary.elapsedSeconds).toBe(10);
    expect(summary.capped).toBe(false);
    expect(summary.gains.wood?.toNumber()).toBe(20);
    expect(s.lastTick).toBe(10_000);
  });

  it('caps very long absences and clamps to capacity', () => {
    const s = createInitialState(0);
    assignWorker(s, 'wood', 1); // 1/s
    const tenDaysMs = 10 * 24 * 3600 * 1000;
    const summary = applyOffline(s, tenDaysMs);
    expect(summary.capped).toBe(true);
    expect(summary.elapsedSeconds).toBe(MAX_OFFLINE_SECONDS);
    expect(s.resources.wood.amount.toNumber()).toBe(50); // capped at capacity
  });
});

describe('save round-trip', () => {
  it('preserves state through serialize/deserialize', () => {
    const s = createInitialState(1000);
    s.resources.wood.amount = D('12345.5');
    s.level = 2;
    s.playtime = 42;
    assignWorker(s, 'wood', 3);
    s.buildings.cabin.level = 1;

    const restored = deserialize(serialize(s), 9999);

    expect(restored.resources.wood.amount.toString()).toBe('12345.5');
    expect(restored.level).toBe(2);
    expect(restored.playtime).toBe(42);
    expect(restored.workers.assigned.wood).toBe(3);
    expect(restored.buildings.cabin.level).toBe(1);
    expect(restored.createdAt).toBe(1000);
  });

  it('falls back to a fresh state on garbage input', () => {
    const restored = deserialize('not json', 500);
    expect(restored.level).toBe(1);
    expect(restored.createdAt).toBe(500);
  });

  it('accepts a versionless save without losing data', () => {
    const legacy = JSON.stringify({ level: 3, resources: { wood: { amount: '7' } } });
    const restored = deserialize(legacy, 0);
    expect(restored.level).toBe(3);
    expect(restored.resources.wood.amount.toNumber()).toBe(7);
  });
});

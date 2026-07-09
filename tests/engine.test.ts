import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/engine/state';
import { D } from '../src/engine/numbers';
import { tick } from '../src/engine/tick';
import { assignWorker, trainWorker } from '../src/engine/actions';
import { buildBuilding } from '../src/systems/buildings';
import { upgradeSettlement } from '../src/systems/settlement';
import { applyOffline, MAX_OFFLINE_SECONDS } from '../src/engine/offline';
import { serialize, deserialize } from '../src/engine/save';
import {
  getCapacity,
  getAvailableWorkers,
  getMaxWorkers,
  isResourceUnlocked,
  canUpgradeSettlement,
  getWorkerCost,
  canTrainWorker,
} from '../src/engine/selectors';

describe('gathering', () => {
  it('produces at the producer rate', () => {
    const s = createInitialState(0);
    assignWorker(s, 'wood', 2); // 2 × 1/s
    tick(s, 5);
    expect(s.resources.wood.amount.toNumber()).toBe(10);
  });

  it('clamps to the settlement capacity', () => {
    const s = createInitialState(0); // level 1 → wood cap 25
    assignWorker(s, 'wood', 3);
    tick(s, 1000);
    expect(getCapacity(s, 'wood')!.toNumber()).toBe(25);
    expect(s.resources.wood.amount.toNumber()).toBe(25);
  });
});

describe('crafting', () => {
  it('consumes inputs and is limited by input supply', () => {
    const s = createInitialState(0);
    s.buildings.deepmine.level = 1; // unlock iron
    s.resources.food.amount = D(100);
    assignWorker(s, 'iron', 1); // 0.5 iron/s, 2 food each
    tick(s, 10); // wants 5 iron → needs 10 food
    expect(s.resources.iron.amount.toNumber()).toBeCloseTo(5, 6);
    expect(s.resources.food.amount.toNumber()).toBeCloseTo(90, 6);
  });

  it('runs a dependency chain within a tick (food → iron → steel)', () => {
    const s = createInitialState(0);
    s.buildings.deepmine.level = 2; // unlock iron + steel
    s.resources.food.amount = D(100);
    assignWorker(s, 'iron', 1); // makes 0.5 iron/s
    assignWorker(s, 'steel', 1); // consumes 2 iron per steel, 0.25 steel/s
    tick(s, 1);
    expect(s.resources.steel.amount.toNumber()).toBeCloseTo(0.25, 6);
    // Steel ate the iron produced this tick.
    expect(s.resources.iron.amount.toNumber()).toBeCloseTo(0, 6);
  });

  it('does not craft a locked resource', () => {
    const s = createInitialState(0);
    expect(isResourceUnlocked(s, 'iron')).toBe(false);
    assignWorker(s, 'iron', 1); // ignored
    expect(s.workers.assigned.iron).toBe(0);
  });
});

describe('workers', () => {
  it('caps a line by its building level', () => {
    const s = createInitialState(0);
    s.buildings.deepmine.level = 1;
    expect(getMaxWorkers(s, 'iron')).toBe(1);
    assignWorker(s, 'iron', 3); // only 1 slot
    expect(s.workers.assigned.iron).toBe(1);
  });

  it('never over-assigns beyond the pool', () => {
    const s = createInitialState(0); // 3 workers
    assignWorker(s, 'wood', 5);
    expect(s.workers.assigned.wood).toBe(3);
    expect(getAvailableWorkers(s)).toBe(0);
  });

  it('trains workers on the floor(n²/2) food curve', () => {
    const s = createInitialState(0); // trained = 3
    expect(getWorkerCost(s).toNumber()).toBe(4); // floor(9/2)
    s.resources.food.amount = D(4);
    expect(trainWorker(s)).toBe(true);
    expect(s.workers.trained).toBe(4);
    expect(s.resources.food.amount.toNumber()).toBe(0);
    expect(getWorkerCost(s).toNumber()).toBe(8); // floor(16/2)
    expect(canTrainWorker(s)).toBe(false);
  });
});

describe('buildings', () => {
  it('requires availability, then builds and levels up', () => {
    const s = createInitialState(0); // level 1; blacksmith needs level 3
    s.resources.wood.amount = D(1000);
    s.resources.stone.amount = D(1000);
    expect(buildBuilding(s, 'blacksmith')).toBe(false); // not available yet

    s.level = 3;
    expect(buildBuilding(s, 'blacksmith')).toBe(true);
    expect(s.buildings.blacksmith.level).toBe(1);
    expect(isResourceUnlocked(s, 'arrow')).toBe(true);
    expect(s.resources.wood.amount.toNumber()).toBe(900); // 100 spent
  });
});

describe('settlement', () => {
  it('upgrades tiers, lifting caps', () => {
    const s = createInitialState(0);
    s.resources.wood.amount = D(20);
    s.resources.stone.amount = D(20);
    expect(getCapacity(s, 'wood')!.toNumber()).toBe(25);
    expect(upgradeSettlement(s)).toBe(true);
    expect(s.level).toBe(2);
    expect(getCapacity(s, 'wood')!.toNumber()).toBe(50);
  });

  it('enforces the worker requirement for a tier', () => {
    const s = createInitialState(0);
    s.level = 2; // next tier (3) needs 4 trained workers
    s.resources.wood.amount = D(100);
    s.resources.stone.amount = D(100);
    expect(s.workers.trained).toBe(3);
    expect(canUpgradeSettlement(s)).toBe(false);

    s.resources.food.amount = D(100);
    trainWorker(s); // → 4 trained
    expect(canUpgradeSettlement(s)).toBe(true);
  });
});

describe('offline catch-up', () => {
  it('awards production for elapsed time', () => {
    const s = createInitialState(0);
    assignWorker(s, 'wood', 2); // 2/s, cap 25
    const summary = applyOffline(s, 5_000);
    expect(summary.elapsedSeconds).toBe(5);
    expect(summary.gains.wood?.toNumber()).toBe(10);
    expect(s.lastTick).toBe(5_000);
  });

  it('caps very long absences', () => {
    const s = createInitialState(0);
    assignWorker(s, 'wood', 1);
    const summary = applyOffline(s, 10 * 24 * 3600 * 1000);
    expect(summary.capped).toBe(true);
    expect(summary.elapsedSeconds).toBe(MAX_OFFLINE_SECONDS);
    expect(s.resources.wood.amount.toNumber()).toBe(25); // clamped to cap
  });
});

describe('save', () => {
  it('round-trips through serialize/deserialize', () => {
    const s = createInitialState(1000);
    s.resources.wood.amount = D('4321.5');
    s.level = 3;
    s.playtime = 99;
    s.workers.trained = 6;
    assignWorker(s, 'wood', 2);
    s.buildings.deepmine.level = 2;

    const restored = deserialize(serialize(s), 9999);
    expect(restored.resources.wood.amount.toString()).toBe('4321.5');
    expect(restored.level).toBe(3);
    expect(restored.playtime).toBe(99);
    expect(restored.workers.trained).toBe(6);
    expect(restored.workers.assigned.wood).toBe(2);
    expect(restored.buildings.deepmine.level).toBe(2);
    expect(restored.createdAt).toBe(1000);
  });

  it('migrates a v1 save, keeping raw materials and resetting progression', () => {
    const legacy = JSON.stringify({
      version: 1,
      createdAt: 500,
      playtime: 12,
      level: 2,
      resources: { wood: { amount: '30' }, stone: { amount: '5' } },
      workers: { total: 5, assigned: { wood: 2 } },
      buildings: { cabin: { level: 1 } },
    });
    const restored = deserialize(legacy, 0);
    expect(restored.level).toBe(1); // progression reset
    expect(restored.resources.wood.amount.toNumber()).toBe(30); // kept
    expect(restored.resources.stone.amount.toNumber()).toBe(5); // kept
    expect(restored.playtime).toBe(12);
    expect(restored.workers.trained).toBe(3); // fresh default
  });

  it('falls back to a fresh state on garbage', () => {
    const restored = deserialize('not json', 500);
    expect(restored.level).toBe(1);
    expect(restored.createdAt).toBe(500);
  });
});

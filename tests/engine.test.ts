import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/engine/state';
import { D } from '../src/engine/numbers';
import { tick } from '../src/engine/tick';
import { assignWorker, trainWorker } from '../src/engine/actions';
import { buildBuilding } from '../src/systems/buildings';
import { upgradeSettlement } from '../src/systems/settlement';
import { applyOffline, MAX_OFFLINE_SECONDS } from '../src/engine/offline';
import { serialize, deserialize } from '../src/engine/save';
import { SETTLEMENT_TIERS } from '../src/content/settlement';
import type { ResourceId } from '../src/content/resources';
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
    s.level = 5; // lift the tiny level-1 cap so the rate is what's tested
    assignWorker(s, 'wood', 2); // 2 × 1/s
    tick(s, 5);
    expect(s.resources.wood.amount.toNumber()).toBe(10);
  });

  it('clamps to the settlement capacity', () => {
    const s = createInitialState(0); // level 1 → wood cap 3 (original)
    assignWorker(s, 'wood', 2);
    tick(s, 1000);
    expect(getCapacity(s, 'wood')!.toNumber()).toBe(3);
    expect(s.resources.wood.amount.toNumber()).toBe(3);
  });
});

describe('crafting', () => {
  it('consumes food and is limited by supply (fractional metal)', () => {
    const s = createInitialState(0);
    s.buildings.deepmine.level = 1; // unlock iron
    s.resources.food.amount = D(100);
    assignWorker(s, 'iron', 1); // 0.1 iron/s, 1 food per 0.1 iron (10 food/iron)
    tick(s, 10); // wants 1 iron → needs 10 food
    expect(s.resources.iron.amount.toNumber()).toBeCloseTo(1, 6);
    expect(s.resources.food.amount.toNumber()).toBeCloseTo(90, 6);
  });

  it('smelts each metal from food independently (coin-old model)', () => {
    const s = createInitialState(0);
    s.buildings.deepmine.level = 2; // unlock iron + steel
    s.resources.food.amount = D(100);
    assignWorker(s, 'iron', 1); // 0.1 iron/s, food-fed
    assignWorker(s, 'steel', 1); // 0.005 steel/s, also food-fed (not iron-fed)
    tick(s, 1);
    expect(s.resources.iron.amount.toNumber()).toBeCloseTo(0.1, 6); // iron NOT eaten by steel
    expect(s.resources.steel.amount.toNumber()).toBeCloseTo(0.005, 6);
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
    const s = createInitialState(0); // 2 workers
    assignWorker(s, 'wood', 5);
    expect(s.workers.assigned.wood).toBe(2);
    expect(getAvailableWorkers(s)).toBe(0);
  });

  it('trains workers on the floor(n²/2) food curve', () => {
    const s = createInitialState(0); // trained = 2
    expect(getWorkerCost(s).toNumber()).toBe(2); // floor(4/2)
    s.resources.food.amount = D(2);
    expect(trainWorker(s)).toBe(true);
    expect(s.workers.trained).toBe(3);
    expect(s.resources.food.amount.toNumber()).toBe(0);
    expect(getWorkerCost(s).toNumber()).toBe(4); // floor(9/2)
    expect(canTrainWorker(s)).toBe(false);
  });
});

describe('buildings', () => {
  it('requires availability, then builds and levels up', () => {
    const s = createInitialState(0); // level 1; blacksmith needs level 4
    s.resources.wood.amount = D(1000);
    s.resources.stone.amount = D(1000);
    expect(buildBuilding(s, 'blacksmith')).toBe(false); // not available yet

    s.level = 4;
    expect(buildBuilding(s, 'blacksmith')).toBe(true);
    expect(s.buildings.blacksmith.level).toBe(1);
    expect(isResourceUnlocked(s, 'arrow')).toBe(true);
    expect(s.resources.wood.amount.toNumber()).toBe(900); // 100 spent
  });
});

describe('settlement', () => {
  it('upgrades tiers, lifting caps', () => {
    const s = createInitialState(0);
    s.resources.wood.amount = D(3);
    s.resources.stone.amount = D(3);
    expect(getCapacity(s, 'wood')!.toNumber()).toBe(3); // L1 Small Shack
    expect(upgradeSettlement(s)).toBe(true);
    expect(s.level).toBe(2);
    expect(getCapacity(s, 'wood')!.toNumber()).toBe(25); // L2 Large Shack
  });

  it('never prices a tier above the previous tier storage cap', () => {
    // The progression invariant (from the original): you must be able to save
    // up for the next upgrade within your *current* storage. If a cost ever
    // exceeds the current tier's cap for a capped resource, that upgrade is
    // unreachable and progression dead-ends.
    for (const tier of SETTLEMENT_TIERS) {
      const next = SETTLEMENT_TIERS.find((t) => t.level === tier.level + 1);
      if (!next) continue;
      for (const [rid, amount] of Object.entries(next.cost) as [ResourceId, number][]) {
        const cap = tier.caps[rid];
        if (cap === undefined) continue; // uncapped resource (honor/wisdom/mithril)
        expect(amount, `L${tier.level} cap for ${rid} must hold L${next.level} cost`).toBeLessThanOrEqual(cap);
      }
    }
  });

  it('enforces the worker requirement for a tier', () => {
    const s = createInitialState(0);
    s.level = 2; // next tier (3, Small Cabin) needs 2 trained workers
    s.resources.wood.amount = D(100);
    s.resources.stone.amount = D(100);
    s.workers.trained = 1; // one short of the requirement
    expect(canUpgradeSettlement(s)).toBe(false);

    s.workers.trained = 2; // meets the requirement
    expect(canUpgradeSettlement(s)).toBe(true);
  });

  it('checks a standing threshold (defense) without consuming it', () => {
    const s = createInitialState(0);
    s.level = 5; // next tier (6, Large Village) requires defense ≥ 5
    s.resources.wood.amount = D(1000);
    s.resources.stone.amount = D(1000);
    s.resources.food.amount = D(1000);
    s.resources.defense.amount = D(4);
    expect(canUpgradeSettlement(s)).toBe(false);

    s.resources.defense.amount = D(5);
    expect(canUpgradeSettlement(s)).toBe(true);
    expect(upgradeSettlement(s)).toBe(true);
    expect(s.resources.defense.amount.toNumber()).toBe(5); // threshold not consumed
  });
});

describe('building-derived caps & converters', () => {
  it('caps defense at the Castle tier defenseMax', () => {
    const s = createInitialState(0);
    expect(getCapacity(s, 'defense')!.toNumber()).toBe(0); // no Castle yet
    s.buildings.castle.level = 1; // Watchtower
    expect(getCapacity(s, 'defense')!.toNumber()).toBe(5);
    s.buildings.castle.level = 3; // Stronghold
    expect(getCapacity(s, 'defense')!.toNumber()).toBe(30);
  });

  it('caps ward (Wizard Tower) and coin (Bank) from their buildings', () => {
    const s = createInitialState(0);
    s.buildings.wizardtower.level = 1;
    expect(getCapacity(s, 'ward')!.toNumber()).toBe(5);
    s.buildings.bank.level = 2;
    expect(getCapacity(s, 'coin')!.toNumber()).toBe(10);
  });

  it('builds defense from archers, capped by defenseMax', () => {
    const s = createInitialState(0);
    s.buildings.castle.level = 1; // unlocks defense, cap 5
    s.resources.archer.amount = D(100);
    expect(getMaxWorkers(s, 'defense')).toBe(1); // single-slot converter
    assignWorker(s, 'defense', 3); // clamps to 1
    expect(s.workers.assigned.defense).toBe(1);
    tick(s, 100, { combat: false }); // wants 100 defense, but cap is 5
    expect(s.resources.defense.amount.toNumber()).toBe(5);
    expect(s.resources.archer.amount.toNumber()).toBe(95); // 5 archers consumed
  });

  it('caps magic-orb questing at the Castle level', () => {
    const s = createInitialState(0);
    s.buildings.castle.level = 2; // magic orbs unlock at Castle 2
    expect(getMaxWorkers(s, 'magicorb')).toBe(2);
  });
});

describe('offline catch-up', () => {
  it('awards production for elapsed time', () => {
    const s = createInitialState(0);
    s.level = 5; // lift the tiny level-1 cap so 10 wood fits
    assignWorker(s, 'wood', 2); // 2/s
    const summary = applyOffline(s, 5_000);
    expect(summary.elapsedSeconds).toBe(5);
    expect(summary.gains.wood?.toNumber()).toBe(10);
    expect(s.lastTick).toBe(5_000);
  });

  it('caps very long absences', () => {
    const s = createInitialState(0); // level 1 → wood cap 3
    assignWorker(s, 'wood', 1);
    const summary = applyOffline(s, 10 * 24 * 3600 * 1000);
    expect(summary.capped).toBe(true);
    expect(summary.elapsedSeconds).toBe(MAX_OFFLINE_SECONDS);
    expect(s.resources.wood.amount.toNumber()).toBe(3); // clamped to cap
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
    expect(restored.workers.trained).toBe(2); // fresh default (coin-old start)
  });

  it('migrates a v3 save to v4, resetting progression but keeping base materials', () => {
    const v3 = JSON.stringify({
      version: 3,
      createdAt: 500,
      playtime: 42,
      level: 9,
      resources: { wood: { amount: '999' }, stone: { amount: '7' }, food: { amount: '3' } },
      combat: { assault: { wave: 12, wins: 12 } },
    });
    const restored = deserialize(v3, 0);
    expect(restored.version).toBe(4);
    expect(restored.level).toBe(1); // reset
    expect(restored.resources.wood.amount.toNumber()).toBe(999); // kept
    expect(restored.resources.food.amount.toNumber()).toBe(3); // kept
    expect(restored.combat.assault.wave).toBe(0); // fresh combat
    expect(restored.playtime).toBe(42);
  });

  it('falls back to a fresh state on garbage', () => {
    const restored = deserialize('not json', 500);
    expect(restored.level).toBe(1);
    expect(restored.createdAt).toBe(500);
  });
});

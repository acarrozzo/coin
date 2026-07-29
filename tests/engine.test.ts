import { describe, it, expect } from 'vitest';
import { createInitialState, SAVE_VERSION } from '../src/engine/state';
import { PRODUCER_INPUTS } from '../src/content/producers';
import { D, formatNumber, setRoundingSource } from '../src/engine/numbers';
import { tick } from '../src/engine/tick';
import {
  assignWorker,
  setAutomation,
  trainWorker,
  sellResource,
  buyRateUnlock,
  buyWorkerContract,
  buyFood,
} from '../src/engine/actions';
import { buildBuilding } from '../src/systems/buildings';
import { upgradeSettlement } from '../src/systems/settlement';
import { applyOffline, MAX_OFFLINE_SECONDS } from '../src/engine/offline';
import { serialize, deserialize } from '../src/engine/save';
import { SETTLEMENT_TIERS } from '../src/content/settlement';
import { ASSAULT } from '../src/content/combat';
import type { ResourceId } from '../src/content/resources';
import {
  getCapacity,
  getAvailableWorkers,
  getMaxWorkers,
  isResourceUnlocked,
  canUpgradeSettlement,
  getWorkerCost,
  canTrainWorker,
  getNetProductionRate,
  getLiveNetProductionRate,
  getResourceStatus,
  canStartCycle,
  canSell,
  getSellOffer,
  isRateUnlocked,
  canBuyRateUnlock,
  canBuyWorkerContract,
  canBuyFood,
  hasMarketOpportunity,
  countSellOpportunities,
  countBuyOpportunities,
  isNextBuildingLevelHidden,
  isNextBuildingLevelBeyondStorage,
  isBuildingNew,
  isResourceNew,
} from '../src/engine/selectors';
import {
  MAX_COIN_EARNED,
  SELLABLE_RESOURCES,
  RATE_UNLOCK_RESOURCES,
  WORKER_CONTRACT_IDS,
  FULL_MARKET_LEVEL,
} from '../src/content/market';

describe('gathering', () => {
  it('produces at the producer rate', () => {
    const s = createInitialState(0);
    s.level = 5; // lift the tiny level-1 cap so the rate is what's tested
    s.workers.trained = 2;
    assignWorker(s, 'wood', 2); // 2 × 1/s
    tick(s, 5);
    expect(s.resources.wood.amount.toNumber()).toBe(10);
  });

  it('clamps to the settlement capacity', () => {
    const s = createInitialState(0); // level 1 → wood cap 3 (original)
    s.workers.trained = 2;
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
    s.workers.trained = 1;
    s.resources.food.amount = D(100);
    assignWorker(s, 'iron', 1); // 0.1 iron/s, 1 food per 0.1 iron (10 food/iron)
    tick(s, 10); // wants 1 iron → needs 10 food
    expect(s.resources.iron.amount.toNumber()).toBeCloseTo(1, 6);
    expect(s.resources.food.amount.toNumber()).toBeCloseTo(90, 6);
  });

  it('smelts each metal from food independently (coin-old model)', () => {
    const s = createInitialState(0);
    s.buildings.deepmine.level = 2; // unlock iron + steel
    s.workers.trained = 2;
    s.resources.food.amount = D(100);
    assignWorker(s, 'iron', 1); // 0.1 iron / 1s cycle, food-fed
    assignWorker(s, 'steel', 1); // 0.01 steel / 2s cycle, also food-fed (not iron-fed)
    // Atomic cycles: steel only emits after a full 2s cycle. Run two so both
    // lines complete at least one cycle.
    tick(s, 2);
    expect(s.resources.iron.amount.toNumber()).toBeCloseTo(0.2, 6); // 2 cycles, iron NOT eaten by steel
    expect(s.resources.steel.amount.toNumber()).toBeCloseTo(0.01, 6); // 1 cycle
  });

  it('does not craft a locked resource', () => {
    const s = createInitialState(0);
    expect(isResourceUnlocked(s, 'iron')).toBe(false);
    assignWorker(s, 'iron', 1); // ignored
    expect(s.workers.assigned.iron).toBe(0);
  });
});

describe('atomic cycles', () => {
  it('emits nothing until a whole cycle completes, then a whole unit', () => {
    const s = createInitialState(0);
    s.level = 5; // lift caps
    s.workers.trained = 1;
    assignWorker(s, 'wood', 1); // 1 wood / 1s cycle
    tick(s, 0.5); // mid-cycle
    expect(s.resources.wood.amount.toNumber()).toBe(0);
    tick(s, 0.5); // cycle completes at t=1
    expect(s.resources.wood.amount.toNumber()).toBe(1);
    // Never fractional along the way.
    tick(s, 0.7);
    expect(Number.isInteger(s.resources.wood.amount.toNumber())).toBe(true);
    expect(s.resources.wood.amount.toNumber()).toBe(1);
  });

  it('does not start a cycle without full ingredients (all-or-nothing)', () => {
    const s = createInitialState(0);
    s.level = 6;
    s.buildings.blacksmith.level = 2; // unlock sword (10 wood + 2 iron / 10s)
    assignWorker(s, 'sword', 1);
    s.resources.wood.amount = D(100);
    s.resources.iron.amount = D(1); // short: needs 2
    tick(s, 20); // two cycles' worth of time
    expect(s.resources.sword.amount.toNumber()).toBe(0); // never started
    expect(s.resources.wood.amount.toNumber()).toBe(100); // inputs untouched
    expect(s.resources.iron.amount.toNumber()).toBe(1);
  });

  it('all-or-nothing across workers: N workers need N× of every input', () => {
    const s = createInitialState(0);
    s.workers.trained = 4; // enough pool to staff all 4 slots
    s.buildings.deepmine.level = 4; // 4 slots
    s.resources.food.amount = D(2); // only 2 food; 4 workers need 4/cycle
    assignWorker(s, 'iron', 4);
    expect(s.workers.assigned.iron).toBe(4);
    tick(s, 1);
    expect(s.resources.iron.amount.toNumber()).toBe(0); // batch can't start
    expect(s.resources.food.amount.toNumber()).toBe(2); // untouched
  });

  it('deducts inputs at cycle END and does not clamp a transient negative', () => {
    const s = createInitialState(0);
    s.buildings.deepmine.level = 1; // iron: 1 food/cycle, 1s
    s.workers.trained = 1;
    assignWorker(s, 'iron', 1);
    s.resources.food.amount = D(1); // exactly enough to START one cycle
    // Spend the food elsewhere mid-cycle, then let the committed cycle finish.
    tick(s, 0.5); // cycle committed, still mid-flight
    s.resources.food.amount = D(0); // player spent it
    tick(s, 0.5); // cycle completes: deduct 1 food → -1, shown as-is
    expect(s.resources.iron.amount.toNumber()).toBeCloseTo(0.1, 6);
    expect(s.resources.food.amount.toNumber()).toBe(-1); // negative, NOT clamped
  });

  it('keeps integer resources whole with many workers', () => {
    const s = createInitialState(0);
    s.level = 5;
    s.buildings.blacksmith.level = 3; // arrow: 2 wood + 1 stone / 0.5s; 3 worker slots
    s.resources.wood.amount = D(1000);
    s.resources.stone.amount = D(1000);
    assignWorker(s, 'arrow', 3);
    tick(s, 3.3); // spans several 0.5s cycles
    expect(Number.isInteger(s.resources.arrow.amount.toNumber())).toBe(true);
  });
});

describe('workers', () => {
  it('caps a line by its building level', () => {
    const s = createInitialState(0);
    s.buildings.deepmine.level = 1;
    s.workers.trained = 3;
    expect(getMaxWorkers(s, 'iron')).toBe(1);
    assignWorker(s, 'iron', 3); // only 1 slot
    expect(s.workers.assigned.iron).toBe(1);
  });

  it('never over-assigns beyond the pool', () => {
    const s = createInitialState(0);
    s.workers.trained = 1;
    assignWorker(s, 'wood', 5);
    expect(s.workers.assigned.wood).toBe(1);
    expect(getAvailableWorkers(s)).toBe(0);
  });

  it('trains workers on the cost curve: free, 1, 2, 4…', () => {
    const s = createInitialState(0);
    // Worker 1: free
    expect(getWorkerCost(s).toNumber()).toBe(0);
    expect(trainWorker(s)).toBe(true);
    expect(s.workers.trained).toBe(1);
    // Worker 2: 1 food
    expect(getWorkerCost(s).toNumber()).toBe(1);
    s.resources.food.amount = D(1);
    expect(trainWorker(s)).toBe(true);
    expect(s.workers.trained).toBe(2);
    // Worker 3: floor(4/2) = 2 food
    expect(getWorkerCost(s).toNumber()).toBe(2);
    s.resources.food.amount = D(2);
    expect(trainWorker(s)).toBe(true);
    expect(s.workers.trained).toBe(3);
    // Worker 4: floor(9/2) = 4 food
    expect(getWorkerCost(s).toNumber()).toBe(4);
    expect(canTrainWorker(s)).toBe(false);
  });
});

describe('NEW badges', () => {
  it('marks an available building until it is built', () => {
    const s = createInitialState(0);
    // Not available at level 0, so nothing to flag yet.
    expect(isBuildingNew(s, 'deepmine')).toBe(false);

    s.level = 5; // Deep Mine becomes available
    expect(isBuildingNew(s, 'deepmine')).toBe(true);

    s.resources.wood.amount = D(1000);
    s.resources.stone.amount = D(1000);
    expect(buildBuilding(s, 'deepmine')).toBe(true);
    expect(isBuildingNew(s, 'deepmine')).toBe(false);
  });

  it('marks an unlocked line until it is first staffed, and never again', () => {
    const s = createInitialState(0);
    s.workers.trained = 2;
    expect(isResourceNew(s, 'wood')).toBe(true);

    assignWorker(s, 'wood', 1);
    expect(isResourceNew(s, 'wood')).toBe(false);

    // Pulling the worker back off does NOT make the line new again — the badge
    // means "never used", not "unstaffed".
    assignWorker(s, 'wood', -1);
    expect(s.workers.assigned.wood).toBe(0);
    expect(isResourceNew(s, 'wood')).toBe(false);
  });

  it('does not mark a line that has not unlocked', () => {
    const s = createInitialState(0);
    // Iron needs a Deep Mine, which doesn't exist yet.
    expect(isResourceUnlocked(s, 'iron')).toBe(false);
    expect(isResourceNew(s, 'iron')).toBe(false);
  });

  it('clears a toggle line when auto-replenish is first switched on', () => {
    const s = createInitialState(0);
    s.buildings.castle.level = 1; // unlocks the defense converter
    expect(isResourceNew(s, 'defense')).toBe(true);

    expect(setAutomation(s, 'defense', true)).toBe(true);
    expect(isResourceNew(s, 'defense')).toBe(false);

    // Switching it back off leaves the badge retired.
    expect(setAutomation(s, 'defense', false)).toBe(true);
    expect(isResourceNew(s, 'defense')).toBe(false);
  });

  it('a failed assignment leaves the line marked new', () => {
    const s = createInitialState(0);
    s.workers.trained = 0; // nothing in the pool
    assignWorker(s, 'wood', 1);
    expect(s.workers.assigned.wood).toBe(0);
    expect(isResourceNew(s, 'wood')).toBe(true);
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

  it('requires a high-end resource in a cost without consuming it', () => {
    // Blacksmith L3 costs { stone: 400, iron: 1 }. Stone (base) is spent; iron
    // (a metal) must be held but is not removed from inventory.
    const s = createInitialState(0);
    s.level = 5;
    s.buildings.blacksmith.level = 1; // next level is the { stone: 400, iron: 1 } one
    s.resources.stone.amount = D(1000);

    s.resources.iron.amount = D(0);
    expect(buildBuilding(s, 'blacksmith')).toBe(false); // iron requirement unmet

    s.resources.iron.amount = D(1);
    expect(buildBuilding(s, 'blacksmith')).toBe(true);
    expect(s.buildings.blacksmith.level).toBe(2);
    expect(s.resources.stone.amount.toNumber()).toBe(600); // 400 stone spent
    expect(s.resources.iron.amount.toNumber()).toBe(1); // iron required, not consumed
  });

  it('hides a farm upgrade the settlement tier can never store', () => {
    // The Farm has no requiresLevel — its gate is the storage cap. At tier 3
    // (cap 250) L8 is the last affordable level: L9 costs 300/300, which the
    // tier can't hold, so the UI drops the row until the settlement grows.
    const s = createInitialState(0);
    s.level = 3;
    s.buildings.farm.level = 7; // next is L8 @ 220
    expect(isNextBuildingLevelHidden(s, 'farm')).toBe(false);

    s.buildings.farm.level = 8; // next is L9 @ 300 > cap 250
    expect(isNextBuildingLevelHidden(s, 'farm')).toBe(true);

    s.level = 4; // cap 500 — reachable again
    expect(isNextBuildingLevelHidden(s, 'farm')).toBe(false);
  });

  it('keeps the first farm build visible at the tier that unlocks it', () => {
    // Farm L1 costs 10/10 against tier 2's cap of 25 — expensive, not unreachable.
    const s = createInitialState(0);
    s.level = 2;
    expect(s.buildings.farm.level).toBe(0);
    expect(isNextBuildingLevelHidden(s, 'farm')).toBe(false);
  });

  it('only applies the storage gate to buildings marked cappedByStorage', () => {
    // Castle L5 costs 6400 stone against tier 8's 10000 cap; the Blacksmith is
    // unmarked, so even a cost above the cap leaves it to the existing gates.
    const s = createInitialState(0);
    s.level = 4;
    s.buildings.blacksmith.level = 1; // next is { stone: 400, iron: 1 }, cap 500
    expect(isNextBuildingLevelBeyondStorage(s, 'blacksmith')).toBe(false);
    // …still hidden, but by its requiresLevel: 5 gate, as before.
    expect(isNextBuildingLevelHidden(s, 'blacksmith')).toBe(true);
    s.level = 5;
    expect(isNextBuildingLevelHidden(s, 'blacksmith')).toBe(false);
  });
});

describe('settlement', () => {
  it('upgrades tiers, lifting caps', () => {
    const s = createInitialState(0);
    s.resources.wood.amount = D(3);
    s.resources.stone.amount = D(3);
    expect(getCapacity(s, 'wood')!.toNumber()).toBe(3); // L0 Wilderness
    expect(upgradeSettlement(s)).toBe(true); // 0 → 1 (Build Shack, costs 3/3)
    expect(s.level).toBe(1);
    expect(getCapacity(s, 'wood')!.toNumber()).toBe(3); // L1 Small Shack (same cap)
    s.resources.wood.amount = D(3);
    s.resources.stone.amount = D(3);
    s.resources.food.amount = D(1);
    expect(upgradeSettlement(s)).toBe(true); // 1 → 2 (Large Shack, costs 3/3/1food)
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
        expect(
          amount,
          `L${tier.level} cap for ${rid} must hold L${next.level} cost`,
        ).toBeLessThanOrEqual(cap);
      }
    }
  });

  it('upgrades without worker requirements (none on any tier)', () => {
    const s = createInitialState(0);
    s.level = 2; // next tier (3, Large Cabin) — no worker gate
    s.resources.wood.amount = D(100);
    s.resources.stone.amount = D(100);
    s.resources.food.amount = D(100);
    s.workers.trained = 0; // no workers needed
    expect(canUpgradeSettlement(s)).toBe(true);
  });

  it('checks a standing threshold (defense) without consuming it', () => {
    const s = createInitialState(0);
    s.level = 4; // next tier (5, Large Village) requires defense ≥ 5
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

  it('caps ward (Wizard Tower) from its building; coin is uncapped', () => {
    const s = createInitialState(0);
    s.buildings.wizardtower.level = 1;
    expect(getCapacity(s, 'ward')!.toNumber()).toBe(5);
    // Coin has no cap now that the Bank is gone — it accumulates freely.
    expect(getCapacity(s, 'coin')).toBeNull();
  });

  it('builds defense from archers while auto-replenish is on, capped by defenseMax', () => {
    const s = createInitialState(0);
    s.buildings.castle.level = 1; // unlocks defense, cap 5
    s.workers.trained = 1;
    s.resources.archer.amount = D(100);

    // Switched off by default: the line makes nothing however long it runs.
    tick(s, 100, { combat: false });
    expect(s.resources.defense.amount.toNumber()).toBe(0);

    expect(setAutomation(s, 'defense', true)).toBe(true);
    tick(s, 100, { combat: false }); // wants 100 defense, but cap is 5
    expect(s.resources.defense.amount.toNumber()).toBe(5);
    expect(s.resources.archer.amount.toNumber()).toBe(95); // 5 archers consumed
    // ...and it cost no workers: the whole pool is still free.
    expect(s.workers.assigned.defense).toBe(0);
    expect(getAvailableWorkers(s)).toBe(1);
  });

  it('refuses to staff a toggle line with workers', () => {
    const s = createInitialState(0);
    s.buildings.castle.level = 1;
    s.workers.trained = 3;
    assignWorker(s, 'defense', 1);
    expect(s.workers.assigned.defense).toBe(0);
    expect(getAvailableWorkers(s)).toBe(3);
  });

  it('drops a switched-off line’s cycle progress so it cannot bank one', () => {
    const s = createInitialState(0);
    s.buildings.wizardtower.level = 1; // ward: 5s cycle
    s.resources.mage.amount = D(10);
    s.resources.trollskull.amount = D(100);

    setAutomation(s, 'ward', true);
    tick(s, 4, { combat: false }); // 4s into a 5s cycle
    setAutomation(s, 'ward', false);
    expect(s.production.progress.ward).toBe(0);

    setAutomation(s, 'ward', true);
    tick(s, 1, { combat: false }); // would have completed if progress survived
    expect(s.resources.ward.amount.toNumber()).toBe(0);
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
    s.workers.trained = 2;
    assignWorker(s, 'wood', 2); // 2/s
    const summary = applyOffline(s, 5_000);
    expect(summary.elapsedSeconds).toBe(5);
    expect(summary.gains.wood?.toNumber()).toBe(10);
    expect(s.lastTick).toBe(5_000);
  });

  it('caps very long absences', () => {
    const s = createInitialState(0); // level 1 → wood cap 3
    s.workers.trained = 1;
    assignWorker(s, 'wood', 1);
    const summary = applyOffline(s, 10 * 24 * 3600 * 1000);
    expect(summary.capped).toBe(true);
    expect(summary.elapsedSeconds).toBe(MAX_OFFLINE_SECONDS);
    expect(s.resources.wood.amount.toNumber()).toBe(3); // clamped to cap
  });

  it('resolves combat while idle so honor accrues offline', () => {
    const s = createInitialState(0);
    s.level = ASSAULT.unlockLevel; // combat unlocked
    s.resources.defense.amount = D(1000); // repels every wave

    // Interval is 300s; over 1000s three assaults come due (t=300/600/900).
    const summary = applyOffline(s, 1000 * 1000);

    expect(summary.combat.assaults.won).toBe(3);
    expect(summary.combat.assaults.lost).toBe(0);
    expect(s.resources.honor.amount.toNumber()).toBe(3);
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
    // "Has ever been staffed" has to survive a reload, or every line would go
    // back to reading as new on the next load.
    expect(restored.everStaffed.wood).toBe(true);
    expect(restored.everStaffed.stone).toBeUndefined();
  });

  it('treats a save with no everStaffed as nothing-ever-staffed', () => {
    const s = createInitialState(1000);
    s.workers.trained = 2;
    assignWorker(s, 'wood', 1);

    // A save written before the field existed simply lacks the key.
    const raw = JSON.parse(serialize(s));
    delete raw.everStaffed;

    const restored = deserialize(JSON.stringify(raw), 9999);
    expect(restored.everStaffed).toEqual({});
    expect(isResourceNew(restored, 'wood')).toBe(true);
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
    expect(restored.workers.trained).toBe(0); // fresh default
  });

  it('migrates a v3 save forward, resetting progression but keeping base materials', () => {
    const v3 = JSON.stringify({
      version: 3,
      createdAt: 500,
      playtime: 42,
      level: 9,
      resources: { wood: { amount: '999' }, stone: { amount: '7' }, food: { amount: '3' } },
      combat: { assault: { wave: 12, wins: 12 } },
    });
    const restored = deserialize(v3, 0);
    expect(restored.version).toBe(SAVE_VERSION); // chained all the way up to the current version
    expect(restored.level).toBe(1); // reset
    expect(restored.resources.wood.amount.toNumber()).toBe(999); // kept
    expect(restored.resources.food.amount.toNumber()).toBe(3); // kept
    expect(restored.combat.assault.wave).toBe(0); // fresh combat
    expect(restored.playtime).toBe(42);
  });

  it('floors integer resources on migration, keeping metals fractional', () => {
    const v4 = JSON.stringify({
      version: 4,
      createdAt: 1,
      playtime: 1,
      level: 5,
      resources: {
        wood: { amount: '12.7' }, // integer resource → floored
        arrow: { amount: '3.9' }, // integer resource → floored
        iron: { amount: '0.35' }, // fractional handful → kept
        coin: { amount: '0.00042' }, // coin no longer minted/fractional → floored (v5→v6)
      },
    });
    const restored = deserialize(v4, 0);
    expect(restored.resources.wood.amount.toNumber()).toBe(12);
    expect(restored.resources.arrow.amount.toNumber()).toBe(3);
    expect(restored.resources.iron.amount.toNumber()).toBeCloseTo(0.35, 6);
    expect(restored.resources.coin.amount.toNumber()).toBe(0);
  });

  it('collapses tiered market progress to one-and-done flags (v8 → v9)', () => {
    const v8 = JSON.stringify({
      version: 8,
      createdAt: 1,
      playtime: 1,
      level: 5,
      resources: { coin: { amount: '5000' } },
      market: {
        coinEarned: '111110',
        sellTier: { wood: 1, stone: 0, arrow: 3, spear: 0 },
        rateUnlocks: { wood: true, stone: false, food: false },
        workerContract: 2,
        foodBought: 1,
      },
    });
    const restored = deserialize(v8, 0);

    // Any progress on a chain counts as having taken that offer — a player is
    // never billed twice for something they already paid for.
    expect(restored.market.sold).toEqual({
      wood: true,
      stone: false,
      arrow: true,
      spear: false,
    });
    // Two of three signed, in order, under the old sequential chain.
    expect(restored.market.contracts).toEqual({ i: true, ii: true, iii: false });
    expect(restored.market.foodBought).toBe(true);
    expect(restored.market.rateUnlocks.wood).toBe(true);

    // Old-economy coin is meaningless against the new 22 ceiling, so both the
    // balance and the lifetime total are clamped to it.
    expect(restored.market.coinEarned.toNumber()).toBe(MAX_COIN_EARNED);
    expect(restored.resources.coin.amount.toNumber()).toBe(MAX_COIN_EARNED);
  });

  it('carries a v7 save through the chain instead of stranding it', () => {
    // `migrate` stops at the first missing step, so v7 needs its own entry or
    // every later migration is skipped and the market reshape never runs.
    const v7 = JSON.stringify({
      version: 7,
      createdAt: 1,
      playtime: 1,
      level: 5,
      resources: {},
      market: { sellTier: { wood: 1, stone: 1, arrow: 0, spear: 0 }, workerContract: 1 },
    });
    const restored = deserialize(v7, 0);
    expect(restored.version).toBe(SAVE_VERSION);
    expect(restored.market.sold.wood).toBe(true);
    expect(restored.market.contracts.i).toBe(true);
  });

  it('round-trips the auto-replenish switches', () => {
    const s = createInitialState(0);
    s.buildings.castle.level = 1;
    setAutomation(s, 'defense', true);

    const restored = deserialize(serialize(s), 0);
    expect(restored.automation.defense).toBe(true);
    expect(restored.automation.ward).toBe(false);
  });

  it('hands back workers parked on defense/ward (v10 → v11)', () => {
    const v10 = JSON.stringify({
      version: 10,
      createdAt: 1,
      playtime: 1,
      level: 6,
      resources: {},
      workers: { trained: 4, bonus: 0, assigned: { wood: 2, defense: 1, ward: 1 } },
    });
    const restored = deserialize(v10, 0);
    expect(restored.version).toBe(SAVE_VERSION);
    expect(restored.workers.assigned.defense).toBe(0);
    expect(restored.workers.assigned.ward).toBe(0);
    expect(restored.workers.assigned.wood).toBe(2); // ordinary lines untouched
    expect(getAvailableWorkers(restored)).toBe(2); // the two are back in the pool
    // The switches start off — the player opts in, as on a fresh save.
    expect(restored.automation.defense).toBe(false);
  });

  it('falls back to a fresh state on garbage', () => {
    const restored = deserialize('not json', 500);
    expect(restored.level).toBe(0);
    expect(restored.createdAt).toBe(500);
  });
});

describe('formatNumber rounding toggle', () => {
  it('renders full digits by default (rounding off)', () => {
    expect(formatNumber(1112)).toBe('1112');
    expect(formatNumber(1_234_567)).toBe('1234567');
    expect(formatNumber(D('1.2e18'))).toBe('1200000000000000000');
    // below 1000 is unaffected by the toggle
    expect(formatNumber(950)).toBe('950');
  });

  it('collapses to K/M/B… suffixes when rounding is enabled', () => {
    let rounding = false;
    setRoundingSource(() => rounding);
    try {
      rounding = true;
      expect(formatNumber(1112)).toBe('1.11K');
      expect(formatNumber(1_500_000)).toBe('1.50M');
    } finally {
      // restore the module default so other tests see full digits
      setRoundingSource(() => false);
    }
  });

  it('keeps fractional gather precision on large fractional stacks (rounding off)', () => {
    expect(formatNumber(1234.5, 2)).toBe('1234.50');
  });
});

describe('net production rate — live vs nominal', () => {
  // A staffed consumer that can't actually run (starved on a non-wood input)
  // is counted by the nominal rate but not the live one, which then matches the
  // wood the simulation really moves. This is the "-3/s yet pinned at cap" bug.
  it('excludes starved consumers from the live rate but not the nominal', () => {
    const s = createInitialState(0);
    s.level = 9; // lift wood cap well above the amounts here
    s.workers.trained = 100;
    s.buildings.blacksmith.level = 5;
    s.buildings.hunterscabin.level = 6;

    s.workers.assigned.wood = 20; // +20 wood/s
    s.workers.assigned.spear = 4; // 8 wood/2s ×4 = 16/s nominal, needs stone
    s.workers.assigned.staff = 1; // 50 wood/10s = 5/s nominal, needs steel
    s.resources.stone.amount = D(0); // starves spear
    s.resources.steel.amount = D(0); // starves staff
    s.resources.wood.amount = D(5000); // mid-range, not at cap

    // Nominal: 20 − 16 − 5 = −1/s. Live: nothing consumes (both starved) → +20/s.
    expect(getNetProductionRate(s, 'wood').toNumber()).toBe(-1);
    expect(getLiveNetProductionRate(s, 'wood').toNumber()).toBe(20);

    // The live rate is the truth: 10s of ticks add ~200 wood, not drain it.
    const start = s.resources.wood.amount;
    tick(s, 10, { combat: false });
    const perSec = s.resources.wood.amount.minus(start).div(10).toNumber();
    expect(perSec).toBeCloseTo(20, 5);
  });

  // A surplus that can't be stored (resource at cap) reads as holding steady,
  // not as the "+X" its producers would nominally add.
  it('reports 0/s when a surplus resource sits at its cap', () => {
    const s = createInitialState(0);
    s.level = 9;
    s.workers.trained = 100;
    s.workers.assigned.wood = 20; // would nominally add +20/s
    s.resources.wood.amount = getCapacity(s, 'wood')!; // pinned at cap

    expect(getNetProductionRate(s, 'wood').toNumber()).toBe(20); // nominal ignores cap
    expect(getLiveNetProductionRate(s, 'wood').toNumber()).toBe(0); // live: stable at cap

    const start = s.resources.wood.amount;
    tick(s, 10, { combat: false });
    expect(s.resources.wood.amount.eq(start)).toBe(true); // truly doesn't move
  });

  // A genuine deficit at cap (demand outpaces production capacity) still shows
  // the negative rate it will fall at.
  it('shows a real deficit even at cap', () => {
    const s = createInitialState(0);
    s.level = 9;
    s.workers.trained = 100;
    s.buildings.wizardtower.level = 6;
    s.workers.assigned.wood = 20; // +20/s
    s.workers.assigned.ether = 10; // 10 wood/s each = 100 wood/s, needs only wood
    s.resources.wood.amount = getCapacity(s, 'wood')!; // at cap, but draining hard

    // 20 − 100 = −80/s; at cap but a real deficit, so it shows negative.
    expect(getLiveNetProductionRate(s, 'wood').toNumber()).toBe(-80);
  });
});

// The four states behind the nav's status dots. Shares canStartCycle's input
// gate but deliberately parts company with it at storage cap.
describe('resource status', () => {
  it('reads producing when staffed and fed, idle when unstaffed', () => {
    const s = createInitialState(0);
    s.workers.trained = 5;

    expect(getResourceStatus(s, 'wood')).toBe('idle');
    s.workers.assigned.wood = 2;
    expect(getResourceStatus(s, 'wood')).toBe('producing');
  });

  // A gathering line has no inputs, so it can never starve — staffed is enough.
  it('reads producing for an input-less line with an empty store', () => {
    const s = createInitialState(0);
    s.workers.trained = 5;
    s.workers.assigned.wood = 2;
    s.resources.wood.amount = D(0);

    expect(getResourceStatus(s, 'wood')).toBe('producing');
  });

  it('reads starved when staffed but missing an ingredient', () => {
    const s = createInitialState(0);
    s.level = 9;
    s.workers.trained = 100;
    s.buildings.hunterscabin.level = 6;
    s.workers.assigned.spear = 4; // eats wood and stone
    s.resources.wood.amount = D(5000);
    s.resources.stone.amount = D(0);

    expect(getResourceStatus(s, 'spear')).toBe('starved');
    s.resources.stone.amount = D(5000);
    expect(getResourceStatus(s, 'spear')).toBe('producing');
  });

  // The one place this parts from canStartCycle: that returns false at cap, but
  // a full store is not a problem to fix, so the dot stays green.
  it('reads producing, not starved, when the store is full', () => {
    const s = createInitialState(0);
    s.workers.trained = 5;
    s.workers.assigned.wood = 2;
    s.resources.wood.amount = getCapacity(s, 'wood')!;

    expect(canStartCycle(s, 'wood')).toBe(false); // cap-gated
    expect(getResourceStatus(s, 'wood')).toBe('producing'); // but healthy
  });

  // An unstaffed line is only a problem if it's holding something else up.
  it('reads wanted when an unstaffed line starves a running consumer', () => {
    const s = createInitialState(0);
    s.level = 9;
    s.workers.trained = 100;
    s.buildings.hunterscabin.level = 6;
    s.workers.assigned.stone = 0; // nobody mining
    s.resources.wood.amount = D(5000);
    s.resources.stone.amount = D(0);

    // Nothing running wants stone yet: merely idle.
    expect(getResourceStatus(s, 'stone')).toBe('idle');

    // Staff the spear line, which eats stone it hasn't got.
    s.workers.assigned.spear = 4;
    expect(getResourceStatus(s, 'stone')).toBe('wanted');

    // Fill the store and the consumer stops waiting, even though stone is
    // still unstaffed — the dot marks a bottleneck, not an empty chair.
    s.resources.stone.amount = D(5000);
    expect(getResourceStatus(s, 'stone')).toBe('idle');
  });

  // Toggle lines need no special case: getLineWorkers reports a switched-on
  // ward at its full workerCap, so it starves and demands like any staffed line.
  it('treats a toggle line as staffed only while its switch is on', () => {
    const s = createInitialState(0);
    s.level = 9;
    s.workers.trained = 100;
    s.buildings.wizardtower.level = 6;
    s.buildings.barracks.level = 5;
    s.resources.mage.amount = D(0);
    s.resources.trollskull.amount = D(0);

    // Switched off: unmanned, and nothing running is short of mages.
    setAutomation(s, 'ward', false);
    expect(getResourceStatus(s, 'ward')).toBe('idle');
    expect(getResourceStatus(s, 'mage')).toBe('idle');

    // Switched on with an empty store: the ward itself is starved, and the
    // unstaffed mage line is now the bottleneck holding it up.
    setAutomation(s, 'ward', true);
    expect(getResourceStatus(s, 'ward')).toBe('starved');
    expect(getResourceStatus(s, 'mage')).toBe('wanted');
  });

  // Honor and wisdom are won in combat, never produced — no line, no dot.
  it('returns null for a resource with no producer', () => {
    const s = createInitialState(0);
    expect(getResourceStatus(s, 'honor')).toBeNull();
    expect(getResourceStatus(s, 'wisdom')).toBeNull();
  });

  it('returns null for a locked resource', () => {
    const s = createInitialState(0);
    expect(isResourceUnlocked(s, 'iron')).toBe(false);
    expect(getResourceStatus(s, 'iron')).toBeNull();
  });
});

describe('producer recipes', () => {
  // Input order is display order (both the panel rows and the cost pills read
  // Object.entries), so the ordering here is intentional, not incidental.
  it('lists warrior first in the magic orb recipe, at 1 warrior', () => {
    expect(PRODUCER_INPUTS.magicorb).toEqual([
      ['warrior', 1],
      ['archer', 2],
    ]);
  });
});

describe('market — coin economy', () => {
  it('sells each resource exactly once', () => {
    const s = createInitialState(0);
    s.resources.wood.amount = D(3);
    s.resources.stone.amount = D(3);

    expect(canSell(s, 'wood')).toBe(true);
    expect(sellResource(s, 'wood')).toBe(true);
    expect(s.resources.wood.amount.toNumber()).toBe(0);
    expect(s.resources.coin.amount.toNumber()).toBe(1);
    expect(s.market.sold.wood).toBe(true);

    // One and done — the offer is gone even with stock back on hand.
    s.resources.wood.amount = D(999);
    expect(canSell(s, 'wood')).toBe(false);
    expect(sellResource(s, 'wood')).toBe(false);
    expect(s.resources.coin.amount.toNumber()).toBe(1);

    expect(sellResource(s, 'stone')).toBe(true);
    expect(s.resources.coin.amount.toNumber()).toBe(2);
    expect(canSell(s, 'stone')).toBe(false);
  });

  it('sells arrows once, consuming stock, with no further tier', () => {
    const s = createInitialState(0);
    s.resources.arrow.amount = D(2_000);

    expect(canSell(s, 'arrow')).toBe(true);
    expect(sellResource(s, 'arrow')).toBe(true);
    expect(s.resources.arrow.amount.toNumber()).toBe(1_900);
    expect(s.resources.coin.amount.toNumber()).toBe(10);
    expect(s.market.coinEarned.toNumber()).toBe(10);
    expect(s.market.sold.arrow).toBe(true);

    // Plenty of stock left, but there is no second sale.
    expect(canSell(s, 'arrow')).toBe(false);
    expect(sellResource(s, 'arrow')).toBe(false);
    expect(getSellOffer(s, 'arrow')).toBeNull();
  });

  it('caps lifetime coin earned at MAX_COIN_EARNED across all sellable resources', () => {
    const s = createInitialState(0);
    for (const id of SELLABLE_RESOURCES) {
      s.resources[id].amount = D(1_000);
      expect(sellResource(s, id)).toBe(true);
      expect(canSell(s, id)).toBe(false);
    }
    expect(s.market.coinEarned.toNumber()).toBe(MAX_COIN_EARNED);
    expect(s.resources.coin.amount.toNumber()).toBe(MAX_COIN_EARNED);
  });

  it('closes the economy: every sale exactly funds every purchase', () => {
    const s = createInitialState(0);
    for (const id of SELLABLE_RESOURCES) {
      s.resources[id].amount = D(1_000);
      sellResource(s, id);
    }
    expect(s.resources.coin.amount.toNumber()).toBe(MAX_COIN_EARNED);

    expect(buyFood(s)).toBe(true);
    for (const id of RATE_UNLOCK_RESOURCES) expect(buyRateUnlock(s, id)).toBe(true);
    for (const id of WORKER_CONTRACT_IDS) expect(buyWorkerContract(s, id)).toBe(true);

    // Nothing left to buy, and not a coin wasted.
    expect(s.resources.coin.amount.toNumber()).toBe(0);
    expect(hasMarketOpportunity(s)).toBe(false);
  });

  it('buys food once, then the offer is spent', () => {
    const s = createInitialState(0);
    s.resources.coin.amount = D(3);

    expect(canBuyFood(s)).toBe(true);
    expect(buyFood(s)).toBe(true);
    expect(s.resources.food.amount.toNumber()).toBe(10);
    expect(s.resources.coin.amount.toNumber()).toBe(2);
    expect(s.market.foodBought).toBe(true);

    // One and done, even with coin remaining.
    expect(canBuyFood(s)).toBe(false);
    expect(buyFood(s)).toBe(false);
    expect(s.resources.coin.amount.toNumber()).toBe(2);
  });

  it('unlocks a core rate display for its cost, in any order', () => {
    const s = createInitialState(0);
    s.resources.coin.amount = D(6);
    expect(isRateUnlocked(s, 'food')).toBe(false);
    expect(canBuyRateUnlock(s, 'food')).toBe(true);
    expect(buyRateUnlock(s, 'food')).toBe(true);
    expect(isRateUnlocked(s, 'food')).toBe(true);
    expect(s.resources.coin.amount.toNumber()).toBe(4);
    // Buying the same one again is a no-op.
    expect(canBuyRateUnlock(s, 'food')).toBe(false);
    expect(buyRateUnlock(s, 'food')).toBe(false);
  });

  it('signs Worker Contracts independently, in any order', () => {
    const s = createInitialState(0);
    s.resources.coin.amount = D(15);
    const before = s.workers.bonus;

    // III first — there is no chain, so nothing gates it.
    expect(buyWorkerContract(s, 'iii')).toBe(true); // +3 workers, 7 coin
    expect(s.workers.bonus).toBe(before + 3);
    expect(s.market.contracts.iii).toBe(true);
    expect(s.market.contracts.i).toBe(false);

    expect(buyWorkerContract(s, 'i')).toBe(true); // +1 worker, 3 coin
    expect(buyWorkerContract(s, 'ii')).toBe(true); // +2 workers, 5 coin
    expect(s.workers.bonus).toBe(before + 6);
    expect(s.resources.coin.amount.toNumber()).toBe(0);

    // Each is one and done.
    expect(canBuyWorkerContract(s, 'iii')).toBe(false);
    expect(buyWorkerContract(s, 'iii')).toBe(false);
  });

  it('counts only offers that can be acted on right now', () => {
    const s = createInitialState(0);
    s.level = FULL_MARKET_LEVEL;
    expect(countSellOpportunities(s)).toBe(0);
    expect(countBuyOpportunities(s)).toBe(0);
    expect(hasMarketOpportunity(s)).toBe(false);

    // Stock for two sales; coin for the food supply and one rate display.
    s.resources.wood.amount = D(3);
    s.resources.spear.amount = D(10);
    s.resources.coin.amount = D(2);
    expect(countSellOpportunities(s)).toBe(2);
    // food (1 coin) + all three rate displays (2 coin each) are affordable at 2
    // coin; the cheapest contract is 3, so no contract counts.
    expect(countBuyOpportunities(s)).toBe(4);
    expect(hasMarketOpportunity(s)).toBe(true);

    // Taking an offer removes it from the count.
    sellResource(s, 'wood');
    expect(countSellOpportunities(s)).toBe(1);
  });

  it('never counts a level-gated offer, however much stock or coin is on hand', () => {
    const s = createInitialState(0);
    s.level = FULL_MARKET_LEVEL - 1;
    s.resources.arrow.amount = D(9_999);
    s.resources.spear.amount = D(9_999);
    s.resources.coin.amount = D(999);

    // Weapon sales, rate displays and contracts are all still gated...
    expect(countSellOpportunities(s)).toBe(0);
    // ...leaving only the ungated food supply.
    expect(countBuyOpportunities(s)).toBe(1);

    s.level = FULL_MARKET_LEVEL;
    expect(countSellOpportunities(s)).toBe(2);
    expect(countBuyOpportunities(s)).toBe(
      1 + RATE_UNLOCK_RESOURCES.length + WORKER_CONTRACT_IDS.length,
    );
  });

  it('persists market progress through a save round-trip', () => {
    const s = createInitialState(0);
    s.resources.wood.amount = D(3);
    s.resources.arrow.amount = D(100);
    sellResource(s, 'wood'); // +1 coin
    sellResource(s, 'arrow'); // +10 coin → 11 total
    buyRateUnlock(s, 'wood'); // -2 coin → 9 remaining
    buyWorkerContract(s, 'ii');
    const restored = deserialize(serialize(s), 0);
    expect(restored.market.sold.wood).toBe(true);
    expect(restored.market.sold.arrow).toBe(true);
    expect(restored.market.sold.spear).toBe(false);
    expect(restored.market.coinEarned.toNumber()).toBe(11);
    expect(restored.market.rateUnlocks.wood).toBe(true);
    expect(restored.market.contracts.ii).toBe(true);
    expect(restored.market.contracts.i).toBe(false);
  });
});

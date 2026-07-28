import { describe, it, expect } from 'vitest';
import { createInitialState, SAVE_VERSION, type GameState } from '../src/engine/state';
import { doPrestige } from '../src/systems/prestige';
import {
  canPrestige,
  isPrestigeUnlocked,
  getNextPrestigeTier,
  getTotalWorkers,
} from '../src/engine/selectors';
import {
  PRESTIGE_TIERS,
  PRESTIGE_UNLOCK_LEVEL,
  MAX_PRESTIGE,
  getPrestigeTier,
} from '../src/content/prestige';
import { serialize, deserialize } from '../src/engine/save';
import { D } from '../src/engine/numbers';

const T0 = 1_000_000;

/** A state parked at the unlock level, holding the first tier's threshold. */
function readyToPrestige(): GameState {
  const s = createInitialState(T0);
  s.level = PRESTIGE_UNLOCK_LEVEL;
  s.resources.honor.amount = D(1);
  return s;
}

describe('prestige — content shape', () => {
  it('every tier grants 21 more starting workers than the last', () => {
    let prev = 0;
    for (const t of PRESTIGE_TIERS) {
      expect(t.workers - prev).toBe(21);
      prev = t.workers;
    }
  });

  it('tiers are numbered 1..MAX_PRESTIGE with no gaps', () => {
    expect(PRESTIGE_TIERS.map((t) => t.n)).toEqual(
      Array.from({ length: MAX_PRESTIGE }, (_, i) => i + 1),
    );
  });
});

describe('prestige — gating', () => {
  it('is locked below the unlock level even with the threshold met', () => {
    const s = readyToPrestige();
    s.level = PRESTIGE_UNLOCK_LEVEL - 1;
    expect(canPrestige(s)).toBe(false);
    expect(doPrestige(s)).toBe(false);
    expect(s.prestige.level).toBe(0);
  });

  it('is locked at the unlock level without the threshold', () => {
    const s = readyToPrestige();
    s.resources.honor.amount = D(0);
    expect(canPrestige(s)).toBe(false);
    expect(doPrestige(s)).toBe(false);
  });

  it('unlocks at the unlock level with the threshold held', () => {
    expect(canPrestige(readyToPrestige())).toBe(true);
  });

  it('the zone stays visible after a prestige drops you to level 0', () => {
    const s = readyToPrestige();
    expect(isPrestigeUnlocked(s)).toBe(true);
    doPrestige(s);
    expect(s.level).toBe(0);
    expect(isPrestigeUnlocked(s)).toBe(true);
  });

  it('runs out once every authored tier is taken', () => {
    const s = readyToPrestige();
    s.prestige.level = MAX_PRESTIGE;
    expect(getNextPrestigeTier(s)).toBeNull();
    expect(canPrestige(s)).toBe(false);
    expect(doPrestige(s)).toBe(false);
  });
});

describe('prestige — the reset', () => {
  it('wipes level, resources, buildings, combat, market, and assignments', () => {
    const s = readyToPrestige();
    s.resources.wood.amount = D(5000);
    s.resources.coin.amount = D(9);
    s.buildings.farm.level = 4;
    s.buildings.castle.level = 2;
    s.workers.trained = 12;
    s.workers.assigned.wood = 3;
    s.combat.assault.wave = 7;
    s.combat.assault.wins = 7;
    s.market.sold.wood = true;
    s.market.contracts.i = true;
    s.market.coinEarned = D(22);
    s.production.progress.wood = 0.4;

    expect(doPrestige(s)).toBe(true);

    expect(s.level).toBe(0);
    expect(s.resources.wood.amount.toNumber()).toBe(0);
    expect(s.resources.coin.amount.toNumber()).toBe(0);
    expect(s.buildings.farm.level).toBe(0);
    expect(s.buildings.castle.level).toBe(0);
    expect(s.workers.trained).toBe(0);
    expect(s.workers.assigned.wood).toBe(0);
    expect(s.combat.assault.wave).toBe(0);
    expect(s.combat.assault.wins).toBe(0);
    expect(s.market.sold.wood).toBe(false);
    expect(s.market.contracts.i).toBe(false);
    expect(s.market.coinEarned.toNumber()).toBe(0);
    expect(s.production.progress.wood).toBe(0);
  });

  it('keeps honor and wisdom, and does not spend the threshold', () => {
    const s = readyToPrestige();
    s.resources.honor.amount = D(3);
    s.resources.wisdom.amount = D(2);

    doPrestige(s);

    expect(s.resources.honor.amount.toNumber()).toBe(3);
    expect(s.resources.wisdom.amount.toNumber()).toBe(2);
  });

  it('keeps the lifetime clocks — a prestige is a new run, not a new save', () => {
    const s = readyToPrestige();
    s.createdAt = 12_345;
    s.playtime = 6789;
    s.lastTick = T0 + 500;

    doPrestige(s);

    expect(s.createdAt).toBe(12_345);
    expect(s.playtime).toBe(6789);
    expect(s.lastTick).toBe(T0 + 500);
  });

  it('grants the tier its starting workers as bonus, leaving training at zero', () => {
    const s = readyToPrestige();
    doPrestige(s);

    expect(s.prestige.level).toBe(1);
    expect(s.workers.bonus).toBe(PRESTIGE_TIERS[0].workers);
    expect(s.workers.trained).toBe(0);
    expect(getTotalWorkers(s)).toBe(21);
  });

  it('sets bonus absolutely, so re-signable Worker Contracts cannot compound', () => {
    const s = readyToPrestige();
    // A full run's worth of contract hires sitting in the bonus pool.
    s.workers.bonus = 6;
    doPrestige(s);
    expect(s.workers.bonus).toBe(21);
  });

  it('walks the ladder: the second prestige needs star metal and grants 42', () => {
    const s = readyToPrestige();
    doPrestige(s);

    // Back at level 0 with no star metal — nothing to do but play on.
    expect(canPrestige(s)).toBe(false);

    s.level = PRESTIGE_UNLOCK_LEVEL;
    expect(canPrestige(s)).toBe(false); // honor alone no longer suffices
    s.resources.starmetal.amount = D(1);
    expect(canPrestige(s)).toBe(true);

    expect(doPrestige(s)).toBe(true);
    expect(s.prestige.level).toBe(2);
    expect(getTotalWorkers(s)).toBe(42);
    // Star metal isn't carried, so the fresh run starts without it.
    expect(s.resources.starmetal.amount.toNumber()).toBe(0);
  });

  it('resets any state added later by default', () => {
    // The reset is built from createInitialState, so a prestiged state must be
    // field-for-field a fresh one apart from the survivors it copies back.
    const s = readyToPrestige();
    s.resources.honor.amount = D(0);
    s.level = PRESTIGE_UNLOCK_LEVEL;
    s.resources.honor.amount = D(1);
    doPrestige(s);

    const fresh = createInitialState(s.lastTick);
    fresh.prestige.level = 1;
    fresh.workers.bonus = PRESTIGE_TIERS[0].workers;
    fresh.resources.honor.amount = D(1);

    expect(JSON.parse(serialize(s))).toEqual(JSON.parse(serialize(fresh)));
  });
});

describe('prestige — saves', () => {
  it('round-trips the prestige level and its bonus workers', () => {
    const s = readyToPrestige();
    doPrestige(s);

    const back = deserialize(serialize(s), T0);
    expect(back.prestige.level).toBe(1);
    expect(back.workers.bonus).toBe(21);
    expect(back.resources.honor.amount.toNumber()).toBe(1);
  });

  it('loads a pre-prestige (v9) save at level 0', () => {
    const v9 = JSON.stringify({ ...JSON.parse(serialize(createInitialState(T0))), version: 9 });
    const back = deserialize(v9, T0);
    expect(back.version).toBe(SAVE_VERSION);
    expect(back.prestige.level).toBe(0);
  });

  it('clamps a level that points past the authored ladder', () => {
    const raw = JSON.parse(serialize(createInitialState(T0)));
    raw.prestige = { level: 99 };
    const back = deserialize(JSON.stringify(raw), T0);
    expect(back.prestige.level).toBe(MAX_PRESTIGE);
    expect(getPrestigeTier(back.prestige.level)).toBeDefined();
  });

  it('rejects a negative or fractional level', () => {
    const raw = JSON.parse(serialize(createInitialState(T0)));
    raw.prestige = { level: -3 };
    expect(deserialize(JSON.stringify(raw), T0).prestige.level).toBe(0);
    raw.prestige = { level: 1.7 };
    expect(deserialize(JSON.stringify(raw), T0).prestige.level).toBe(1);
  });
});

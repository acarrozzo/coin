import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/engine/state';
import { D } from '../src/engine/numbers';
import { runCombat } from '../src/systems/combat';
import { tick } from '../src/engine/tick';
import { getArmyPower, getNextAssaultPower } from '../src/engine/selectors';
import { serialize, deserialize } from '../src/engine/save';
import { ASSAULT } from '../src/content/combat';

/** Fast-forward the assault timer to the brink so one dt resolves an attack. */
function primeAssault(s: ReturnType<typeof createInitialState>) {
  s.level = ASSAULT.unlockLevel;
  s.combat.assault.timer = 0.01;
}

describe('army power', () => {
  it('sums unit counts × power', () => {
    const s = createInitialState(0);
    s.resources.archer.amount = D(3); // 3 × 2 = 6
    s.resources.mage.amount = D(1); // 1 × 8 = 8
    expect(getArmyPower(s).toNumber()).toBe(14);
  });
});

describe('assault resolution', () => {
  it('does nothing before combat unlocks', () => {
    const s = createInitialState(0); // level 1
    s.combat.assault.timer = 0.01;
    const events = runCombat(s, 1);
    expect(events).toHaveLength(0);
    expect(s.combat.assault.wave).toBe(0);
  });

  it('repels an assault when the army is strong enough, gaining honor', () => {
    const s = createInitialState(0);
    primeAssault(s);
    s.resources.warrior.amount = D(100); // huge army
    expect(getArmyPower(s).gte(getNextAssaultPower(s))).toBe(true);

    const events = runCombat(s, 1);
    expect(events).toEqual([{ kind: 'assault', won: true, wave: 1 }]);
    expect(s.combat.assault.wave).toBe(1); // escalated
    expect(s.combat.assault.wins).toBe(1);
    expect(s.resources.honor.amount.toNumber()).toBe(1);
  });

  it('takes casualties and holds the wave on defeat', () => {
    const s = createInitialState(0);
    primeAssault(s);
    s.resources.archer.amount = D(1); // power 2, threat is 6

    const events = runCombat(s, 1);
    expect(events[0]).toMatchObject({ kind: 'assault', won: false });
    expect(s.combat.assault.wave).toBe(0); // did not escalate
    expect(s.combat.assault.losses).toBe(1);
    // 30% casualty rate, floored: 1 → 0
    expect(s.resources.archer.amount.toNumber()).toBe(0);
    expect(s.resources.honor.amount.toNumber()).toBe(0);
  });

  it('resolves through tick() live, but not during offline (combat:false)', () => {
    const s = createInitialState(0);
    primeAssault(s);
    s.resources.warrior.amount = D(1000);

    // Offline-style tick: production only, no combat.
    const offlineEvents = tick(s, 1, { combat: false });
    expect(offlineEvents).toHaveLength(0);
    expect(s.combat.assault.wave).toBe(0);

    // Live tick: combat resolves.
    const liveEvents = tick(s, 1);
    expect(liveEvents.some((e) => e.kind === 'assault' && e.won)).toBe(true);
    expect(s.resources.honor.amount.toNumber()).toBe(1);
  });

  it('escalates: a cleared wave demands more next time', () => {
    const s = createInitialState(0);
    primeAssault(s);
    const first = getNextAssaultPower(s).toNumber();
    s.resources.warrior.amount = D(1000);
    runCombat(s, 1); // clears wave 0
    const second = getNextAssaultPower(s).toNumber();
    expect(second).toBeGreaterThan(first);
  });
});

describe('save v3', () => {
  it('round-trips combat state', () => {
    const s = createInitialState(0);
    s.combat.assault.wave = 4;
    s.combat.assault.wins = 4;
    s.combat.hex.losses = 2;
    s.resources.honor.amount = D(7);

    const restored = deserialize(serialize(s), 1);
    expect(restored.combat.assault.wave).toBe(4);
    expect(restored.combat.assault.wins).toBe(4);
    expect(restored.combat.hex.losses).toBe(2);
    expect(restored.resources.honor.amount.toNumber()).toBe(7);
  });

  it('gives a v2 save fresh combat defaults', () => {
    const legacy = JSON.stringify({
      version: 2,
      level: 3,
      resources: { wood: { amount: '10' } },
    });
    const restored = deserialize(legacy, 0);
    expect(restored.combat.assault.wave).toBe(0);
    expect(restored.combat.assault.timer).toBe(ASSAULT.intervalSeconds);
  });
});

import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/engine/state';
import { D } from '../src/engine/numbers';
import { runCombat } from '../src/systems/combat';
import { tick } from '../src/engine/tick';
import { getNextAssaultPower, willRepelAssault } from '../src/engine/selectors';
import { serialize, deserialize } from '../src/engine/save';
import { ASSAULT } from '../src/content/combat';

/** Fast-forward the assault timer to the brink so one dt resolves an attack. */
function primeAssault(s: ReturnType<typeof createInitialState>) {
  s.level = ASSAULT.unlockLevel;
  s.combat.assault.timer = 0.01;
}

describe('assault resolution (deterministic, defense-based)', () => {
  it('does nothing before combat unlocks', () => {
    const s = createInitialState(0); // level 1
    s.combat.assault.timer = 0.01;
    const events = runCombat(s, 1);
    expect(events).toHaveLength(0);
    expect(s.combat.assault.wave).toBe(0);
  });

  it('repels an assault when defense meets the attack power, gaining honor', () => {
    const s = createInitialState(0);
    primeAssault(s);
    s.resources.defense.amount = D(100); // plenty
    expect(willRepelAssault(s)).toBe(true);

    const events = runCombat(s, 1);
    expect(events).toEqual([{ kind: 'assault', won: true, wave: 1 }]);
    expect(s.combat.assault.wave).toBe(1); // escalated
    expect(s.combat.assault.wins).toBe(1);
    expect(s.resources.honor.amount.toNumber()).toBe(1);
  });

  it('loses defense and resets the wave to 0 on defeat', () => {
    const s = createInitialState(0);
    primeAssault(s);
    s.combat.assault.wave = 20; // attack power far exceeds any early defense
    s.resources.defense.amount = D(5);
    s.resources.wood.amount = D(50); // untouched — defense did not hit 0

    const events = runCombat(s, 1);
    expect(events[0]).toMatchObject({ kind: 'assault', won: false, breached: false });
    expect(s.combat.assault.wave).toBe(0); // attacker reset to the start
    expect(s.combat.assault.losses).toBe(1);
    expect(s.resources.defense.amount.toNumber()).toBe(4); // lost lossAmount (1)
    expect(s.resources.wood.amount.toNumber()).toBe(50); // core resources safe
    expect(s.resources.honor.amount.toNumber()).toBe(0);
  });

  it('wipes core resources when defense is breached (hits 0)', () => {
    const s = createInitialState(0);
    primeAssault(s);
    s.combat.assault.wave = 20;
    s.resources.defense.amount = D(1); // will drop to 0
    s.resources.wood.amount = D(50);
    s.resources.stone.amount = D(50);
    s.resources.food.amount = D(50);

    const events = runCombat(s, 1);
    expect(events[0]).toMatchObject({ kind: 'assault', won: false, breached: true });
    expect(s.resources.defense.amount.toNumber()).toBe(0);
    expect(s.resources.wood.amount.toNumber()).toBe(0);
    expect(s.resources.stone.amount.toNumber()).toBe(0);
    expect(s.resources.food.amount.toNumber()).toBe(0);
  });

  it('resolves through tick() by default, and can be disabled with combat:false', () => {
    const s = createInitialState(0);
    primeAssault(s);
    s.resources.defense.amount = D(100);

    // combat:false suppresses resolution (used by tests; offline now resolves combat).
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
    s.resources.defense.amount = D(1000);
    runCombat(s, 1); // clears wave 0
    const second = getNextAssaultPower(s).toNumber();
    expect(second).toBeGreaterThan(first);
  });
});

describe('assault loop over live time (escalate → wall → reset)', () => {
  it('climbs until the Castle-capped defense fails, then resets the wave', () => {
    const s = createInitialState(0);
    s.level = ASSAULT.unlockLevel; // 7
    s.buildings.castle.level = 1; // Watchtower → defenseMax 5
    s.resources.defense.amount = D(5); // maxed for this tier

    // ASSAULT interval is 300s; attackPower = 1.5^wave. Defense 5 holds waves
    // 0–3 (1.5^3 ≈ 3.4) but fails wave 4 (1.5^4 ≈ 5.06). 1810s → 6 assaults:
    // win, win, win, win, LOSE (wave resets, -1 defense), win.
    for (let i = 0; i < 1810; i++) tick(s, 1);

    expect(s.combat.assault.wins).toBe(5);
    expect(s.combat.assault.losses).toBe(1);
    expect(s.resources.honor.amount.toNumber()).toBe(5);
    expect(s.resources.defense.amount.toNumber()).toBe(4); // lost 1 on the breach
    expect(s.combat.assault.wave).toBe(1); // reset to 0, then cleared wave 0 again
  });
});

describe('save v4', () => {
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

  it('gives a legacy v2 save fresh combat defaults', () => {
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

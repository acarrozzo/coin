import { Decimal } from './numbers';
import type { GameState, ResourceId } from './state';
import { tick } from './tick';
import type { CombatEvent } from '../systems/combat';
import { RESOURCE_IDS } from '../content/resources';

/** How much offline time counts toward catch-up (8 hours). */
export const MAX_OFFLINE_SECONDS = 8 * 60 * 60;

/** Upper bound on catch-up iterations, so long absences stay fast. */
const MAX_STEPS = 10_000;

/** Combat that resolved during a catch-up, tallied for the welcome-back summary. */
export interface OfflineCombatSummary {
  assaults: { won: number; lost: number };
  hexes: { won: number; lost: number };
  /** True if a threat landed with no defense left and looted core resources. */
  breached: boolean;
}

export interface OfflineSummary {
  /** Seconds actually simulated (after capping). */
  elapsedSeconds: number;
  /** True if the real gap exceeded the cap. */
  capped: boolean;
  /** Per-resource gains during the catch-up. */
  gains: Partial<Record<ResourceId, Decimal>>;
  /** Combat that resolved while away. */
  combat: OfflineCombatSummary;
}

/**
 * Simulate `seconds` of game time in fixed chunks, returning any combat events.
 *
 * Crafting chains (food → iron → steel) depend on same-tick ordering, so we
 * step rather than run one giant tick — a single huge dt would let a chain
 * over-produce. Chunk size scales with the span to keep iterations bounded.
 *
 * Combat resolves during catch-up (attacks fire, honor/wisdom accrue, and a
 * breach can loot core resources), so idle time advances both threat tracks.
 */
export function simulate(state: GameState, seconds: number): CombatEvent[] {
  if (seconds <= 0) return [];
  const step = Math.max(1, seconds / MAX_STEPS);
  let remaining = seconds;
  const events: CombatEvent[] = [];
  while (remaining > 0) {
    const dt = Math.min(step, remaining);
    events.push(...tick(state, dt));
    remaining -= dt;
  }
  return events;
}

/** Fold a catch-up's combat events into a summary. */
function tallyCombat(events: CombatEvent[]): OfflineCombatSummary {
  const combat: OfflineCombatSummary = {
    assaults: { won: 0, lost: 0 },
    hexes: { won: 0, lost: 0 },
    breached: false,
  };
  for (const e of events) {
    const track = e.kind === 'assault' ? combat.assaults : combat.hexes;
    if (e.won) track.won += 1;
    else track.lost += 1;
    if (e.breached) combat.breached = true;
  }
  return combat;
}

/** Simulate time elapsed since the last save and advance `lastTick` to `now`. */
export function applyOffline(state: GameState, now: number): OfflineSummary {
  const rawElapsed = Math.max(0, (now - state.lastTick) / 1000);
  const elapsed = Math.min(rawElapsed, MAX_OFFLINE_SECONDS);

  const before = {} as Record<ResourceId, Decimal>;
  for (const id of RESOURCE_IDS) before[id] = state.resources[id].amount;

  const combat = tallyCombat(simulate(state, elapsed));
  state.lastTick = now;

  const gains: Partial<Record<ResourceId, Decimal>> = {};
  for (const id of RESOURCE_IDS) {
    const gain = state.resources[id].amount.minus(before[id]);
    if (gain.gt(0)) gains[id] = gain;
  }

  return { elapsedSeconds: elapsed, capped: rawElapsed > elapsed, gains, combat };
}

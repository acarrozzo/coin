import { D } from './numbers';
import { createInitialState, SAVE_VERSION, type GameState } from './state';
import { RESOURCE_IDS } from '../content/resources';
import { BUILDING_IDS } from '../content/buildings';

export const STORAGE_KEY = 'cc:save';

/** Loosely-typed shape of a parsed save, before we rebuild a real GameState. */
type RawSave = Record<string, unknown> & { version?: number };

/**
 * Ordered migrations. A migration at key N upgrades a version-N save to N+1,
 * so shipping a schema change never bricks a player's save.
 */
const migrations: Record<number, (data: RawSave) => RawSave> = {
  // v1 (Phase 1: wood/stone + a "cabin") → v2 (Phase 2: full economy).
  // The building/level semantics changed, so reset progression but keep the
  // raw materials and playtime the player accumulated.
  1: (data) => {
    const resources = (data.resources as Record<string, unknown>) ?? {};
    return {
      version: 2,
      createdAt: data.createdAt,
      playtime: data.playtime,
      level: 1,
      resources: {
        wood: resources.wood,
        stone: resources.stone,
      },
    };
  },
  // v2 → v3 (Phase 4): combat state added. Nothing to transform — the new
  // fields fall back to fresh defaults in deserialize.
  2: (data) => ({ ...data, version: 3 }),
};

function migrate(data: RawSave): RawSave {
  let d = data;
  let guard = 0;
  while ((d.version ?? 0) < SAVE_VERSION && guard++ < 100) {
    const step = migrations[d.version ?? 0];
    if (!step) {
      d = { ...d, version: SAVE_VERSION };
      break;
    }
    d = step(d);
  }
  return d;
}

/** Serialize to a JSON string (Decimals become strings). */
export function serialize(state: GameState): string {
  const resources: Record<string, { amount: string }> = {};
  for (const id of RESOURCE_IDS) {
    resources[id] = { amount: state.resources[id].amount.toString() };
  }
  return JSON.stringify({
    version: state.version,
    createdAt: state.createdAt,
    lastTick: state.lastTick,
    playtime: state.playtime,
    level: state.level,
    resources,
    workers: state.workers,
    buildings: state.buildings,
    combat: state.combat,
  });
}

/**
 * Rebuild a GameState from a JSON string. Missing/invalid fields fall back to a
 * fresh state's defaults, so adding new content never breaks old saves.
 */
export function deserialize(raw: string, now: number): GameState {
  let data: RawSave;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return createInitialState(now);
    data = parsed as RawSave;
  } catch {
    return createInitialState(now);
  }

  data = migrate(data);
  const state = createInitialState(now);
  state.version = SAVE_VERSION;

  if (typeof data.createdAt === 'number') state.createdAt = data.createdAt;
  if (typeof data.lastTick === 'number') state.lastTick = data.lastTick;
  if (typeof data.playtime === 'number') state.playtime = data.playtime;
  if (typeof data.level === 'number') state.level = data.level;

  const resources = data.resources as Record<string, { amount?: unknown }> | undefined;
  if (resources) {
    for (const id of RESOURCE_IDS) {
      const amount = resources[id]?.amount;
      if (typeof amount === 'string' || typeof amount === 'number') {
        state.resources[id].amount = D(amount);
      }
    }
  }

  const workers = data.workers as
    | { trained?: unknown; bonus?: unknown; assigned?: Record<string, unknown> }
    | undefined;
  if (workers) {
    if (typeof workers.trained === 'number') state.workers.trained = workers.trained;
    if (typeof workers.bonus === 'number') state.workers.bonus = workers.bonus;
    if (workers.assigned) {
      for (const id of RESOURCE_IDS) {
        const a = workers.assigned[id];
        if (typeof a === 'number') state.workers.assigned[id] = a;
      }
    }
  }

  const buildings = data.buildings as Record<string, { level?: unknown }> | undefined;
  if (buildings) {
    for (const id of BUILDING_IDS) {
      const level = buildings[id]?.level;
      if (typeof level === 'number') state.buildings[id].level = level;
    }
  }

  const combat = data.combat as
    | { assault?: Record<string, unknown>; hex?: Record<string, unknown> }
    | undefined;
  if (combat) {
    reviveThreat(combat.assault, state.combat.assault);
    reviveThreat(combat.hex, state.combat.hex);
  }

  return state;
}

function reviveThreat(raw: Record<string, unknown> | undefined, target: GameState['combat']['assault']): void {
  if (!raw) return;
  for (const key of ['timer', 'wave', 'wins', 'losses'] as const) {
    if (typeof raw[key] === 'number') target[key] = raw[key];
  }
}

export function saveToStorage(state: GameState): void {
  try {
    localStorage.setItem(STORAGE_KEY, serialize(state));
  } catch {
    // Storage full or unavailable — skip this save.
  }
}

export function loadFromStorage(now: number): GameState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? deserialize(raw, now) : null;
  } catch {
    return null;
  }
}

export function clearStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

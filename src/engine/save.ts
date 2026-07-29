import { D, Decimal } from './numbers';
import { createInitialState, SAVE_VERSION, type GameState } from './state';
import { RESOURCE_IDS, type ResourceId } from '../content/resources';
import { BUILDING_IDS } from '../content/buildings';
import { isFractionalResource, isToggleProducer, TOGGLE_PRODUCER_IDS } from '../content/producers';
import { SELLABLE_RESOURCES, WORKER_CONTRACT_IDS, MAX_COIN_EARNED } from '../content/market';
import { MAX_PRESTIGE } from '../content/prestige';

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
  // v3 → v4 (faithful coin-old port): resources, buildings, tiers, and combat
  // were overhauled, so old progression can't carry forward. Reset it, but keep
  // the raw base materials and the playtime/createdAt the player accumulated.
  3: (data) => {
    const resources = (data.resources as Record<string, unknown>) ?? {};
    return {
      version: 4,
      createdAt: data.createdAt,
      playtime: data.playtime,
      level: 1,
      resources: {
        wood: resources.wood,
        stone: resources.stone,
        food: resources.food,
      },
    };
  },
  // v4 → v5 (atomic production): resources now only tick at whole integers,
  // except the fractional handful (metals + coin). Floor any decimal amounts a
  // continuous-model save left behind so integer resources start clean.
  4: (data) => {
    const resources = data.resources as Record<string, { amount?: unknown }> | undefined;
    if (resources) {
      for (const id of Object.keys(resources)) {
        if (isFractionalResource(id as ResourceId)) continue;
        const a = resources[id]?.amount;
        if (typeof a === 'string' || typeof a === 'number') {
          resources[id]!.amount = D(a).floor().toString();
        }
      }
    }
    return { ...data, version: 5 };
  },
  // v5 → v6 (Market overhaul): the Bank and its coin producer are gone, so coin
  // is no longer minted or fractional. Floor any leftover fractional coin an old
  // save carried. The new `market` block falls back to fresh defaults in
  // deserialize; a pre-Market player simply starts the coin economy from zero.
  5: (data) => {
    const resources = data.resources as Record<string, { amount?: unknown }> | undefined;
    const coin = resources?.coin?.amount;
    if (resources?.coin && (typeof coin === 'string' || typeof coin === 'number')) {
      resources.coin.amount = D(coin).floor().toString();
    }
    return { ...data, version: 6 };
  },
  // v6 → v7 (early-game reboot): manual gathering tools (flags) removed; wood and
  // stone added as sellable resources; food purchase slots added. Missing market
  // fields fall back to fresh defaults in deserialize; flags are simply dropped.
  6: (data) => ({ ...data, version: 7 }),
  // v7 → v8: no schema change needed. This entry exists so the migration chain
  // doesn't dead-end here — `migrate` stops at the first missing step, so an
  // absent key would strand v7 saves and skip every migration after it.
  7: (data) => ({ ...data, version: 8 }),
  // v8 → v9 (one-and-done Market): sell tiers, the Worker Contract chain, and
  // repeat food purchases are gone. Every offer is now taken at most once, so
  // each old counter collapses to "was this taken at all?" — any progress on a
  // chain counts as having taken that offer, which never revokes something a
  // player already paid for.
  //
  // Coin is also rescaled: the old ceiling was 222,222 and the new one is 22, so
  // a carried-over balance would be meaningless and would render the header as
  // "111110/22 earned". Both the balance and the lifetime total are clamped to
  // the new ceiling. Nothing is lost in practice — purchases already made are
  // preserved by the flags above, and 22 coin buys everything still on offer.
  8: (data) => {
    const market = data.market as
      | {
          sellTier?: Record<string, unknown>;
          workerContract?: unknown;
          foodBought?: unknown;
          coinEarned?: unknown;
        }
      | undefined;

    const taken = (v: unknown): boolean => typeof v === 'number' && v > 0;
    const signed = typeof market?.workerContract === 'number' ? market.workerContract : 0;

    const next: Record<string, unknown> = {
      ...(market ?? {}),
      sold: Object.fromEntries(SELLABLE_RESOURCES.map((id) => [id, taken(market?.sellTier?.[id])])),
      contracts: Object.fromEntries(WORKER_CONTRACT_IDS.map((id, i) => [id, signed > i])),
      foodBought: taken(market?.foodBought),
    };
    delete next.sellTier;
    delete next.workerContract;

    const earned = next.coinEarned;
    if (typeof earned === 'string' || typeof earned === 'number') {
      next.coinEarned = Decimal.min(D(earned), MAX_COIN_EARNED).toString();
    }

    const resources = data.resources as Record<string, { amount?: unknown }> | undefined;
    const coin = resources?.coin?.amount;
    if (resources?.coin && (typeof coin === 'string' || typeof coin === 'number')) {
      resources.coin.amount = Decimal.min(D(coin), MAX_COIN_EARNED).toString();
    }

    return { ...data, version: 9, market: next };
  },
  // v9 → v10 (Prestige): a `prestige` block was added. Nothing to transform —
  // an existing player has simply never prestiged, and the missing field falls
  // back to `{ level: 0 }` in deserialize.
  9: (data) => ({ ...data, version: 10 }),
  // v10 → v11 (auto-replenish): defense/ward became on/off toggles instead of
  // worker-staffed lines. Hand any worker parked on them back to the pool; the
  // new `automation` block is absent and falls back to all-off in deserialize.
  10: (data) => {
    const workers = data.workers as { assigned?: Record<string, unknown> } | undefined;
    if (workers?.assigned) {
      for (const id of TOGGLE_PRODUCER_IDS) delete workers.assigned[id];
    }
    return { ...data, version: 11 };
  },
  // v11 → v12 (NEW badges): an `everStaffed` set was added. Nothing to
  // transform — the missing field falls back to empty in deserialize, so an
  // existing player's unlocked-but-never-staffed lines simply start out badged.
  11: (data) => ({ ...data, version: 12 }),
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
    automation: state.automation,
    everStaffed: state.everStaffed,
    buildings: state.buildings,
    combat: state.combat,
    market: {
      coinEarned: state.market.coinEarned.toString(),
      sold: state.market.sold,
      rateUnlocks: state.market.rateUnlocks,
      contracts: state.market.contracts,
      foodBought: state.market.foodBought,
    },
    prestige: state.prestige,
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
    { trained?: unknown; bonus?: unknown; assigned?: Record<string, unknown> } | undefined;
  if (workers) {
    if (typeof workers.trained === 'number') state.workers.trained = workers.trained;
    if (typeof workers.bonus === 'number') state.workers.bonus = workers.bonus;
    if (workers.assigned) {
      for (const id of RESOURCE_IDS) {
        // Toggle lines are never staffed; a stray count from an edited save
        // would otherwise lock workers out of the pool for good.
        if (isToggleProducer(id)) continue;
        const a = workers.assigned[id];
        if (typeof a === 'number') state.workers.assigned[id] = a;
      }
    }
  }

  const automation = data.automation as Record<string, unknown> | undefined;
  if (automation) {
    for (const id of TOGGLE_PRODUCER_IDS) {
      const on = automation[id];
      if (typeof on === 'boolean') state.automation[id] = on;
    }
  }

  // Only `true` is carried: an absent or falsy entry means never staffed, which
  // is exactly the fresh default.
  const everStaffed = data.everStaffed as Record<string, unknown> | undefined;
  if (everStaffed) {
    for (const id of RESOURCE_IDS) {
      if (everStaffed[id] === true) state.everStaffed[id] = true;
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
    { assault?: Record<string, unknown>; hex?: Record<string, unknown> } | undefined;
  if (combat) {
    reviveThreat(combat.assault, state.combat.assault);
    reviveThreat(combat.hex, state.combat.hex);
  }

  const market = data.market as
    | {
        coinEarned?: unknown;
        sold?: { wood?: unknown; stone?: unknown; arrow?: unknown; spear?: unknown };
        rateUnlocks?: { wood?: unknown; stone?: unknown; food?: unknown };
        contracts?: { i?: unknown; ii?: unknown; iii?: unknown };
        foodBought?: unknown;
      }
    | undefined;
  if (market) {
    const earned = market.coinEarned;
    if (typeof earned === 'string' || typeof earned === 'number') {
      state.market.coinEarned = D(earned);
    }
    for (const id of SELLABLE_RESOURCES) {
      if (typeof market.sold?.[id] === 'boolean') state.market.sold[id] = market.sold[id];
    }
    for (const id of ['wood', 'stone', 'food'] as const) {
      if (typeof market.rateUnlocks?.[id] === 'boolean')
        state.market.rateUnlocks[id] = market.rateUnlocks[id];
    }
    for (const id of WORKER_CONTRACT_IDS) {
      if (typeof market.contracts?.[id] === 'boolean')
        state.market.contracts[id] = market.contracts[id];
    }
    if (typeof market.foodBought === 'boolean') state.market.foodBought = market.foodBought;
  }

  // Clamped to the authored ladder: a save from a build with more tiers than
  // this one must not leave the level pointing past the end of PRESTIGE_TIERS.
  const prestige = data.prestige as { level?: unknown } | undefined;
  if (typeof prestige?.level === 'number') {
    state.prestige.level = Math.max(0, Math.min(Math.floor(prestige.level), MAX_PRESTIGE));
  }

  return state;
}

function reviveThreat(
  raw: Record<string, unknown> | undefined,
  target: GameState['combat']['assault'],
): void {
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

import { createInitialState, type GameState, type ResourceId, type BuildingId } from '../engine/state';
import { D, type Decimal } from '../engine/numbers';
import { tick } from '../engine/tick';
import { applyOffline, simulate, MAX_OFFLINE_SECONDS, type OfflineSummary } from '../engine/offline';
import {
  loadFromStorage,
  saveToStorage,
  clearStorage,
  serialize,
  deserialize,
} from '../engine/save';
import {
  assignWorker,
  trainWorker,
  forage,
  chopWood,
  mineStone,
  buyTool,
  sellResourceTier,
  buyRateUnlock,
  buyWorkerContract,
} from '../engine/actions';
import { RATE_UNLOCK_NUMERAL } from '../content/market';
import type { SellableResource, RateUnlockResource } from '../content/market';
import { RESOURCES } from '../content/resources';
import { buildBuilding } from '../systems/buildings';
import { upgradeSettlement } from '../systems/settlement';
import type { CombatEvent } from '../systems/combat';
import { BUILDINGS } from '../content/buildings';
import { getTier } from '../content/settlement';
import { notify } from './notify.svelte';
import { sound } from './sound.svelte';

/** Fixed simulation step in seconds (10 ticks/sec). */
const TICK_STEP = 0.1;
/**
 * A single frame gap larger than this (while the tab is visible) means the loop
 * was frozen — a long main-thread stall or a machine sleep with the tab
 * foregrounded. rAF can't fire during that, so no offline catch-up covers it;
 * we fast-forward the gap through `simulate` instead of feeding a huge burst
 * into the fixed-step accumulator.
 */
const MAX_LIVE_GAP_S = 5;
const AUTOSAVE_MS = 30_000;
/** Only greet the player if they were away at least this long. */
const WELCOME_THRESHOLD_S = 60;
/** How long a "+X" gain pop lives before it's dropped (matches the CSS float). */
const POP_MS = 1000;

/** A transient "+X gained" marker anchored to a resource row. */
export interface GainPop {
  seq: number;
  id: ResourceId;
  amount: number;
}

function createGameStore() {
  const bootNow = Date.now();
  const state = $state<GameState>(loadFromStorage(bootNow) ?? createInitialState(bootNow));
  let welcomeBack = $state<OfflineSummary | null>(null);
  let pops = $state<GainPop[]>([]);
  let popSeq = 0;

  let running = false;
  let rafId = 0;
  let lastFrame = 0;
  let accumulator = 0;
  let sinceSaveMs = 0;

  function persist(): void {
    state.lastTick = Date.now();
    saveToStorage(state);
  }

  function announceCombat(e: CombatEvent): void {
    if (e.kind === 'assault') {
      if (e.won) {
        notify.push(`Assault repelled — wave ${e.wave} cleared (+honor)`, 'good');
        sound.play.build();
      } else {
        notify.push(`Walls breached on wave ${e.wave} — you took casualties`, 'info');
      }
    } else {
      if (e.won) {
        notify.push(`Hex broken — trial ${e.wave} (+wisdom)`, 'good');
        sound.play.build();
      } else {
        notify.push(`A hex struck — wards consumed`, 'info');
      }
    }
  }

  /** Queue a floating "+X" marker for a resource; it self-removes after POP_MS. */
  function pushPop(id: ResourceId, amount: Decimal): void {
    const seq = ++popSeq;
    pops.push({ seq, id, amount: amount.toNumber() });
    setTimeout(() => {
      pops = pops.filter((p) => p.seq !== seq);
    }, POP_MS);
  }

  function frame(ts: number): void {
    if (!running) return;
    // Don't advance while hidden — offline catch-up (on return) owns that time.
    // Some browsers throttle rather than pause rAF; simulating here would let
    // that interval be counted twice (once now, once by applyOffline).
    if (document.hidden) {
      rafId = requestAnimationFrame(frame);
      return;
    }
    if (lastFrame === 0) lastFrame = ts;
    const dt = (ts - lastFrame) / 1000;
    lastFrame = ts;

    // A gap this large means the loop was frozen while visible (stall/sleep).
    // Fast-forward it as a bounded catch-up rather than dropping the time (the
    // old 1s clamp) or bursting the live loop with hundreds of fixed steps.
    if (dt > MAX_LIVE_GAP_S) {
      // Silent like offline catch-up — a long frozen gap could hold many combat
      // resolutions, and toasting each would flood the UI. State still updates.
      simulate(state, Math.min(dt, MAX_OFFLINE_SECONDS));
      accumulator = 0;
      sinceSaveMs += dt * 1000;
      if (sinceSaveMs >= AUTOSAVE_MS) {
        persist();
        sinceSaveMs = 0;
      }
      rafId = requestAnimationFrame(frame);
      return;
    }

    accumulator += dt;
    const events: CombatEvent[] = [];
    // Sum each resource's cycle completions across this frame's fixed steps into
    // one pop, so a frame that ran several ticks doesn't stack duplicate markers.
    const gains: Partial<Record<ResourceId, Decimal>> = {};
    const onGain = (id: ResourceId, amount: Decimal) => {
      gains[id] = (gains[id] ?? D(0)).plus(amount);
    };
    while (accumulator >= TICK_STEP) {
      events.push(...tick(state, TICK_STEP, { onGain }));
      accumulator -= TICK_STEP;
    }
    for (const e of events) announceCombat(e);
    for (const [id, amount] of Object.entries(gains) as [ResourceId, Decimal][]) {
      pushPop(id, amount);
    }

    sinceSaveMs += dt * 1000;
    if (sinceSaveMs >= AUTOSAVE_MS) {
      persist();
      sinceSaveMs = 0;
    }

    rafId = requestAnimationFrame(frame);
  }

  function onVisibility(): void {
    if (document.hidden) {
      persist();
    } else {
      // Silent catch-up for short tab-away gaps; the loop resumes fresh.
      applyOffline(state, Date.now());
      lastFrame = 0;
    }
  }

  function start(): void {
    if (running) return;
    const summary = applyOffline(state, Date.now());
    const c = summary.combat;
    const hadCombat =
      c.assaults.won + c.assaults.lost + c.hexes.won + c.hexes.lost > 0 || c.breached;
    if (
      summary.elapsedSeconds >= WELCOME_THRESHOLD_S &&
      (Object.keys(summary.gains).length > 0 || hadCombat)
    ) {
      welcomeBack = summary;
    }
    running = true;
    lastFrame = 0;
    accumulator = 0;
    sinceSaveMs = 0;
    rafId = requestAnimationFrame(frame);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', persist);
  }

  function stop(): void {
    if (!running) return;
    teardown();
    persist();
  }

  /**
   * Halt the loop and detach lifecycle listeners *without* persisting. Used
   * before an intentional reload (reset/import) so the `beforeunload` handler
   * can't write the current in-memory state back over what we just stored.
   */
  function teardown(): void {
    running = false;
    cancelAnimationFrame(rafId);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('beforeunload', persist);
  }

  return {
    get state() {
      return state;
    },
    get welcomeBack() {
      return welcomeBack;
    },
    get pops() {
      return pops;
    },
    dismissWelcome(): void {
      welcomeBack = null;
    },
    assign(id: ResourceId, delta: number): void {
      assignWorker(state, id, delta);
    },
    train(): void {
      if (trainWorker(state)) {
        notify.push('Worker trained', 'info');
        sound.play.train();
        persist();
      }
    },
    gather(kind: 'wood' | 'stone' | 'food'): void {
      const ok = kind === 'food' ? forage(state) : kind === 'wood' ? chopWood(state) : mineStone(state);
      if (ok) sound.play.build();
    },
    buyTool(tool: 'hatchet' | 'pickaxe'): void {
      if (buyTool(state, tool)) {
        notify.push(`You fashion a ${tool}.`, 'good');
        sound.play.build();
        persist();
      }
    },
    sell(id: SellableResource): void {
      if (sellResourceTier(state, id)) {
        notify.push(`You sell ${RESOURCES[id].name.toLowerCase()}s for coin.`, 'good');
        sound.play.build();
        persist();
      }
    },
    unlockRate(id: RateUnlockResource): void {
      if (buyRateUnlock(state, id)) {
        notify.push(`Rate Display ${RATE_UNLOCK_NUMERAL[id]} unlocked.`, 'good');
        sound.play.build();
        persist();
      }
    },
    buyWorkerContract(): void {
      if (buyWorkerContract(state)) {
        notify.push('Worker Contract signed — new workers join the pool.', 'good');
        sound.play.train();
        persist();
      }
    },
    build(id: BuildingId): void {
      const wasBuilt = state.buildings[id].level > 0;
      if (buildBuilding(state, id)) {
        notify.push(`${BUILDINGS[id].name} ${wasBuilt ? 'upgraded' : 'built'}`, 'good');
        sound.play.build();
        persist();
      }
    },
    upgradeSettlement(): void {
      if (upgradeSettlement(state)) {
        notify.push(`Reached ${getTier(state.level)?.name ?? `Level ${state.level}`}!`, 'level');
        sound.play.level();
        persist();
      }
    },
    exportSave(): string {
      return serialize(state);
    },
    importSave(raw: string): boolean {
      try {
        JSON.parse(raw); // reject non-JSON before touching storage
      } catch {
        return false;
      }
      saveToStorage(deserialize(raw, Date.now()));
      teardown();
      location.reload();
      return true;
    },
    reset(): void {
      clearStorage();
      teardown();
      location.reload();
    },
    start,
    stop,
  };
}

export const game = createGameStore();

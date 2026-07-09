import { createInitialState, type GameState, type ResourceId, type BuildingId } from '../engine/state';
import { tick } from '../engine/tick';
import { applyOffline, type OfflineSummary } from '../engine/offline';
import {
  loadFromStorage,
  saveToStorage,
  clearStorage,
  serialize,
  deserialize,
} from '../engine/save';
import { assignWorker, trainWorker } from '../engine/actions';
import { buildBuilding } from '../systems/buildings';
import { upgradeSettlement } from '../systems/settlement';
import type { CombatEvent } from '../systems/combat';
import { BUILDINGS } from '../content/buildings';
import { getTier } from '../content/settlement';
import { notify } from './notify.svelte';
import { sound } from './sound.svelte';

/** Fixed simulation step in seconds (10 ticks/sec). */
const TICK_STEP = 0.1;
const AUTOSAVE_MS = 30_000;
/** Only greet the player if they were away at least this long. */
const WELCOME_THRESHOLD_S = 60;

function createGameStore() {
  const bootNow = Date.now();
  const state = $state<GameState>(loadFromStorage(bootNow) ?? createInitialState(bootNow));
  let welcomeBack = $state<OfflineSummary | null>(null);

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

  function frame(ts: number): void {
    if (!running) return;
    if (lastFrame === 0) lastFrame = ts;
    let dt = (ts - lastFrame) / 1000;
    lastFrame = ts;
    // Clamp large frame gaps (background throttling); offline catch-up owns real absences.
    if (dt > 1) dt = 1;

    accumulator += dt;
    const events: CombatEvent[] = [];
    while (accumulator >= TICK_STEP) {
      events.push(...tick(state, TICK_STEP));
      accumulator -= TICK_STEP;
    }
    for (const e of events) announceCombat(e);

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
    if (summary.elapsedSeconds >= WELCOME_THRESHOLD_S && Object.keys(summary.gains).length > 0) {
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

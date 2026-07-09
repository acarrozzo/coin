/**
 * Tiny WebAudio blips — no assets, off by default. Safe to import anywhere:
 * the AudioContext is created lazily only when a sound actually plays, so this
 * never touches browser-only APIs at import time (e.g. in tests).
 */
const STORAGE_KEY = 'cc:sound';

function createSound() {
  let enabled = $state(false);
  let ctx: AudioContext | null = null;

  function load(): void {
    try {
      enabled = localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      // ignore
    }
  }

  function toggle(): void {
    enabled = !enabled;
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
    } catch {
      // ignore
    }
  }

  function context(): AudioContext | null {
    const AC =
      typeof window !== 'undefined'
        ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
        : undefined;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    return ctx;
  }

  function blip(freq: number, dur = 0.08, type: OscillatorType = 'sine'): void {
    if (!enabled) return;
    const c = context();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, c.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + dur);
  }

  const play = {
    build: () => blip(440, 0.1, 'triangle'),
    train: () => blip(660, 0.07, 'sine'),
    level: () => {
      blip(523, 0.12, 'triangle');
      setTimeout(() => blip(784, 0.16, 'triangle'), 90);
    },
  };

  return {
    get enabled() {
      return enabled;
    },
    load,
    toggle,
    play,
  };
}

export const sound = createSound();

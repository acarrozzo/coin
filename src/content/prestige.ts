/**
 * Prestige — starting over, as data.
 *
 * A prestige tears the settlement back down to the Wilderness and rebuilds from
 * nothing, but the followers you earned come with you: each tier sets the number
 * of **bonus** workers a fresh run begins with (21, then 42).
 *
 * Two deliberate shapes here, both mirroring the settlement tiers next door:
 *
 *   - `requires` is a **standing threshold**, never deducted — exactly like
 *     `SettlementTier.requires` (defense ≥ 5, honor ≥ 1). You must *hold* the
 *     honor / star metal to walk away; prestiging does not consume it.
 *   - `workers` is an **absolute** total, not an increment. It is written over
 *     `workers.bonus` rather than added to it, because the Market — including
 *     its three Worker Contracts (+6 bonus) — resets with everything else. If
 *     bonus accumulated, those contracts would compound every run.
 *
 * Honor and wisdom are the only resources that survive a prestige (see
 * systems/prestige.ts), which is what makes tier 1's honor threshold stay
 * satisfied on later runs.
 *
 * Adding a third tier is a data edit here and nothing else.
 */
import type { ResourceCost } from './settlement';

/** Prestige becomes available at this settlement level (when assaults begin). */
export const PRESTIGE_UNLOCK_LEVEL = 6;

export interface PrestigeTier {
  /** The prestige level this tier grants — 1-indexed, matching `prestige.level`. */
  n: number;
  name: string;
  /** Standing thresholds checked but never consumed. */
  requires: ResourceCost;
  /** Absolute `workers.bonus` a run started at this prestige begins with. */
  workers: number;
  blurb: string;
}

export const PRESTIGE_TIERS: PrestigeTier[] = [
  {
    n: 1,
    name: 'Honored Legacy',
    requires: { honor: 1 },
    workers: 21,
    blurb:
      'You lay the crown down with your name still intact. Twenty-one souls follow you back into the wilderness.',
  },
  {
    n: 2,
    name: 'Starbound Legacy',
    requires: { starmetal: 1 },
    workers: 42,
    blurb:
      'A shard of fallen sky lights the road out. Forty-two follow you this time — and they have heard the stories.',
  },
];

/** How many prestiges are currently authored. */
export const MAX_PRESTIGE = PRESTIGE_TIERS.length;

/** Prestige number → tier, built once. */
const TIERS_BY_N = new Map(PRESTIGE_TIERS.map((t) => [t.n, t]));

export function getPrestigeTier(n: number): PrestigeTier | undefined {
  return TIERS_BY_N.get(n);
}

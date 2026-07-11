/**
 * Combat content — the two escalating threat tracks, as data.
 *
 * Faithful to coin-old's structure — assaults are repelled by your **defense**
 * stat, hexes by your **ward** stat, both built up by dedicating workers (see
 * the defense/ward converters in producers.ts) and capped by the Castle /
 * Wizard Tower. The one change from the original: resolution is **deterministic**
 * instead of a dice roll.
 *
 *   attackPower = basePower * growth^wave
 *   defense ≥ attackPower  → repelled, +honor, wave escalates
 *   defense <  attackPower → you lose `lossAmount` defense (resources wiped if
 *                            it hits 0), and the attacker resets to wave 0.
 *
 * Because defense is capped by defenseMax (Castle tier), the wave eventually
 * outgrows your walls — you must upgrade the Castle to keep winning.
 */
import type { ResourceId } from './resources';

export interface ThreatConfig {
  /** Settlement level at which this threat begins. */
  unlockLevel: number;
  /** Seconds between attacks. */
  intervalSeconds: number;
  /** Attack power at wave 0. */
  basePower: number;
  /** Multiplier applied per cleared wave. */
  growth: number;
  /** The stat resource that defends against this threat. */
  defenseStat: ResourceId;
  /** The stat resource awarded per repelled attack. */
  reward: ResourceId;
  /** How much of the defense stat is lost on a failed defense. */
  lossAmount: number;
}

export const ASSAULT: ThreatConfig = {
  unlockLevel: 7,
  intervalSeconds: 100,
  basePower: 1,
  growth: 1.5,
  defenseStat: 'defense',
  reward: 'honor',
  lossAmount: 1,
};

export const HEX: ThreatConfig = {
  unlockLevel: 8,
  intervalSeconds: 3600,
  basePower: 1,
  growth: 1.5,
  defenseStat: 'ward',
  reward: 'wisdom',
  lossAmount: 1,
};

/** Core resources looted when a threat lands with no defense left. */
export const WIPE_ON_BREACH: ResourceId[] = ['wood', 'stone', 'food'];

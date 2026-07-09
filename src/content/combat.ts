/**
 * Combat content — the two escalating threat tracks, as data.
 *
 * Assaults test your standing army (units); hexes test your wards. Both are
 * deterministic power-vs-power: if your power meets the threat you win (and it
 * escalates); otherwise you take casualties and hold the same wave.
 */
import type { ResourceId } from './resources';

/** Units that make up the army, with their combat power each. */
export const UNIT_POWER: Partial<Record<ResourceId, number>> = {
  archer: 2,
  warrior: 4,
  mage: 8,
};

export const UNIT_IDS = Object.keys(UNIT_POWER) as ResourceId[];

/** Power each ward contributes against hexes. */
export const WARD_POWER = 5;

export interface ThreatConfig {
  /** Settlement level at which this threat begins. */
  unlockLevel: number;
  /** Seconds between attacks. */
  intervalSeconds: number;
  /** Threat power at wave 0. */
  basePower: number;
  /** Multiplier applied per cleared wave. */
  growth: number;
}

export const ASSAULT: ThreatConfig = {
  unlockLevel: 6,
  intervalSeconds: 45,
  basePower: 6,
  growth: 1.4,
};

export const HEX: ThreatConfig = {
  unlockLevel: 8,
  intervalSeconds: 120,
  basePower: 12,
  growth: 1.5,
};

/** Honor gained per assault repelled. */
export const HONOR_PER_WIN = 1;
/** Wisdom gained per hex broken. */
export const WISDOM_PER_WIN = 1;

/** Fraction of the army lost when an assault breaks through. */
export const ASSAULT_CASUALTY_RATE = 0.3;
/** Fraction of wards consumed when a hex lands. */
export const HEX_WARD_LOSS_RATE = 0.5;

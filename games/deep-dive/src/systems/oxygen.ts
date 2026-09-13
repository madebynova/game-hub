import { OXYGEN, PLAYER } from '../config';
import { clamp } from '../core/math';

/** Oxygen drained per second at world depth y (deeper = more pressure = faster drain). */
export function drainRate(y: number): number {
  const t = clamp(y / OXYGEN.depthForMaxDrain, 0, 1);
  return OXYGEN.baseDrain + OXYGEN.depthDrainBonus * t;
}

/**
 * Oxygen needed to swim straight up from depth y at full speed, with a small safety margin.
 * Drain grows linearly with depth, so the average over the ascent is the drain at y / 2.
 */
export function oxygenToSurface(y: number, speed = PLAYER.maxSpeed): number {
  if (y <= 0) return 0;
  const seconds = y / speed;
  return seconds * drainRate(y / 2) * 1.15;
}

export type OxygenStatus = 'ok' | 'low' | 'critical' | 'empty';

export function oxygenStatus(current: number, max: number, depth: number): OxygenStatus {
  if (current <= 0) return 'empty';
  const frac = current / max;
  if (frac <= OXYGEN.criticalFrac || (depth > 40 && current < oxygenToSurface(depth))) return 'critical';
  if (frac <= OXYGEN.lowFrac) return 'low';
  return 'ok';
}

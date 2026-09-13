import { OXYGEN, PLAYER } from '../config';

/** Oxygen drained per second at world depth y (deeper = more pressure = faster drain). */
export function drainRate(y: number): number {
  const curve = OXYGEN.pressureCurve;
  if (y <= curve[0][0]) return curve[0][1];
  for (let i = 1; i < curve.length; i++) {
    const [y1, d1] = curve[i];
    if (y <= y1) {
      const [y0, d0] = curve[i - 1];
      return d0 + ((y - y0) / (y1 - y0)) * (d1 - d0);
    }
  }
  return curve[curve.length - 1][1];
}

/** Oxygen needed to swim straight up from depth y at full speed, with a small safety margin. */
export function oxygenToSurface(y: number, speed = PLAYER.maxSpeed): number {
  if (y <= 0) return 0;
  const steps = 24;
  const dy = y / steps;
  let total = 0;
  for (let i = 0; i < steps; i++) total += drainRate((i + 0.5) * dy) * (dy / speed);
  return total * 1.15;
}

export type OxygenStatus = 'ok' | 'low' | 'critical' | 'empty';

export function oxygenStatus(current: number, max: number, depth: number, speed = PLAYER.maxSpeed): OxygenStatus {
  if (current <= 0) return 'empty';
  const frac = current / max;
  if (frac <= OXYGEN.criticalFrac || (depth > 40 && current < oxygenToSurface(depth, speed))) return 'critical';
  if (frac <= OXYGEN.lowFrac) return 'low';
  return 'ok';
}

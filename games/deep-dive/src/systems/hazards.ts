import { smoothstep } from '../core/math';
import type { AirPocketDef, CollapseDef, Rect } from '../world/wreck';
import { CURRENT_FEATHER, type Current } from '../world/world';

// ------------------------------------------------------------------ currents

/** 0..1 strength of a rect-shaped current at a point, softened near its edges. */
export function currentWeight(rect: Rect, x: number, y: number, feather = CURRENT_FEATHER) {
  const wx = smoothstep(rect.x0, rect.x0 + feather, x) * (1 - smoothstep(rect.x1 - feather, rect.x1, x));
  const wy = smoothstep(rect.y0, rect.y0 + feather, y) * (1 - smoothstep(rect.y1 - feather, rect.y1, y));
  return wx * wy;
}

export interface Flow {
  fx: number;
  fy: number;
  /** Strongest current weight at this point (0 = calm water). */
  strength: number;
  current: Current | null;
}

/** Combined current push at a point. `resist` (0..1, from fins) cancels part of it. */
export function flowAt(currents: Current[], x: number, y: number, resist = 0): Flow {
  let fx = 0;
  let fy = 0;
  let strength = 0;
  let current: Current | null = null;
  for (const c of currents) {
    const w = currentWeight(c.rect, x, y);
    if (w <= 0) continue;
    fx += c.fx * w;
    fy += c.fy * w;
    if (w > strength) {
      strength = w;
      current = c;
    }
  }
  const k = 1 - resist;
  return { fx: fx * k, fy: fy * k, strength, current };
}

// ------------------------------------------------------------------ collapsing wreckage

export const COLLAPSE_WARNING_SECONDS = 1.3;

export type CollapsePhase = 'stable' | 'warning' | 'fallen';

export interface CollapseState {
  def: CollapseDef;
  phase: CollapsePhase;
  /** Seconds since the warning began. */
  timer: number;
}

export type CollapseEvent = { type: 'warning'; state: CollapseState } | { type: 'impact'; state: CollapseState; hit: boolean };

const inRect = (r: Rect, x: number, y: number) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;

/** Oxygen knocked out of the regulator when caught under falling debris. */
export const collapsePenalty = (maxOxygen: number) => Math.round(10 + maxOxygen * 0.08);

/**
 * Unstable wreck sections: swim in and they groan for a moment, then come down.
 * Anyone still underneath loses air. Each section falls once per dive.
 */
export class CollapseSystem {
  states: CollapseState[];

  constructor(defs: CollapseDef[]) {
    this.states = defs.map((def) => ({ def, phase: 'stable', timer: 0 }));
  }

  reset() {
    for (const s of this.states) {
      s.phase = 'stable';
      s.timer = 0;
    }
  }

  update(dt: number, x: number, y: number): CollapseEvent[] {
    const events: CollapseEvent[] = [];
    for (const s of this.states) {
      if (s.phase === 'stable' && inRect(s.def.rect, x, y)) {
        s.phase = 'warning';
        s.timer = 0;
        events.push({ type: 'warning', state: s });
      } else if (s.phase === 'warning') {
        s.timer += dt;
        if (s.timer >= COLLAPSE_WARNING_SECONDS) {
          s.phase = 'fallen';
          events.push({ type: 'impact', state: s, hit: inRect(s.def.rect, x, y) });
        }
      }
    }
    return events;
  }
}

// ------------------------------------------------------------------ air pockets

export const AIR_POCKET_RATE = 15;

/** Trapped air and hydrothermal vents that top up the tank a limited amount per dive. */
export class AirPocketSystem {
  remaining = new Map<string, number>();

  constructor(private defs: AirPocketDef[]) {
    this.reset();
  }

  reset() {
    for (const d of this.defs) this.remaining.set(d.id, d.capacity);
  }

  pocketAt(x: number, y: number): AirPocketDef | null {
    return this.defs.find((d) => Math.hypot(x - d.x, y - d.y) < d.r + 12) ?? null;
  }

  /** Returns the oxygen gained this frame (0 if not in a pocket or it is spent / the tank is full). */
  update(dt: number, x: number, y: number, oxygen: number, maxOxygen: number): { gained: number; pocket: AirPocketDef | null } {
    const pocket = this.pocketAt(x, y);
    if (!pocket) return { gained: 0, pocket: null };
    const left = this.remaining.get(pocket.id) ?? 0;
    const gained = Math.max(0, Math.min(AIR_POCKET_RATE * dt, left, maxOxygen - oxygen));
    this.remaining.set(pocket.id, left - gained);
    return { gained, pocket };
  }

  fraction(id: string) {
    const d = this.defs.find((p) => p.id === id);
    return d ? (this.remaining.get(id) ?? 0) / d.capacity : 0;
  }
}

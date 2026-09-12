export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Frame-rate independent easing toward a target. */
export function damp(a: number, b: number, rate: number, step: number): number {
  return lerp(a, b, 1 - Math.exp(-rate * step));
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

export function distSq(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

export function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

export function chance(probability: number): boolean {
  return Math.random() < probability;
}

export function pick<T>(items: readonly T[]): T {
  const item = items[Math.floor(Math.random() * items.length)];
  if (item === undefined) throw new Error('pick() called with an empty array');
  return item;
}

/** Weighted pick. `weights` must be the same length as `items`. */
export function pickWeighted<T>(items: readonly T[], weights: readonly number[]): T {
  let total = 0;
  for (const w of weights) total += w;
  let roll = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i] ?? 0;
    if (roll <= 0) {
      const item = items[i];
      if (item !== undefined) return item;
    }
  }
  return pick(items);
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function pointInRect(x: number, y: number, r: Rect): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

/** Does the segment a->b cross the rectangle? Used for line-of-sight. */
export function segmentHitsRect(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  r: Rect,
): boolean {
  // Trivial accept: either endpoint inside.
  if (pointInRect(ax, ay, r) || pointInRect(bx, by, r)) return true;

  // Slab clip (Liang-Barsky) against the rect.
  const dx = bx - ax;
  const dy = by - ay;
  let t0 = 0;
  let t1 = 1;

  const clipTest = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0;
    const t = q / p;
    if (p < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
    return true;
  };

  return (
    clipTest(-dx, ax - r.x) &&
    clipTest(dx, r.x + r.w - ax) &&
    clipTest(-dy, ay - r.y) &&
    clipTest(dy, r.y + r.h - ay)
  );
}

/** Push a circle out of a rectangle along the shallowest axis. */
export function resolveCircleRect(pos: Vec2, radius: number, r: Rect): boolean {
  const nearestX = clamp(pos.x, r.x, r.x + r.w);
  const nearestY = clamp(pos.y, r.y, r.y + r.h);
  const dx = pos.x - nearestX;
  const dy = pos.y - nearestY;

  if (dx * dx + dy * dy > radius * radius) return false;

  if (dx === 0 && dy === 0) {
    // Dead centre: eject through the closest edge.
    const left = pos.x - r.x;
    const right = r.x + r.w - pos.x;
    const top = pos.y - r.y;
    const bottom = r.y + r.h - pos.y;
    const min = Math.min(left, right, top, bottom);
    if (min === left) pos.x = r.x - radius;
    else if (min === right) pos.x = r.x + r.w + radius;
    else if (min === top) pos.y = r.y - radius;
    else pos.y = r.y + r.h + radius;
    return true;
  }

  const length = Math.hypot(dx, dy) || 1;
  pos.x = nearestX + (dx / length) * radius;
  pos.y = nearestY + (dy / length) * radius;
  return true;
}

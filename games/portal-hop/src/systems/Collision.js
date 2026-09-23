export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/** Axis-aligned rectangle, top-left based. */
export function rect(x, y, w, h) {
  return { x, y, w, h };
}

export function aabbOverlaps(x, y, w, h, r) {
  return x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y;
}

/**
 * Moves an axis-aligned box by (dx, dy) and resolves overlaps against a
 * list of solid rectangles one axis at a time — the standard simple
 * platformer approach: move horizontally and depenetrate, then move
 * vertically and depenetrate. Good enough at our speeds/world scale;
 * no tunneling-proof sweep needed.
 *
 * @param center {{x:number,y:number}} box center
 * @param halfW half width, halfH half height
 * @returns {{x:number,y:number,onGround:boolean,hitCeiling:boolean,hitWall:boolean}}
 */
export function moveAndCollide(center, halfW, halfH, dx, dy, colliders) {
  let x = center.x;
  let y = center.y;
  let hitWall = false;
  let onGround = false;
  let hitCeiling = false;

  // Horizontal pass
  x += dx;
  for (const r of colliders) {
    if (aabbOverlaps(x - halfW, y - halfH, halfW * 2, halfH * 2, r)) {
      if (dx > 0) x = r.x - halfW;
      else if (dx < 0) x = r.x + r.w + halfW;
      hitWall = true;
    }
  }

  // Vertical pass
  y += dy;
  for (const r of colliders) {
    if (aabbOverlaps(x - halfW, y - halfH, halfW * 2, halfH * 2, r)) {
      if (dy > 0) {
        y = r.y - halfH;
        onGround = true;
      } else if (dy < 0) {
        y = r.y + r.h + halfH;
        hitCeiling = true;
      }
    }
  }

  return { x, y, onGround, hitCeiling, hitWall };
}

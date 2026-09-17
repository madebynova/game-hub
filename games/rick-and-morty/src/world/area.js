/**
 * Area model + helpers.
 *
 * An Area is a plain data object produced by a factory in data/areas/. It owns
 * its geometry, its props and (optionally) an update hook. The world manager
 * treats every area identically, which is what makes "add a dimension" a
 * data-sized job.
 *
 * Prop shape (all optional except id/x/y):
 *   id, x, y            anchor point — the prop's FEET / ground contact
 *   w, h                footprint used for solid collision (centred on x)
 *   solid               blocks the player
 *   sortY               override for depth sorting (defaults to y)
 *   radius              interaction radius (default 64)
 *   label               short name shown in the interaction hint
 *   hint                verb shown in the hint ("Examine", "Take", "Use")
 *   marker              show a floating marker until interacted with
 *   gone(state)         hide + disable the prop (e.g. item already collected)
 *   draw(ctx, t, ctxInfo)  paint it; origin is world coords
 *   onInteract(api)     what E does
 */

export function makeArea(def) {
  return {
    id: def.id,
    name: def.name,
    sub: def.sub ?? '',
    w: def.w,
    h: def.h,
    kind: def.kind ?? 'dimension',
    spawn: def.spawn ?? { x: def.w / 2, y: def.h / 2 },
    /** Where the player lands when arriving by portal (defaults to spawn). */
    portalArrival: def.portalArrival ?? def.spawn ?? { x: def.w / 2, y: def.h / 2 },
    bg: def.bg ?? '#0a0f14',
    colliders: def.colliders ?? [],
    props: def.props ?? [],
    paintStatic: def.paintStatic ?? (() => {}),
    paintOverlay: def.paintOverlay ?? null,
    update: def.update ?? null,
    ambience: def.ambience ?? null,
    /** Called once each time the player enters. Good for one-shot story beats. */
    onEnter: def.onEnter ?? null,
    onExit: def.onExit ?? null,
    /** Cached static background canvas, filled lazily by the renderer. */
    _staticCache: null,
  };
}

/** Convenience: a rectangle collider from a prop footprint. */
export function footprint(prop) {
  const w = prop.w ?? 0;
  const h = prop.h ?? 0;
  return { x: prop.x - w / 2, y: prop.y - h, w, h };
}

/**
 * Collision resolution. The player is an AABB; we resolve X and Y separately so
 * sliding along walls feels right instead of sticking.
 */
export function resolveMove(area, box, dx, dy) {
  const solids = collidersFor(area);
  let x = box.x, y = box.y;

  x += dx;
  for (const s of solids) {
    if (overlap({ x, y, w: box.w, h: box.h }, s)) {
      x = dx > 0 ? s.x - box.w : s.x + s.w;
    }
  }
  y += dy;
  for (const s of solids) {
    if (overlap({ x, y, w: box.w, h: box.h }, s)) {
      y = dy > 0 ? s.y - box.h : s.y + s.h;
    }
  }

  // Keep inside the area bounds.
  x = Math.max(0, Math.min(area.w - box.w, x));
  y = Math.max(0, Math.min(area.h - box.h, y));
  return { x, y };
}

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Static colliders plus the footprints of any currently-present solid props. */
export function collidersFor(area) {
  if (!area._collCache || area._collDirty) {
    area._collCache = [
      ...area.colliders,
      ...area.props.filter((p) => p.solid && !p._hidden).map(footprint),
    ];
    area._collDirty = false;
  }
  return area._collCache;
}

export function markCollidersDirty(area) { area._collDirty = true; }

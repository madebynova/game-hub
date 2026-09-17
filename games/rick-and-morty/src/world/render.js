/**
 * World renderer.
 *
 * Draw order per frame:
 *   1. cached static background (painted once per area into an offscreen canvas)
 *   2. props + player, depth-sorted by baseline Y
 *   3. area overlay (weather, light shafts, portal bloom)
 *   4. focus ring / marker decorations
 *
 * Caching the background is the single biggest performance win here: the
 * garage floor, tiles, wall clutter and shadows are all baked once instead of
 * re-drawn 60 times a second.
 */

import { LOGICAL_W, LOGICAL_H } from '../core/loop.js';
import { drawFocusRing, drawMarker, PAL } from './draw.js';

export class Camera {
  constructor() { this.x = 0; this.y = 0; }

  /** Follow a point, clamped to area bounds, with a little smoothing. */
  follow(tx, ty, area, dt, snap = false) {
    const halfW = LOGICAL_W / 2;
    const halfH = LOGICAL_H / 2;
    let gx = tx - halfW;
    let gy = ty - halfH - 20; // bias up a touch so the player isn't dead-centre
    gx = area.w <= LOGICAL_W ? (area.w - LOGICAL_W) / 2 : Math.max(0, Math.min(area.w - LOGICAL_W, gx));
    gy = area.h <= LOGICAL_H ? (area.h - LOGICAL_H) / 2 : Math.max(0, Math.min(area.h - LOGICAL_H, gy));
    if (snap) { this.x = gx; this.y = gy; return; }
    const k = Math.min(1, 6 * dt);
    this.x += (gx - this.x) * k;
    this.y += (gy - this.y) * k;
  }
}

/** Build (or rebuild) the cached static layer for an area. */
function ensureStatic(area) {
  if (area._staticCache) return area._staticCache;
  const c = document.createElement('canvas');
  c.width = area.w;
  c.height = area.h;
  const cx = c.getContext('2d');
  cx.fillStyle = area.bg;
  cx.fillRect(0, 0, area.w, area.h);
  area.paintStatic(cx, area);
  area._staticCache = c;
  return c;
}

export function invalidateStatic(area) { area._staticCache = null; }

export class WorldRenderer {
  constructor() {
    this.camera = new Camera();
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} scene { area, player, t, focus, dt }
   */
  render(ctx, scene) {
    const { area, player, t, focus } = scene;
    const cam = this.camera;

    ctx.save();
    ctx.fillStyle = area.bg;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    ctx.translate(-Math.round(cam.x), -Math.round(cam.y));

    // 1. static layer (only the visible slice is blitted)
    const bg = ensureStatic(area);
    const sx = Math.max(0, Math.floor(cam.x));
    const sy = Math.max(0, Math.floor(cam.y));
    const sw = Math.min(area.w - sx, LOGICAL_W);
    const sh = Math.min(area.h - sy, LOGICAL_H);
    if (sw > 0 && sh > 0) ctx.drawImage(bg, sx, sy, sw, sh, sx, sy, sw, sh);

    // 2. depth-sorted actors
    const drawables = [];
    for (const p of area.props) {
      if (p._hidden || !p.draw) continue;
      // Cull anything comfortably off-screen.
      const px = p.x, py = p.y;
      if (px < cam.x - 220 || px > cam.x + LOGICAL_W + 220) continue;
      if (py < cam.y - 300 || py > cam.y + LOGICAL_H + 300) continue;
      drawables.push({ y: p.sortY ?? p.y, kind: 'prop', ref: p });
    }
    drawables.push({ y: player.pos.y, kind: 'player', ref: player });
    drawables.sort((a, b) => a.y - b.y);

    for (const d of drawables) {
      if (d.kind === 'player') {
        d.ref.draw(ctx);
      } else {
        ctx.save();
        try { d.ref.draw(ctx, t, { focused: focus === d.ref }); }
        catch (err) { console.error(`[render] prop ${d.ref.id} draw failed`, err); }
        ctx.restore();
      }
    }

    // 3. markers + focus ring
    for (const p of area.props) {
      if (p._hidden) continue;
      if (p.marker && !p._markerDone) {
        drawMarker(ctx, p.x, p.y - (p.markerHeight ?? 46), t, p.markerColor ?? PAL.warn);
      }
    }
    if (focus) {
      drawFocusRing(ctx, focus.x, focus.y + 2, (focus.focusRadius ?? Math.max(22, (focus.w ?? 40) * 0.62)), t,
        focus.focusColor ?? PAL.portal);
    }

    // 4. overlay
    if (area.paintOverlay) {
      try { area.paintOverlay(ctx, t, { cam, area }); }
      catch (err) { console.error('[render] overlay failed', err); }
    }

    ctx.restore();
  }
}

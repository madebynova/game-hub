function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Converts world-space (meters) to screen-space (pixels) and follows a
 * target, clamped so the view never shows past a zone's bounds. If a
 * zone is smaller than the viewport on an axis, the camera just centers
 * on the room for that axis instead of jittering at the clamp limits.
 *
 * Keeping this separate from drawing code means bigger future zones
 * (real dimensions) get camera-follow for free — nothing else needs to
 * change.
 */
export class Camera2D {
  constructor({ pixelsPerUnit = 48 } = {}) {
    this.scale = pixelsPerUnit;
    this.x = 0;
    this.y = 0;
  }

  /** @param target {{x:number,y:number}} @param bounds {{minX,maxX,minY,maxY}} */
  update(target, bounds, viewportCssWidth, viewportCssHeight) {
    const halfViewW = viewportCssWidth / this.scale / 2;
    const halfViewH = viewportCssHeight / this.scale / 2;
    const roomHalfW = (bounds.maxX - bounds.minX) / 2;
    const roomHalfH = (bounds.maxY - bounds.minY) / 2;
    const roomCenterX = (bounds.minX + bounds.maxX) / 2;
    const roomCenterY = (bounds.minY + bounds.maxY) / 2;

    this.x =
      halfViewW >= roomHalfW ? roomCenterX : clamp(target.x, bounds.minX + halfViewW, bounds.maxX - halfViewW);
    this.y =
      halfViewH >= roomHalfH ? roomCenterY : clamp(target.y, bounds.minY + halfViewH, bounds.maxY - halfViewH);
  }

  /** Sets the canvas transform so subsequent draws can use plain world-unit coordinates. */
  applyTransform(ctx, canvasPixelWidth, canvasPixelHeight, devicePixelRatio = 1) {
    const s = this.scale * devicePixelRatio;
    ctx.setTransform(s, 0, 0, s, canvasPixelWidth / 2 - this.x * s, canvasPixelHeight / 2 - this.y * s);
  }
}

/**
 * Owns the canvas: keeps the backing store matched to the CSS size and the
 * device pixel ratio, so drawing code can work in plain CSS pixels and still
 * look sharp on a retina/scaled display.
 */

export class Stage {
  readonly ctx: CanvasRenderingContext2D;

  /** Logical size in CSS pixels — what game code should use. */
  width = 0;
  height = 0;
  /** Backing-store scale currently applied to the context. */
  dpr = 1;

  private observer: ResizeObserver | undefined;

  constructor(readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is unavailable in this browser.');
    this.ctx = ctx;
    this.resize();
  }

  /** Re-measure on layout changes and on DPR changes (moving between monitors). */
  watch(): void {
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(this.canvas);
    window.addEventListener('resize', this.resize);
  }

  dispose(): void {
    this.observer?.disconnect();
    window.removeEventListener('resize', this.resize);
  }

  readonly resize = (): void => {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.dpr = dpr;
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));

    this.width = width;
    this.height = height;

    const backingWidth = Math.round(width * dpr);
    const backingHeight = Math.round(height * dpr);
    if (this.canvas.width !== backingWidth || this.canvas.height !== backingHeight) {
      this.canvas.width = backingWidth;
      this.canvas.height = backingHeight;
    }
    // Reset, then scale, so repeated resizes don't compound the transform.
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
}

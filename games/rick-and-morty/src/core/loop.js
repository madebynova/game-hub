/**
 * Game loop + canvas presentation.
 *
 * Fixed logical resolution (960x540) letterboxed into the window. Drawing to a
 * small fixed buffer and letting the browser scale it is by far the cheapest
 * way to stay smooth on weak integrated GPUs, and it means every coordinate in
 * the game is resolution-independent.
 */

export const LOGICAL_W = 960;
export const LOGICAL_H = 540;

export class Loop {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {(dt: number, now: number) => void} update  dt in seconds
   * @param {(ctx: CanvasRenderingContext2D, alpha: number) => void} render
   */
  constructor(canvas, update, render) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.update = update;
    this.render = render;
    this.running = false;
    this._last = 0;
    this._raf = 0;
    /** Rolling FPS estimate, handy for debugging on slow machines. */
    this.fps = 60;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /** Letterbox the fixed-resolution canvas into the viewport via CSS size. */
  resize() {
    const pad = 0;
    const availW = window.innerWidth - pad;
    const availH = window.innerHeight - pad;
    const scale = Math.min(availW / LOGICAL_W, availH / LOGICAL_H);
    this.canvas.style.width = `${Math.floor(LOGICAL_W * scale)}px`;
    this.canvas.style.height = `${Math.floor(LOGICAL_H * scale)}px`;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._last = performance.now();
    const step = (now) => {
      if (!this.running) return;
      // Clamp dt so an alt-tab or a GC pause doesn't teleport the player through
      // a wall. 0.1s (10fps) is the floor: generous enough that game time still
      // tracks real time on weak hardware, tight enough that the player moves
      // at most ~15px per step, which is smaller than every collider we place.
      const dt = Math.min((now - this._last) / 1000, 0.1);
      this._last = now;
      this.fps += ((1 / Math.max(dt, 0.0001)) - this.fps) * 0.05;
      this.update(dt, now);
      this.render(this.ctx, now);
      this._raf = requestAnimationFrame(step);
    };
    this._raf = requestAnimationFrame(step);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this._raf);
  }
}

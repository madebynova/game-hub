/**
 * Fixed-timestep game loop with interpolated rendering.
 *
 * Simulation runs at a constant STEP so physics and collisions behave the same
 * on a 60Hz laptop and a 144Hz monitor; rendering runs once per frame and gets
 * `alpha` (0..1) to interpolate between the previous and current state.
 */

export type UpdateFn = (step: number) => void;
export type RenderFn = (alpha: number) => void;

/** Seconds per simulation step (60Hz). */
export const STEP = 1 / 60;

/** Never simulate more than this much wall time in one frame (tab-switch guard). */
const MAX_FRAME = 0.25;

export class GameLoop {
  private rafId = 0;
  private previous = 0;
  private accumulator = 0;
  private running = false;

  constructor(
    private readonly update: UpdateFn,
    private readonly render: RenderFn,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.previous = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  /** Resume after a pause without simulating the time spent paused. */
  resync(): void {
    this.previous = performance.now();
    this.accumulator = 0;
  }

  private readonly tick = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.tick);

    const elapsed = Math.min((now - this.previous) / 1000, MAX_FRAME);
    this.previous = now;
    this.accumulator += elapsed;

    while (this.accumulator >= STEP) {
      this.update(STEP);
      this.accumulator -= STEP;
    }

    this.render(this.accumulator / STEP);
  };
}

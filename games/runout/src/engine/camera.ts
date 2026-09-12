import { clamp, damp } from './math';
import type { Stage } from './stage';

/** World height the camera tries to keep on screen, so both rows of houses fit. */
const TARGET_VIEW_HEIGHT = 1520;
const MIN_ZOOM = 0.42;
const MAX_ZOOM = 0.8;

/** Follows a target with smoothing and never shows the void past the world edge. */
export class Camera {
  x = 0;
  y = 0;
  zoom = 1;
  shake = 0;

  private shakeX = 0;
  private shakeY = 0;

  constructor(
    private readonly worldWidth: number,
    private readonly worldHeight: number,
  ) {}

  /** Visible world size at the current zoom. */
  viewWidth(stage: Stage): number {
    return stage.width / this.zoom;
  }

  viewHeight(stage: Stage): number {
    return stage.height / this.zoom;
  }

  snapTo(targetX: number, targetY: number, stage: Stage): void {
    this.updateZoom(stage);
    this.x = targetX;
    this.y = targetY;
    this.clampToWorld(stage);
  }

  follow(targetX: number, targetY: number, stage: Stage, step: number): void {
    this.updateZoom(stage);
    this.x = damp(this.x, targetX, 7, step);
    this.y = damp(this.y, targetY, 7, step);
    this.clampToWorld(stage);

    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - step * 2.4);
      const amount = this.shake * this.shake * 26;
      this.shakeX = (Math.random() * 2 - 1) * amount;
      this.shakeY = (Math.random() * 2 - 1) * amount;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  /** 0..1; stacks up to a cap so a burst of hits doesn't nauseate. */
  addShake(amount: number): void {
    this.shake = Math.min(1, this.shake + amount);
  }

  /** Transform the context so world coordinates draw in the right place. */
  apply(stage: Stage): void {
    const { ctx } = stage;
    ctx.translate(stage.width / 2, stage.height / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x + this.shakeX, -this.y + this.shakeY);
  }

  worldToScreenX(worldX: number, stage: Stage): number {
    return (worldX - this.x + this.shakeX) * this.zoom + stage.width / 2;
  }

  worldToScreenY(worldY: number, stage: Stage): number {
    return (worldY - this.y + this.shakeY) * this.zoom + stage.height / 2;
  }

  /**
   * Zoom out far enough to see both rows of houses and the road between them —
   * picking which door to ring is the core decision, and you cannot make it on
   * a street you cannot see.
   */
  private updateZoom(stage: Stage): void {
    this.zoom = clamp(stage.height / TARGET_VIEW_HEIGHT, MIN_ZOOM, MAX_ZOOM);
  }

  private clampToWorld(stage: Stage): void {
    const halfW = this.viewWidth(stage) / 2;
    const halfH = this.viewHeight(stage) / 2;
    // When the viewport is wider than the world, centre rather than clamp.
    this.x = halfW * 2 >= this.worldWidth ? this.worldWidth / 2 : clamp(this.x, halfW, this.worldWidth - halfW);
    this.y = halfH * 2 >= this.worldHeight ? this.worldHeight / 2 : clamp(this.y, halfH, this.worldHeight - halfH);
  }
}

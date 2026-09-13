import { BOAT, PLAYER, WORLD } from '../config';
import { clamp, closestOnSegment, damp } from '../core/math';
import type { World } from '../world/world';

export type PlayerMode = 'deck' | 'airborne' | 'swim';

/** Diver center height when standing upright on the deck. */
const DECK_STAND_Y = BOAT.deckY - 33;

export class Player {
  x = BOAT.x;
  y = DECK_STAND_Y;
  vx = 0;
  vy = 0;
  facing: 1 | -1 = 1;
  angle = -Math.PI / 2;
  mode: PlayerMode = 'deck';
  /** Animation clock for flipper kicks / walking. */
  anim = 0;
  kickStrength = 0;

  get atSurface() {
    return this.mode === 'swim' && this.y <= WORLD.waterY + 2;
  }

  get depth() {
    return Math.max(0, this.y - WORLD.waterY);
  }

  placeOnDeck(x = BOAT.x + 20) {
    this.mode = 'deck';
    this.x = x;
    this.y = DECK_STAND_Y;
    this.angle = -Math.PI / 2;
    this.vx = this.vy = 0;
    this.facing = 1;
  }

  jumpIn() {
    this.mode = 'airborne';
    this.vx = this.facing * 150;
    this.vy = -300;
  }

  /** Walk along the deck. Returns true if the diver stepped off the edge into the water. */
  updateDeck(dt: number, ax: number): boolean {
    if (ax) this.facing = ax > 0 ? 1 : -1;
    this.vx = damp(this.vx, ax * PLAYER.walkSpeed, 14, dt);
    this.x += this.vx * dt;
    this.x = Math.max(BOAT.deckLeft + 20, this.x); // bow rail blocks the left side
    this.anim += Math.abs(this.vx) * dt * 0.05;
    this.angle = damp(this.angle, -Math.PI / 2, 10, dt);
    if (this.x > BOAT.deckRight) {
      this.mode = 'airborne';
      this.vy = -140;
      return true;
    }
    return false;
  }

  /** Falling from the deck. Returns true on the frame the diver hits the water. */
  updateAirborne(dt: number): boolean {
    this.vy += PLAYER.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.angle = damp(this.angle, this.facing > 0 ? 0.9 : Math.PI - 0.9, 5, dt);
    if (this.y > WORLD.waterY + 10) {
      this.mode = 'swim';
      this.vy *= 0.35;
      this.vx *= 0.5;
      return true;
    }
    return false;
  }

  /**
   * @param speedMul fins bonus (and slowdown when out of air)
   * @param flowX,flowY current push in world units per second, applied on top of swimming
   */
  updateSwim(dt: number, ax: number, ay: number, world: World, speedMul = 1, flowX = 0, flowY = 0) {
    const len = Math.hypot(ax, ay) || 1;
    const ix = ax / len;
    const iy = ay / len;
    if (ax) this.facing = ax > 0 ? 1 : -1;

    const surfaceMul = this.atSurface ? PLAYER.surfaceSpeedMul : 1;
    const max = PLAYER.maxSpeed * speedMul * surfaceMul;
    this.vx += ix * PLAYER.accel * speedMul * dt;
    this.vy += iy * PLAYER.accel * speedMul * dt;
    const drag = Math.exp(-PLAYER.drag * dt);
    this.vx *= drag;
    this.vy *= drag;
    // Gentle neutral-buoyancy bob when idle.
    if (!ax && !ay) this.vy += Math.sin(this.anim * 0.7) * 6 * dt;
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > max) {
      this.vx *= max / speed;
      this.vy *= max / speed;
    }

    // Sub-step so fast movement (plus currents) never tunnels into terrain or wreck walls.
    const moveX = this.vx + flowX;
    const moveY = this.vy + flowY;
    const steps = Math.max(1, Math.ceil((Math.hypot(moveX, moveY) * dt) / (PLAYER.radius * 0.5)));
    for (let s = 0; s < steps; s++) {
      this.x += (moveX * dt) / steps;
      this.y += (moveY * dt) / steps;
      this.collide(world);
    }

    const moving = ax !== 0 || ay !== 0;
    this.kickStrength = damp(this.kickStrength, moving ? 1 : 0.25, 6, dt);
    this.anim += dt * (2 + this.kickStrength * 8);

    // Orient the body along the swim direction; drift towards upright when idle.
    let target: number;
    if (this.atSurface && !(ay > 0)) {
      target = this.facing > 0 ? -1.15 : Math.PI + 1.15;
    } else if (speed > 40 && moving) {
      target = Math.atan2(this.vy, this.vx);
    } else {
      target = this.facing > 0 ? -0.55 : Math.PI + 0.55;
    }
    let delta = target - this.angle;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    this.angle += delta * (1 - Math.exp(-7 * dt));
  }

  private pushOut(nx: number, ny: number, depth: number) {
    this.x += nx * depth;
    this.y += ny * depth;
    const vn = this.vx * nx + this.vy * ny;
    if (vn < 0) {
      this.vx -= vn * nx;
      this.vy -= vn * ny;
    }
  }

  private collide(world: World) {
    const r = PLAYER.radius;
    // Water surface: the diver floats with their head above water.
    if (this.y < WORLD.waterY) {
      this.y = WORLD.waterY;
      if (this.vy < 0) this.vy = 0;
    }
    // Invisible cliff walls at the map edges.
    const minX = WORLD.wallMargin;
    const maxX = WORLD.width - WORLD.wallMargin;
    if (this.x < minX) { this.x = minX; this.vx = Math.max(0, this.vx); }
    if (this.x > maxX) { this.x = maxX; this.vx = Math.min(0, this.vx); }

    // Seafloor polyline: push out along the nearest segment's normal.
    const step = world.floorStep;
    const i0 = Math.floor((this.x - r * 3) / step);
    const i1 = Math.ceil((this.x + r * 3) / step);
    for (let i = i0; i < i1; i++) {
      const ax = i * step;
      const ay = world.floorSample(i);
      const bx = (i + 1) * step;
      const by = world.floorSample(i + 1);
      const sx = bx - ax;
      const sy = by - ay;
      const t = clamp(((this.x - ax) * sx + (this.y - ay) * sy) / (sx * sx + sy * sy), 0, 1);
      const dx = this.x - (ax + sx * t);
      const dy = this.y - (ay + sy * t);
      const d = Math.hypot(dx, dy);
      const above = dx * sy - dy * sx >= 0; // cross product sign: player is on the water side
      if (d < r && above && d > 0.0001) this.pushOut(dx / d, dy / d, r - d);
    }
    // Safety net if somehow below the floor.
    const fy = world.floorY(this.x);
    if (this.y > fy - r * 0.5) {
      this.y = fy - r * 0.5;
      this.vy = Math.min(0, this.vy);
    }

    for (const rock of world.rocks) {
      const dx = this.x - rock.x;
      const dy = this.y - rock.y;
      const min = rock.r * 0.9 + r;
      const d2 = dx * dx + dy * dy;
      if (d2 < min * min) {
        const d = Math.sqrt(d2) || 1;
        this.pushOut(dx / d, dy / d, min - d);
      }
    }

    // Wreck hull, decks and bulkheads.
    for (const w of world.walls) {
      const { cx, cy, d } = closestOnSegment(this.x, this.y, w.ax, w.ay, w.bx, w.by);
      const min = w.half + r;
      if (d < min && d > 0.0001) this.pushOut((this.x - cx) / d, (this.y - cy) / d, min - d);
    }
    if (this.y < WORLD.waterY) this.y = WORLD.waterY;
  }
}

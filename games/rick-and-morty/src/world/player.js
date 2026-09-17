/**
 * The player avatar.
 *
 * Position lives in game state (so it saves); this class owns the transient
 * bits — velocity smoothing, walk animation phase, facing.
 */

import { resolveMove } from './area.js';
import { drawPlayer } from './draw.js';

const SPEED = 148;        // px/sec
const SPRINT = 1.55;
const ACCEL = 14;         // higher = snappier
const BOX = { w: 18, h: 12 }; // feet-level collision box (small = walk "behind" things)

export class Player {
  constructor(state) {
    this.state = state;
    this.vx = 0;
    this.vy = 0;
    this.walkPhase = 0;
    this.moving = false;
    this.canMove = true;
  }

  get pos() { return this.state.data.player; }

  setPosition(x, y) {
    this.pos.x = x;
    this.pos.y = y;
    this.vx = this.vy = 0;
  }

  /** @param {{x:number,y:number}} dir normalised input vector */
  update(dt, dir, area, sprinting = false) {
    const target = this.canMove ? SPEED * (sprinting ? SPRINT : 1) : 0;
    const tx = dir.x * target;
    const ty = dir.y * target;
    const k = Math.min(1, ACCEL * dt);
    this.vx += (tx - this.vx) * k;
    this.vy += (ty - this.vy) * k;

    if (Math.abs(this.vx) < 1) this.vx = 0;
    if (Math.abs(this.vy) < 1) this.vy = 0;

    this.moving = Math.abs(this.vx) + Math.abs(this.vy) > 8;
    this.walkPhase += dt * (this.moving ? 7.5 : 1.2);

    if (dir.x < -0.2) this.pos.facing = 'left';
    else if (dir.x > 0.2) this.pos.facing = 'right';
    else if (dir.y < -0.2) this.pos.facing = 'up';
    else if (dir.y > 0.2) this.pos.facing = 'down';

    if (!this.moving) return;

    // Collision box sits at the player's feet.
    const box = { x: this.pos.x - BOX.w / 2, y: this.pos.y - BOX.h, w: BOX.w, h: BOX.h };
    const next = resolveMove(area, box, this.vx * dt, this.vy * dt);
    this.pos.x = next.x + BOX.w / 2;
    this.pos.y = next.y + BOX.h;
  }

  draw(ctx) {
    drawPlayer(ctx, this.pos.x, this.pos.y, this.pos.facing, this.walkPhase, this.moving);
  }
}

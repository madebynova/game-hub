import { moveAndCollide } from "../systems/Collision.js";

export const PLAYER_HALF_WIDTH = 0.3;
export const PLAYER_HALF_HEIGHT = 0.55;

const MOVE_SPEED = 5.2;
const GROUND_ACCEL = 12; // higher = snappier stops/starts
const AIR_ACCEL = 6;
const GRAVITY = 24;
const JUMP_SPEED = 9.4;
const MAX_FALL_SPEED = 16;

/**
 * Side-view platformer player: an AABB body with horizontal velocity,
 * gravity, and a jump impulse. Movement is keyboard-only (A/D + W or
 * Space) — nothing here reads the mouse. S is reserved for a future
 * crouch/drop-down and currently does nothing.
 */
export class Player {
  constructor() {
    this.position = { x: 0, y: 0 };
    this.velocity = { x: 0, y: 0 };
    this.halfWidth = PLAYER_HALF_WIDTH;
    this.halfHeight = PLAYER_HALF_HEIGHT;
    this.onGround = false;
    this.facingDir = 1; // 1 = right, -1 = left
  }

  teleportTo(position) {
    this.position.x = position.x;
    this.position.y = position.y;
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.onGround = false;
  }

  /** @param zone needs .clampToBounds() and .colliders */
  update(delta, input, zone) {
    const horizontal = input.getHorizontal();
    if (horizontal !== 0) this.facingDir = horizontal;

    const accel = this.onGround ? GROUND_ACCEL : AIR_ACCEL;
    const damp = Math.exp(-accel * delta);
    this.velocity.x *= damp;
    if (horizontal !== 0) {
      this.velocity.x += horizontal * MOVE_SPEED * delta * accel;
    }

    if (input.wasJumpPressed() && this.onGround) {
      this.velocity.y = -JUMP_SPEED;
      this.onGround = false;
    }

    this.velocity.y = Math.min(this.velocity.y + GRAVITY * delta, MAX_FALL_SPEED);

    const result = moveAndCollide(
      this.position,
      this.halfWidth,
      this.halfHeight,
      this.velocity.x * delta,
      this.velocity.y * delta,
      zone.colliders,
    );

    this.position.x = result.x;
    this.position.y = result.y;
    if (result.hitWall) this.velocity.x = 0;
    if (result.onGround || result.hitCeiling) this.velocity.y = 0;

    const clamped = zone.clampToBounds(this.position.x, this.position.y, this.halfWidth, this.halfHeight);
    this.position.x = clamped.x;
    this.position.y = clamped.y;
    if (clamped.hitWall) this.velocity.x = 0;
    if (clamped.hitFloor || clamped.hitCeiling) this.velocity.y = 0;

    this.onGround = result.onGround || clamped.hitFloor;
  }

  draw(ctx) {
    const { x, y } = this.position;
    const hw = this.halfWidth;
    const hh = this.halfHeight;

    ctx.save();

    // ground shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.ellipse(x, y + hh + 0.04, hw * 1.1, hw * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(x, y);
    ctx.scale(this.facingDir, 1);

    // legs
    ctx.fillStyle = "#5a3d1f";
    ctx.fillRect(-hw * 0.55, hh * 0.25, hw * 0.4, hh * 0.75);
    ctx.fillRect(hw * 0.15, hh * 0.25, hw * 0.4, hh * 0.75);

    // body
    const bodyGrad = ctx.createLinearGradient(0, -hh, 0, hh * 0.3);
    bodyGrad.addColorStop(0, "#ffe28a");
    bodyGrad.addColorStop(1, "#d98a2b");
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.roundRect(-hw, -hh * 0.7, hw * 2, hh * 1.1, hw * 0.5);
    ctx.fill();
    ctx.lineWidth = 0.03;
    ctx.strokeStyle = "#7a4a15";
    ctx.stroke();

    // head
    ctx.beginPath();
    ctx.arc(0, -hh * 0.9, hw * 0.85, 0, Math.PI * 2);
    ctx.fillStyle = "#ffe9b0";
    ctx.fill();
    ctx.stroke();

    // facing indicator (a little "visor" dot toward the front)
    ctx.beginPath();
    ctx.arc(hw * 0.45, -hh * 0.9, hw * 0.16, 0, Math.PI * 2);
    ctx.fillStyle = "#3a2a10";
    ctx.fill();

    ctx.restore();
  }
}

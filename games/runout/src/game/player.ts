import type { Input } from '../engine/input';
import type { Rect, Vec2 } from '../engine/math';
import { clamp, damp, resolveCircleRect } from '../engine/math';
import { PLAYER, VAULT, WORLD } from './config';
import type { Loadout } from './upgrades';

export class Player {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  stamina: number;
  sprinting = false;
  /** Radians; drives which way the little figure looks. */
  facing = -Math.PI / 2;
  /** Distance travelled, used to time footstep sounds. */
  stepPhase = 0;
  decoys: number;
  /** Set for one frame when second wind kicks in, so Run can react to it. */
  caughtSecondWind = false;
  /** Hedges this player is allowed to climb. Empty without HOPPERS. */
  climbRects: readonly Rect[] = [];
  /** True while nobody is hunting, so endurance upgrades can pay off. */
  resting = false;
  /** Set for one frame when a hedge is vaulted. */
  justVaulted = false;

  private vaultRecovery = 0;
  private onHedge = false;

  private regenCooldown = 0;
  private secondWindSpent = false;

  constructor(private readonly loadout: Loadout) {
    this.stamina = loadout.staminaMax;
    this.decoys = loadout.decoys;
  }

  get radius(): number {
    return PLAYER.radius;
  }

  get maxStamina(): number {
    return this.loadout.staminaMax;
  }

  get speed(): number {
    return Math.hypot(this.vx, this.vy);
  }

  get exhausted(): boolean {
    return this.stamina < PLAYER.sprintFloor;
  }

  placeAt(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
  }

  /** Called when a chase ends, so the next one gets its own second wind. */
  rearmSecondWind(): void {
    this.secondWindSpent = false;
  }

  update(input: Input, obstacles: readonly Rect[], step: number, frozen: boolean): void {
    this.caughtSecondWind = false;
    this.justVaulted = false;
    this.vaultRecovery = Math.max(0, this.vaultRecovery - step);
    let dx = 0;
    let dy = 0;

    if (!frozen) {
      if (input.isDown('KeyA', 'ArrowLeft')) dx -= 1;
      if (input.isDown('KeyD', 'ArrowRight')) dx += 1;
      if (input.isDown('KeyW', 'ArrowUp')) dy -= 1;
      if (input.isDown('KeyS', 'ArrowDown')) dy += 1;
    }

    const moving = dx !== 0 || dy !== 0;
    if (moving) {
      const length = Math.hypot(dx, dy);
      dx /= length;
      dy /= length;
      this.facing = Math.atan2(dy, dx);
    }

    const wantsSprint = !frozen && input.isDown('ShiftLeft', 'ShiftRight') && moving;
    // You cannot kick off a sprint on an empty tank, but you can finish one.
    this.sprinting = wantsSprint && this.stamina > (this.sprinting ? 0 : PLAYER.sprintFloor);

    if (this.sprinting) {
      this.stamina = Math.max(0, this.stamina - this.loadout.sprintDrain * step);
      this.regenCooldown = PLAYER.regenDelay;

      // Second wind: run the tank dry once in a chase and you get a chunk back,
      // which is what lets you commit to a long escape instead of having to
      // break line of sight before the stamina bar does it for you.
      if (this.stamina <= 0 && !this.secondWindSpent && this.loadout.secondWind > 0) {
        this.secondWindSpent = true;
        this.stamina = this.loadout.staminaMax * this.loadout.secondWind;
        this.caughtSecondWind = true;
      }
    } else {
      this.regenCooldown = Math.max(0, this.regenCooldown - step);
      if (this.regenCooldown <= 0) {
        const rate = this.loadout.staminaRegen * (this.resting ? this.loadout.restRegen : 1);
        this.stamina = Math.min(this.loadout.staminaMax, this.stamina + rate * step);
      }
    }

    // Clambering over a hedge costs a real chunk of the tank and a beat of
    // speed, so gardens are a route you choose rather than a free escape.
    const climbing = this.vaultRecovery > 0;
    const target =
      (this.sprinting ? this.loadout.sprintSpeed : this.loadout.walkSpeed) * (climbing ? VAULT.slowTo : 1);
    this.vx = damp(this.vx, dx * target, PLAYER.accel, step);
    this.vy = damp(this.vy, dy * target, PLAYER.accel, step);

    this.x += this.vx * step;
    this.y += this.vy * step;

    const pos: Vec2 = { x: this.x, y: this.y };
    for (const rect of obstacles) {
      if (
        pos.x + PLAYER.radius > rect.x &&
        pos.x - PLAYER.radius < rect.x + rect.w &&
        pos.y + PLAYER.radius > rect.y &&
        pos.y - PLAYER.radius < rect.y + rect.h
      ) {
        resolveCircleRect(pos, PLAYER.radius, rect);
      }
    }
    this.x = clamp(pos.x, PLAYER.radius, WORLD.width - PLAYER.radius);
    this.y = clamp(pos.y, PLAYER.radius, WORLD.height - PLAYER.radius);

    const overHedge = this.climbRects.some(
      (rect) =>
        this.x + PLAYER.radius > rect.x &&
        this.x - PLAYER.radius < rect.x + rect.w &&
        this.y + PLAYER.radius > rect.y &&
        this.y - PLAYER.radius < rect.y + rect.h,
    );
    if (overHedge && !this.onHedge) {
      this.justVaulted = true;
      this.stamina = Math.max(0, this.stamina - VAULT.staminaCost);
      this.vaultRecovery = VAULT.recovery;
    }
    this.onHedge = overHedge;

    this.stepPhase += this.speed * step;
  }
}

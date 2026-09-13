// Central tuning values. Tweak these to change game feel without touching systems.

export const WORLD = {
  width: 4200,
  /** y of the water surface. Everything with y > 0 is underwater. */
  waterY: 0,
  bottom: 3200,
  wallMargin: 150,
};

/** World units per displayed meter of depth. */
export const PX_PER_METER = 16;

export const PLAYER = {
  radius: 16,
  accel: 1150,
  maxSpeed: 215,
  surfaceSpeedMul: 0.85,
  drag: 2.8,
  walkSpeed: 190,
  gravity: 1300,
  interactRadius: 52,
};

export const OXYGEN = {
  /** Oxygen units drained per second at the surface level. */
  baseDrain: 1,
  /** Extra drain per second at `depthForMaxDrain` (pressure). */
  depthDrainBonus: 0.8,
  depthForMaxDrain: 3000,
  refillRate: 45,
  lowFrac: 0.35,
  criticalFrac: 0.15,
  /** Seconds of "last breath" after the tank hits zero before blacking out. */
  graceSeconds: 4,
};

export const BOAT = {
  x: 700,
  deckY: -36,
  deckLeft: 560,
  deckRight: 860,
  /** Horizontal range (at the surface) where the diver can climb aboard. */
  boardLeft: 520,
  boardRight: 900,
};

export const DEPTH_ZONES = {
  reef: 820,
  abyss: 1500,
};

export const SAVE_KEY = 'deepdive.save.v1';

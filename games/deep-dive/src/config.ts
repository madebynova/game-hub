// Central tuning values. Tweak these to change game feel without touching systems.

export const WORLD = {
  width: 5600,
  /** y of the water surface. Everything with y > 0 is underwater. */
  waterY: 0,
  bottom: 4400,
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
  /**
   * Pressure curve: [depth in world units, oxygen drained per second].
   * Gentle on the reef, noticeably heavier at the wreck, punishing in the abyss.
   */
  pressureCurve: [[0, 1], [1150, 1.25], [2100, 1.7], [3000, 2.3], [4000, 3]] as [number, number][],
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

/** Depth (world units) where each zone's depth band begins. */
export const DEPTH_ZONES = {
  wreck: 1150,
  abyss: 2100,
};

export const SAVE_KEY = 'deepdive.save.v1';

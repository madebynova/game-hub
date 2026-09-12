/**
 * Every tuning number in RUNOUT lives here.
 *
 * The game is a risk dial: how fast you move, how fast they react, how much a
 * house pays, how badly Heat punishes greed. Keeping it in one file means the
 * feel can be tuned without hunting through systems.
 */

export const WORLD = {
  width: 3800,
  height: 1700,
  roadTop: 760,
  roadBottom: 940,
  sidewalk: 40,
  lotWidth: 460,
  lotMargin: 60,
  topLotY: 140,
  bottomLotY: 980,
  lotHeight: 580,
} as const;

export const PLAYER = {
  radius: 15,
  walkSpeed: 195,
  sprintSpeed: 335,
  accel: 14,
  staminaMax: 100,
  /**
   * A full tank is about five and a half seconds of sprint. That has to be long
   * enough to outlast a dog (5.2s of patience), because sprinting is the only
   * answer to something faster than you. At the old 26/s a sprint lasted 3.8s
   * and every chase over four seconds was unwinnable whatever the player did.
   */
  sprintDrain: 18,
  staminaRegen: 17,
  regenDelay: 0.55,
  /** Below this you cannot start a sprint — stops stutter-sprinting on empty. */
  sprintFloor: 8,
} as const;

export interface HeatTier {
  at: number;
  name: string;
  color: string;
}

/**
 * Going over a hedge. The cost is charged per hop rather than per second,
 * because hedges are thin — a per-second cost made vaulting effectively free
 * and turned HOPPERS into an escape-everything button.
 */
export const VAULT = {
  staminaCost: 20,
  /** Seconds of clambering before you are back up to speed. */
  recovery: 0.4,
  slowTo: 0.45,
};

export const RUN = {
  /** Seconds of night. When it hits zero the neighbourhood wakes up fast. */
  nightLength: 300,
  dawnHeatPerSecond: 3.2,
  /**
   * Must comfortably clear the van's own collision box (86px half-width) plus
   * the player radius, or walking up to the van along the road shoves you back
   * outside your own extraction zone.
   */
  extractRadius: 150,
  /** How close you must be when the door opens for the reaction to be worth anything. */
  witnessRadius: 430,
  /** A chaser this close at any point during the escape pays a bonus. */
  closeCallRadius: 78,
  closeCallBonus: 0.5,
  grabRadius: 25,
  /** Grace after spawning/extracting so you can never be grabbed on frame one. */
  spawnGrace: 1.2,
  /** How often a scent breadcrumb is dropped, and how many are kept. */
  trailInterval: 0.3,
  trailLength: 14,
};

export const HEAT = {
  max: 100,
  /**
   * Heat only cools while nobody is actively after you, and it cools slowly.
   * It used to bleed off at 2.1/s, which refunded a RISKY house in nine seconds
   * of standing still — Heat could never accumulate and "I've been here too
   * long" was unreachable. Cooling is now a breather, not a reset.
   */
  decayPerSecond: 0.7,
  decayDelay: 3.5,
  /**
   * Half the Heat from every ring is permanent for the rest of the night: the
   * street remembers. This floor is the ratchet that eventually forces you out.
   */
  floorShare: 0.6,
  floorMax: 86,
  tiers: [
    { at: 0, name: 'CALM', color: '#5eead4' },
    { at: 26, name: 'ACTIVE', color: '#fbbf24' },
    { at: 52, name: 'HIGH', color: '#fb923c' },
    { at: 78, name: 'CRITICAL', color: '#f87171' },
  ] as HeatTier[],
  /** Reaction delays shrink and chasers speed up as this climbs. */
  reactionSpeedUpAt100: 0.5,
  chaserSpeedBonusAt100: 0.14,
  patrolThresholds: [46, 72, 90],
  /**
   * Above this the street is lit up enough that darkness stops hiding you.
   * Losing your best escape tool is what makes CRITICAL frightening, rather
   * than simply making every number bigger.
   */
  exposureFrom: 58,
  /** Events come faster the hotter it gets. */
  eventRushAt100: 0.5,
};

/**
 * The gap between the bell and the door opening — the most important second in
 * the game. These are fractions of the fuse at which the player hears somebody
 * coming, so the wait is a readable countdown instead of a blank pause.
 */
export const RING = {
  cueFootsteps: 0.5,
  cueLock: 0.82,
  /** Radius of the shrinking "fuse" ring drawn at the door. */
  fuseRadius: 62,
};

/**
 * Sprinting is loud. It is your escape tool and it is also the thing that tells
 * a searching chaser exactly where you went — which is the decision that makes
 * breaking line of sight interesting rather than automatic.
 */
export const NOISE = {
  /**
   * Deliberately short. Hearing is meant to punish sprinting *past* someone who
   * is hunting for you, not to tail you across the whole street — at 300px it
   * cancelled line-of-sight breaks outright, since escaping means sprinting.
   */
  sprintRadius: 185,
  walkRadius: 70,
};

export type HouseTierName = 'EASY' | 'ALERT' | 'RISKY' | 'VALUABLE';

export interface HouseTier {
  name: HouseTierName;
  color: string;
  /** Payout range for a clean escape. */
  reward: [number, number];
  heat: number;
  /** Seconds between the doorbell and the door flying open. */
  reactionDelay: number;
  weight: number;
  blurb: string;
}

export const HOUSE_TIERS: Record<HouseTierName, HouseTier> = {
  EASY: {
    name: 'EASY',
    color: '#4ade80',
    reward: [60, 105],
    heat: 7,
    reactionDelay: 1.5,
    weight: 38,
    blurb: 'slow to answer',
  },
  ALERT: {
    name: 'ALERT',
    color: '#fbbf24',
    reward: [135, 205],
    heat: 12,
    reactionDelay: 1.05,
    weight: 34,
    blurb: 'someone is awake',
  },
  RISKY: {
    name: 'RISKY',
    color: '#fb923c',
    reward: [245, 365],
    heat: 19,
    reactionDelay: 0.9,
    weight: 21,
    blurb: 'they are waiting for this',
  },
  VALUABLE: {
    name: 'VALUABLE',
    color: '#c084fc',
    reward: [520, 780],
    heat: 27,
    reactionDelay: 0.68,
    weight: 7,
    blurb: 'the one worth filming',
  },
};

export type ChaserKind = 'RESIDENT' | 'ANGRY' | 'DOG' | 'WATCH' | 'SECURITY';

/**
 * How a chaser closes the distance. This is what makes each one demand a
 * different escape instead of being the same person with different numbers.
 */
export type ChaserTactic =
  | 'DIRECT' // Runs at where you are. Outrun it or break sight.
  | 'SCENT' // Follows your trail; breaking line of sight does not shake it.
  | 'INTERCEPT'; // Aims where you are going, so running in a straight line fails.

export interface ChaserSpec {
  kind: ChaserKind;
  label: string;
  tactic: ChaserTactic;
  /**
   * Seconds of flat-out sprint before they tire, and what their speed drops to
   * afterwards. This is what makes something faster than you survivable: it
   * closes hard, then you start pulling away if you keep running.
   */
  burstSeconds: number;
  tiredSpeed: number;
  /** How far ahead of you an INTERCEPT chaser aims, in seconds. */
  lead: number;
  /** How far a searcher fans out from the last known position. */
  searchSpread: number;
  /**
   * How sharply they can change direction, as a velocity damping rate. The
   * player's is 14 (PLAYER.accel). Anything lower turns wider than you do, so
   * corners cost them ground — which is what makes the neighbourhood's geometry
   * an escape tool instead of scenery. Chasers used to set velocity directly,
   * meaning they pivoted instantly while the player carried momentum: the
   * pursuer was more agile than the pursued, and cutting a corner only ever
   * cost the runner speed.
   */
  agility: number;
  speed: number;
  sight: number;
  /** Seconds of pursuit before they run out of steam. */
  patience: number;
  /** Gives up if you get this far away. */
  giveUpDistance: number;
  searchTime: number;
  radius: number;
  color: string;
}

export const CHASERS: Record<ChaserKind, ChaserSpec> = {
  // Slower than your sprint: outrunnable, if you have the stamina.
  RESIDENT: {
    kind: 'RESIDENT',
    agility: 10,
    burstSeconds: 0,
    tiredSpeed: 1,
    tactic: 'DIRECT',
    lead: 0,
    searchSpread: 120,
    label: 'CONFUSED RESIDENT',
    speed: 248,
    sight: 420,
    patience: 8.5,
    giveUpDistance: 720,
    searchTime: 2.4,
    radius: 15,
    color: '#f0abfc',
  },
  ANGRY: {
    kind: 'ANGRY',
    agility: 9,
    burstSeconds: 0,
    tiredSpeed: 1,
    tactic: 'DIRECT',
    lead: 0,
    searchSpread: 140,
    label: 'FURIOUS HOMEOWNER',
    speed: 288,
    sight: 520,
    /**
     * Was 11.5, which outlasted the player's entire 5.5s stamina bar — the only
     * possible answer was to loop them, which is what made every chase feel like
     * forced juking. Still clearly more dogged than the EASY resident's 8.5, so
     * ALERT stays a step up from EASY.
     */
    patience: 10,
    giveUpDistance: 820,
    searchTime: 3,
    radius: 16,
    color: '#fb7185',
  },
  // Faster than you. You cannot outrun a dog — you have to break its line of sight.
  DOG: {
    kind: 'DOG',
    agility: 5.5,
    burstSeconds: 1.9,
    tiredSpeed: 0.8,
    tactic: 'SCENT',
    lead: 0,
    searchSpread: 70,
    label: 'VERY FAST DOG',
    speed: 366,
    sight: 470,
    patience: 4.3,
    giveUpDistance: 640,
    searchTime: 1.8,
    radius: 12,
    color: '#fcd34d',
  },
  WATCH: {
    kind: 'WATCH',
    agility: 8,
    burstSeconds: 0,
    tiredSpeed: 1,
    tactic: 'INTERCEPT',
    lead: 0.55,
    searchSpread: 180,
    label: 'NEIGHBOURHOOD WATCH',
    speed: 262,
    sight: 560,
    patience: 16,
    giveUpDistance: 980,
    searchTime: 4,
    radius: 16,
    // Hi-vis vest green. Was cyan, which read as the same colour as the player's
    // sky blue in a chase — you could lose track of which dot was you.
    color: '#a3e635',
  },
  SECURITY: {
    kind: 'SECURITY',
    agility: 7.5,
    burstSeconds: 0,
    tiredSpeed: 1,
    tactic: 'INTERCEPT',
    lead: 0.6,
    searchSpread: 210,
    label: 'PRIVATE SECURITY',
    speed: 296,
    sight: 620,
    patience: 18,
    giveUpDistance: 1050,
    searchTime: 4.5,
    radius: 17,
    color: '#a5b4fc',
  },
};

/**
 * Once someone has given up they stop colliding with the world and walk home
 * through it, fading as they go. They were getting pinned on hedges and house
 * corners on the way back and standing there until the despawn timer fired.
 * Nothing about a chaser who has quit is gameplay any more, so solid geometry
 * on them is all cost and no benefit — the fade is what keeps it from reading
 * as clipping through a wall.
 */
export const GIVE_UP = {
  fadeSeconds: 2.2,
  /** Backstop, now that the walk home can't be blocked. */
  maxReturnSeconds: 8,
};

/**
 * Steering behaviour. A chaser re-picking its detour every frame alternated
 * between the left and right whisker and travelled nowhere, so a chosen detour
 * is committed to for a moment; and when it is genuinely boxed in it commits to
 * a sidestep along the obstruction instead of leaning into it.
 */
export const STEERING = {
  probe: 76,
  /** Shortest probe, so a target right in front still has its obstacles checked. */
  minProbe: 46,
  /** Clearance added around obstacles when probing. Too much seals real gaps. */
  clearance: 3,
  /** How long a chosen detour is kept before reconsidering. */
  commit: 0.35,
  /** Moving under this fraction of intent counts as grinding. */
  progressThreshold: 0.4,
  /** Grinding for this long triggers a committed sidestep. */
  stuckAfter: 0.4,
  sidestepSeconds: 0.55,
  /**
   * Failing to make progress for this long means the target itself is
   * unreachable — a scent point inside a house, or a last-known position behind
   * a wall. Sidestepping cannot solve that; the target has to be given up on.
   */
  abandonAfter: 1.1,
};

/**
 * Coming out of a door and having a look round before the chase proper starts.
 *
 * Patience is meant to measure how long someone will pursue you, but it was
 * also being burned during this initial look — at up to 3.9x while searching.
 * A dog only has 4.3s of it, so roughly one second of not immediately seeing
 * you was enough to send it home: measured, 12 out of 12 kennel dogs gave up
 * without ever entering a chase. Patience now holds still until they either
 * lay eyes on you or this runs out.
 */
export const ACQUIRE_GRACE = 2.6;

/**
 * Patrol pressure.
 *
 * Patrols used to arrive purely on the event timer — the watch-patrol event is
 * roughly a fifth of every event roll above Heat 40, and nothing checked whether
 * one was already out or whether the player had just shaken one off. Escaping
 * therefore bought nothing: another turned up within the minute. Breaking line
 * of sight is supposed to be a win, so a patrol leaving now buys real quiet.
 */
export const PATROL = {
  /** Most roaming patrols out at once. */
  maxOnStreet: 1,
  /** ...and at CRITICAL Heat, when the street should feel busier. */
  maxAtCriticalHeat: 2,
  /** Quiet window after one gives up and leaves. */
  cooldownAfterLeaving: 30,
};

export const DECOY = {
  /**
   * Seconds a firecracker holds attention. This is the counter to chasers whose
   * patience you cannot outlast — security and patrols — rather than to dogs,
   * which give up on their own. Decisive, but you only carry a few.
   */
  lure: 3.9,
  radius: 450,
  fuse: 0.65,
  cooldown: 1.2,
} as const;

/** Being in the dark shortens how far anyone can see you. */
export const LIGHT = {
  darkSightMultiplier: 0.55,
  streetLampRadius: 240,
  porchRadius: 170,
  /** VALUABLE houses floodlight their approach: no sneaking up on those. */
  floodlightRadius: 330,
} as const;

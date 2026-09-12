import type { Rect, Vec2 } from '../engine/math';
import { dist, resolveCircleRect, segmentHitsRect } from '../engine/math';
import { CHASERS, GIVE_UP, LIGHT, STEERING, type ChaserKind, type ChaserSpec } from './config';

export type ChaserState =
  | 'CHASE' // Has eyes on you.
  | 'SEARCH' // Lost you; heading for where you were last seen.
  | 'LURED' // Distracted by a firecracker.
  | 'RETURN'; // Given up, walking home.

export interface Chaser {
  spec: ChaserSpec;
  x: number;
  y: number;
  vx: number;
  vy: number;
  state: ChaserState;
  /** Seconds of pursuit left before they run out of steam. */
  patience: number;
  searchTimer: number;
  lureTimer: number;
  lastSeenX: number;
  lastSeenY: number;
  homeX: number;
  homeY: number;
  /** Which house sent them out. null for roaming patrols. */
  houseId: number | null;
  /**
   * Set the moment they give up. One person gets one chase per night — once
   * they've quit on you they will not start a second one, however close you get.
   */
  spent: boolean;
  /** True once they have actually laid eyes on you and given chase. */
  hasChased: boolean;
  /** Patrols walk the street until they've had their one chase, then leave. */
  roams: boolean;
  /** Marks a chase that got genuinely close — pays a bonus on escape. */
  closeCall: boolean;
  /** True once they are home and ready to be removed. */
  done: boolean;
  /**
   * Seconds spent registering what just happened before the chase starts. Gives
   * the player the beat that makes ring-and-run readable instead of a coin flip.
   */
  startle: number;
  noiseTimer: number;
  facing: number;
  /** Counts down after they hear you; drives the "?!" marker. */
  heardTimer: number;
  /** Which way this one fans out when searching, so a group covers ground. */
  searchAngle: number;
  /** 1 while active, falling to 0 as they walk off after giving up. */
  fade: number;
  /** How long this chase has been going, for chasers that tire. */
  chaseTime: number;
  /** Detour side currently committed to, and how long that commitment lasts. */
  steerBias: number;
  steerHold: number;
  /** Seconds spent going nowhere, and the sidestep committed to to break out. */
  stuckTimer: number;
  /** Suppresses scent tracking briefly after a trail point proved unreachable. */
  ignoreTrailUntil: number;
  sidestep: number;
  sidestepTimer: number;
  /** Seconds spent walking home, so a blocked route can't strand them. */
  returnTimer: number;
}

export function spawnChaser(
  kind: ChaserKind,
  x: number,
  y: number,
  houseId: number | null,
  options: { startle?: number; roams?: boolean } = {},
): Chaser {
  const spec = CHASERS[kind];
  return {
    spec,
    x,
    y,
    vx: 0,
    vy: 0,
    state: 'SEARCH',
    patience: spec.patience,
    searchTimer: spec.searchTime,
    lureTimer: 0,
    lastSeenX: x,
    lastSeenY: y,
    homeX: x,
    homeY: y,
    houseId,
    spent: false,
    hasChased: false,
    roams: options.roams ?? false,
    closeCall: false,
    done: false,
    startle: options.startle ?? 0,
    noiseTimer: 0,
    facing: 0,
    heardTimer: 0,
    searchAngle: Math.random() * Math.PI * 2,
    fade: 1,
    chaseTime: 0,
    steerBias: 0,
    steerHold: 0,
    stuckTimer: 0,
    ignoreTrailUntil: 0,
    sidestep: 0,
    sidestepTimer: 0,
    returnTimer: 0,
  };
}

export interface ChaseContext {
  player: Vec2;
  /** Standing in lamplight makes you far easier to spot. */
  playerLit: boolean;
  obstacles: readonly Rect[];
  blockers: readonly Rect[];
  /** The stretch of street roaming patrols walk up and down. */
  street: { minX: number; maxX: number; minY: number; maxY: number };
  /** How far the player's footsteps are carrying right now. 0 when standing still. */
  noiseRadius: number;
  /** Which way the player is moving, for chasers that aim ahead of you. */
  playerVx: number;
  playerVy: number;
  /**
   * Recent player positions, newest last. Dogs follow this rather than the last
   * place they saw you, which is why you cannot shake one behind a hedge.
   */
  trail: readonly Vec2[];
  speedBonus: number;
  /** Weather and similar effects scale everyone's sight range. */
  sightMultiplier: number;
  step: number;
  /** Set when the player is safe (extracting, run over) so nobody keeps hunting. */
  playerHidden: boolean;
}

/** Can this chaser see the player right now? */
export function canSee(chaser: Chaser, ctx: ChaseContext): boolean {
  if (ctx.playerHidden) return false;

  const d = dist(chaser.x, chaser.y, ctx.player.x, ctx.player.y);
  let sight = chaser.spec.sight * ctx.sightMultiplier;
  if (!ctx.playerLit) sight *= LIGHT.darkSightMultiplier;
  // Standing right next to someone defeats any amount of darkness.
  if (d > Math.max(sight, 130)) return false;

  return hasLineOfSight(chaser.x, chaser.y, ctx.player.x, ctx.player.y, ctx.blockers);
}

export function hasLineOfSight(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  blockers: readonly Rect[],
): boolean {
  const minX = Math.min(ax, bx);
  const maxX = Math.max(ax, bx);
  const minY = Math.min(ay, by);
  const maxY = Math.max(ay, by);

  for (const rect of blockers) {
    // Cheap reject before the segment maths.
    if (rect.x > maxX || rect.x + rect.w < minX || rect.y > maxY || rect.y + rect.h < minY) continue;
    if (segmentHitsRect(ax, ay, bx, by, rect)) return false;
  }
  return true;
}

export function updateChaser(chaser: Chaser, ctx: ChaseContext): void {
  const { step } = ctx;

  if (chaser.startle > 0) {
    // Frozen in the doorway, working out what just happened.
    chaser.startle -= step;
    chaser.vx = 0;
    chaser.vy = 0;
    chaser.lastSeenX = ctx.player.x;
    chaser.lastSeenY = ctx.player.y;
    return;
  }

  // Someone heading home has given up for good. Letting them re-acquire on sight
  // makes escape impossible whenever you are still in view when their patience
  // runs out — and lets one person chase you over and over all night.
  const canReacquire = !chaser.spent && chaser.state !== 'LURED' && chaser.state !== 'RETURN';
  const sees = canReacquire && canSee(chaser, ctx);

  if (chaser.lureTimer > 0) {
    chaser.lureTimer -= step;
    if (chaser.lureTimer <= 0 && chaser.state === 'LURED') {
      chaser.state = 'SEARCH';
      chaser.searchTimer = chaser.spec.searchTime;
    }
  }

  if (sees) {
    if (chaser.state !== 'CHASE') chaser.chaseTime = 0;
    chaser.state = 'CHASE';
    chaser.hasChased = true;
    chaser.chaseTime += step;
    chaser.lastSeenX = ctx.player.x;
    chaser.lastSeenY = ctx.player.y;
    chaser.patience -= step;
    if (dist(chaser.x, chaser.y, ctx.player.x, ctx.player.y) > chaser.spec.giveUpDistance) {
      // Too far to bother, even in plain sight.
      chaser.patience -= step * 2.5;
    }
  } else if (chaser.state === 'CHASE') {
    chaser.state = 'SEARCH';
    chaser.searchTimer = chaser.spec.searchTime;
  }

  // Hearing is not seeing: it hands a searcher a fresh position to walk to, but
  // never restarts the chase on its own. Sprinting past someone hunting for you
  // is the loud option — which is what makes breaking line of sight a decision.
  if (!sees && chaser.state === 'SEARCH' && ctx.noiseRadius > 0) {
    if (dist(chaser.x, chaser.y, ctx.player.x, ctx.player.y) < ctx.noiseRadius) {
      // A new place to look — but their patience keeps draining. Hearing you
      // must never be able to extend a search indefinitely.
      chaser.lastSeenX = ctx.player.x;
      chaser.lastSeenY = ctx.player.y;
      chaser.heardTimer = 0.6;
    }
  }
  if (chaser.heardTimer > 0) chaser.heardTimer -= step;
  if (chaser.ignoreTrailUntil > 0) chaser.ignoreTrailUntil -= step;

  let quitting = false;

  if (chaser.state === 'SEARCH') {
    chaser.searchTimer -= step;
    chaser.patience -= step * 1.4;
    // Standing on the spot they last saw you and finding nobody is demoralising.
    if (dist(chaser.x, chaser.y, chaser.lastSeenX, chaser.lastSeenY) < 44) {
      chaser.patience -= step * 2.5;
    }
    if (chaser.searchTimer <= 0) quitting = true;
  }

  if (chaser.patience <= 0) quitting = true;

  if (quitting && chaser.state !== 'RETURN' && chaser.state !== 'LURED') {
    if (chaser.roams && !chaser.hasChased) {
      // A patrol that never actually engaged isn't finished — it just moves on
      // to another part of the street. Only a real chase uses up its one chase.
      chaser.patience = chaser.spec.patience;
      chaser.searchTimer = chaser.spec.searchTime;
      chaser.state = 'SEARCH';
      chaser.lastSeenX = ctx.street.minX + Math.random() * (ctx.street.maxX - ctx.street.minX);
      chaser.lastSeenY = ctx.street.minY + Math.random() * (ctx.street.maxY - ctx.street.minY);
      chaser.homeX = chaser.lastSeenX;
      chaser.homeY = chaser.lastSeenY;
    } else {
      chaser.state = 'RETURN';
    }
  }

  if (chaser.state === 'RETURN') {
    chaser.spent = true;
    chaser.returnTimer += step;
    chaser.fade = Math.max(0, chaser.fade - step / GIVE_UP.fadeSeconds);
    if (
      chaser.fade <= 0 ||
      chaser.returnTimer > GIVE_UP.maxReturnSeconds ||
      dist(chaser.x, chaser.y, chaser.homeX, chaser.homeY) < 48
    ) {
      chaser.done = true;
    }
  }

  // Pick the target only once the state is settled. Doing it any earlier lets a
  // chaser keep walking at the player while counting as having given up — which
  // reads as being followed by someone who can never catch you.
  let targetX = chaser.lastSeenX;
  let targetY = chaser.lastSeenY;

  if (chaser.state === 'CHASE') {
    if (chaser.spec.tactic === 'INTERCEPT') {
      // Aim at where you are heading. Running in a straight line stops working.
      targetX = ctx.player.x + ctx.playerVx * chaser.spec.lead;
      targetY = ctx.player.y + ctx.playerVy * chaser.spec.lead;
    } else {
      targetX = ctx.player.x;
      targetY = ctx.player.y;
    }
  } else if (chaser.state === 'RETURN') {
    targetX = chaser.homeX;
    targetY = chaser.homeY;
  } else if (chaser.state === 'SEARCH') {
    const scent =
      chaser.spec.tactic === 'SCENT' && chaser.ignoreTrailUntil <= 0 ? freshestTrailPoint(chaser, ctx) : null;
    if (scent) {
      // Nose to the ground: a dog goes to where you actually went.
      targetX = scent.x;
      targetY = scent.y;
    } else {
      // Everyone else fans out around the last known position rather than all
      // piling onto the same spot, so a group actually sweeps the area.
      const reached = dist(chaser.x, chaser.y, chaser.lastSeenX, chaser.lastSeenY) < 60;
      const spread = reached ? chaser.spec.searchSpread : 0;
      targetX = chaser.lastSeenX + Math.cos(chaser.searchAngle) * spread;
      targetY = chaser.lastSeenY + Math.sin(chaser.searchAngle) * spread;
      if (reached) chaser.searchAngle += 1.9 * step;
    }
  }

  // Search and return are a jog, not a sprint — that gap is your escape window.
  const paceMultiplier =
    chaser.state === 'CHASE' ? 1 : chaser.state === 'LURED' ? 0.94 : chaser.state === 'SEARCH' ? 0.72 : 0.6;

  // Anything with a burst runs itself out of breath. A dog closes terrifyingly
  // fast for the first couple of seconds and then fades, so the answer to being
  // chased by something faster than you is to keep running rather than despair.
  const tired =
    chaser.spec.burstSeconds > 0 && chaser.state === 'CHASE' && chaser.chaseTime > chaser.spec.burstSeconds
      ? chaser.spec.tiredSpeed
      : 1;

  const speed = chaser.spec.speed * (1 + ctx.speedBonus) * paceMultiplier * tired;

  chaser.steerHold = Math.max(0, chaser.steerHold - step);
  chaser.sidestepTimer = Math.max(0, chaser.sidestepTimer - step);

  // A target sitting inside a solid is unreachable by construction, and a chaser
  // will lean on the wall forever trying. Nudge it out to somewhere they can
  // actually stand before they set off towards it.
  if (!returningTo(chaser)) {
    const point: Vec2 = { x: targetX, y: targetY };
    let moved = false;
    for (const rect of ctx.obstacles) {
      if (pointInside(point, rect)) {
        resolveCircleRect(point, chaser.spec.radius + 6, rect);
        moved = true;
      }
    }
    if (moved) {
      targetX = point.x;
      targetY = point.y;
    }
  }

  // Someone walking home no longer navigates around the world — they walk
  // through it. See GIVE_UP in config for why.
  const returning = chaser.state === 'RETURN';
  const dir = steer(chaser, targetX, targetY, returning ? NO_OBSTACLES : ctx.obstacles);
  chaser.vx = dir.x * speed;
  chaser.vy = dir.y * speed;
  chaser.x += chaser.vx * step;
  chaser.y += chaser.vy * step;
  if (dir.x !== 0 || dir.y !== 0) chaser.facing = Math.atan2(dir.y, dir.x);

  if (!returning) {
    const beforeX = chaser.x - chaser.vx * step;
    const beforeY = chaser.y - chaser.vy * step;

    const pos: Vec2 = { x: chaser.x, y: chaser.y };
    for (const rect of ctx.obstacles) {
      if (nearby(rect, pos, chaser.spec.radius + 4)) resolveCircleRect(pos, chaser.spec.radius, rect);
    }
    chaser.x = pos.x;
    chaser.y = pos.y;

    // How far did they actually get, versus how far they tried to? Grinding
    // against geometry shows up here as movement far short of intent.
    const moved = dist(beforeX, beforeY, chaser.x, chaser.y);
    const intended = speed * step;
    if (intended > 0.01 && moved < intended * STEERING.progressThreshold) {
      chaser.stuckTimer += step;
      if (chaser.stuckTimer > STEERING.abandonAfter) {
        // Sidestepping has not helped, so the destination itself is the problem.
        // Give up on it and look somewhere they can actually get to.
        chaser.stuckTimer = 0;
        chaser.sidestepTimer = 0;
        chaser.searchAngle = Math.random() * Math.PI * 2;
        chaser.lastSeenX = chaser.x + Math.cos(chaser.searchAngle) * 170;
        chaser.lastSeenY = chaser.y + Math.sin(chaser.searchAngle) * 170;
        chaser.ignoreTrailUntil = 1.6;
      } else if (chaser.stuckTimer > STEERING.stuckAfter && chaser.sidestepTimer <= 0) {
        // Commit to sliding along whatever is in the way, picking the side that
        // gets them nearer the target. Real navigation, not ignoring the wall.
        const toTarget = Math.atan2(targetY - chaser.y, targetX - chaser.x);
        const probe = 90;
        const left = toTarget - Math.PI / 2;
        const right = toTarget + Math.PI / 2;
        const scoreOf = (angle: number): number =>
          -dist(chaser.x + Math.cos(angle) * probe, chaser.y + Math.sin(angle) * probe, targetX, targetY);
        chaser.sidestep = scoreOf(left) >= scoreOf(right) ? left : right;
        chaser.sidestepTimer = STEERING.sidestepSeconds;
        chaser.stuckTimer = 0;
        chaser.steerHold = 0;
      }
    } else {
      chaser.stuckTimer = 0;
    }
  }

  if (chaser.state === 'CHASE' && dist(chaser.x, chaser.y, ctx.player.x, ctx.player.y) < 80) {
    chaser.closeCall = true;
  }
}

export function lureChaser(chaser: Chaser, x: number, y: number, seconds: number): void {
  if (chaser.state === 'RETURN') return;
  chaser.state = 'LURED';
  chaser.lureTimer = seconds;
  chaser.lastSeenX = x;
  chaser.lastSeenY = y;
  // Chasing a firecracker still burns their patience — decoys buy time twice over.
  chaser.patience = Math.max(chaser.patience, seconds + 1);
}

/** True if any chaser still has a live interest in the player. */
export function isActivelyHunting(chaser: Chaser): boolean {
  return chaser.startle > 0 || chaser.state === 'CHASE' || chaser.state === 'SEARCH';
}

/**
 * The most recent point on the player's trail that this chaser could plausibly
 * have picked up — i.e. one it has not already walked past.
 */
function freshestTrailPoint(chaser: Chaser, ctx: ChaseContext): Vec2 | null {
  let best: Vec2 | null = null;
  let bestDist = Infinity;

  for (const point of ctx.trail) {
    const d = dist(chaser.x, chaser.y, point.x, point.y);
    // Ignore the crumbs right under their feet; head for the next one along.
    if (d < 52) continue;
    if (d < bestDist) {
      bestDist = d;
      best = point;
    }
  }
  return bestDist < chaser.spec.sight * 1.6 ? best : null;
}

function returningTo(chaser: Chaser): boolean {
  return chaser.state === 'RETURN';
}

function pointInside(point: Vec2, rect: Rect): boolean {
  return point.x > rect.x && point.x < rect.x + rect.w && point.y > rect.y && point.y < rect.y + rect.h;
}

function nearby(rect: Rect, pos: Vec2, pad: number): boolean {
  return (
    pos.x + pad > rect.x &&
    pos.x - pad < rect.x + rect.w &&
    pos.y + pad > rect.y &&
    pos.y - pad < rect.y + rect.h
  );
}

const NO_OBSTACLES: readonly Rect[] = [];

/** Angles tried when the straight line is blocked, in order of preference. */
const WHISKERS = [0.42, -0.42, 0.85, -0.85, 1.3, -1.3, 1.9, -1.9, 2.6, -2.6];

/**
 * Whisker steering: head straight at the target unless something solid is in
 * the way, in which case fan out until a probe comes back clear. Cheap, has no
 * pathfinding data to maintain, and reads as "they ran round the hedge".
 *
 * Two things keep it from grinding on geometry. A chosen detour is committed to
 * for a moment, because re-picking every frame made a chaser alternate between
 * the left and right whisker and travel nowhere; and when all else fails the
 * caller commits them to a sidestep along the obstruction rather than letting
 * them lean into it.
 */
function steer(chaser: Chaser, targetX: number, targetY: number, obstacles: readonly Rect[]): Vec2 {
  if (chaser.sidestepTimer > 0) {
    return { x: Math.cos(chaser.sidestep), y: Math.sin(chaser.sidestep) };
  }

  const dx = targetX - chaser.x;
  const dy = targetY - chaser.y;
  const length = Math.hypot(dx, dy);
  if (length < 1) return { x: 0, y: 0 };

  const baseAngle = Math.atan2(dy, dx);
  const probe = Math.max(STEERING.minProbe, Math.min(STEERING.probe, length));
  // Only as much clearance as they actually need. A fatter pad than this seals
  // gaps the chaser would comfortably fit through.
  const pad = chaser.spec.radius + STEERING.clearance;

  const near: Rect[] = [];
  for (const rect of obstacles) {
    if (
      rect.x - pad < chaser.x + probe &&
      rect.x + rect.w + pad > chaser.x - probe &&
      rect.y - pad < chaser.y + probe &&
      rect.y + rect.h + pad > chaser.y - probe
    ) {
      near.push({ x: rect.x - pad, y: rect.y - pad, w: rect.w + pad * 2, h: rect.h + pad * 2 });
    }
  }

  if (near.length === 0) {
    chaser.steerHold = 0;
    return { x: dx / length, y: dy / length };
  }

  const blocked = (angle: number): boolean => {
    const px = chaser.x + Math.cos(angle) * probe;
    const py = chaser.y + Math.sin(angle) * probe;
    for (const rect of near) {
      if (segmentHitsRect(chaser.x, chaser.y, px, py, rect)) return true;
    }
    return false;
  };

  // Straight at them if that is open, and forget any detour we were on.
  if (!blocked(baseAngle)) {
    chaser.steerHold = 0;
    chaser.steerBias = 0;
    return { x: dx / length, y: dy / length };
  }

  // Otherwise try the side we already committed to before considering the other.
  const order =
    chaser.steerHold > 0 && chaser.steerBias !== 0
      ? [chaser.steerBias, ...WHISKERS.filter((offset) => offset !== chaser.steerBias)]
      : WHISKERS;

  for (const offset of order) {
    const angle = baseAngle + offset;
    if (blocked(angle)) continue;
    chaser.steerBias = offset;
    chaser.steerHold = STEERING.commit;
    return { x: Math.cos(angle), y: Math.sin(angle) };
  }

  return { x: dx / length, y: dy / length };
}

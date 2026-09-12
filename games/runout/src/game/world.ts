import type { Rect, Vec2 } from '../engine/math';
import { chance, pickWeighted, rand, randInt } from '../engine/math';
import { HOUSE_TIERS, WORLD, type HouseTier, type HouseTierName } from './config';

export type HouseState =
  | 'IDLE' // Never rung.
  | 'RINGING' // Bell has gone; the door has not opened yet.
  | 'REACTING' // Door is open and someone is after you.
  | 'PAID' // You got away with it.
  | 'BURNED'; // Rung and blown it, or nobody saw you. No value left here.

export interface House {
  id: number;
  side: 'top' | 'bottom';
  lot: Rect;
  building: Rect;
  windows: Rect[];
  /** Where the doorbell is, in world space. */
  door: Vec2;
  /** +1 if the door faces down the screen, -1 if it faces up. */
  facing: 1 | -1;
  walkway: Rect;
  driveway: Rect;
  mailbox: Rect;
  car: Rect | null;
  tier: HouseTier;
  state: HouseState;
  /** Counts down from the ring to the door flying open. */
  reactTimer: number;
  reward: number;
  porchLight: boolean;
  /** Raised by events; a spooked house reacts noticeably faster. */
  spooked: number;
  /** Raised by the GOLDEN HOUSE event. */
  bonusMultiplier: number;
  /** Door swing, 0..1, purely visual. */
  doorOpen: number;
  /** The full fuse length of the ring in progress, for the countdown ring. */
  fuse: number;
  /** How many of the "somebody is coming" cues have played this ring. */
  cued: number;
  /**
   * VALUABLE houses floodlight their own approach. You cannot walk up to one in
   * the dark, so the escape has to be planned before you press the bell.
   */
  floodlit: boolean;
  /** RISKY houses keep a dog in the yard. It is visible, and it wakes up angry. */
  kennel: Vec2 | null;
}

export interface Lamp {
  x: number;
  y: number;
  radius: number;
}

export interface Van {
  x: number;
  y: number;
  rect: Rect;
}

export interface World {
  houses: House[];
  /** Solid: blocks movement. */
  obstacles: Rect[];
  /** Blocks line of sight — a subset of solids, since you can see over a mailbox. */
  blockers: Rect[];
  lamps: Lamp[];
  van: Van;
  road: Rect;
  sidewalks: Rect[];
  hedges: Rect[];
}

const TIER_NAMES = Object.keys(HOUSE_TIERS) as HouseTierName[];
const TIER_WEIGHTS = TIER_NAMES.map((name) => HOUSE_TIERS[name].weight);

export function generateWorld(): World {
  const houses: House[] = [];
  const obstacles: Rect[] = [];
  const blockers: Rect[] = [];
  const hedges: Rect[] = [];
  const lamps: Lamp[] = [];

  const usable = WORLD.width - WORLD.lotMargin * 2;
  const lotCount = Math.floor(usable / WORLD.lotWidth);

  let id = 0;
  for (const side of ['top', 'bottom'] as const) {
    for (let i = 0; i < lotCount; i++) {
      // The first lot on the bottom row is where the van parks; leave it clear.
      if (side === 'bottom' && i === 0) continue;

      const lot: Rect = {
        x: WORLD.lotMargin + i * WORLD.lotWidth,
        y: side === 'top' ? WORLD.topLotY : WORLD.bottomLotY,
        w: WORLD.lotWidth - 24,
        h: WORLD.lotHeight,
      };

      const house = buildHouse(id++, side, lot);
      houses.push(house);

      obstacles.push(house.building, house.mailbox);
      blockers.push(house.building);

      if (house.car) {
        obstacles.push(house.car);
        blockers.push(house.car);
      }

      for (const hedge of hedgesFor(house)) {
        hedges.push(hedge);
        obstacles.push(hedge);
        blockers.push(hedge);
      }
    }
  }

  // Street lamps down both kerbs, offset so the pools of light interleave.
  for (let x = 260; x < WORLD.width - 120; x += 430) {
    lamps.push({ x, y: WORLD.roadTop - 14, radius: 240 });
    lamps.push({ x: x + 215, y: WORLD.roadBottom + 14, radius: 240 });
  }

  const vanY = (WORLD.roadTop + WORLD.roadBottom) / 2;
  const van: Van = {
    x: 250,
    y: vanY,
    rect: { x: 250 - 86, y: vanY - 40, w: 172, h: 80 },
  };
  obstacles.push(van.rect);
  blockers.push(van.rect);

  const road: Rect = {
    x: 0,
    y: WORLD.roadTop,
    w: WORLD.width,
    h: WORLD.roadBottom - WORLD.roadTop,
  };

  const sidewalks: Rect[] = [
    { x: 0, y: WORLD.roadTop - WORLD.sidewalk, w: WORLD.width, h: WORLD.sidewalk },
    { x: 0, y: WORLD.roadBottom, w: WORLD.width, h: WORLD.sidewalk },
  ];

  return { houses, obstacles, blockers, lamps, van, road, sidewalks, hedges };
}

function buildHouse(id: number, side: 'top' | 'bottom', lot: Rect): House {
  const facing: 1 | -1 = side === 'top' ? 1 : -1;
  const buildingW = lot.w - randInt(120, 170);
  const buildingH = randInt(290, 340);
  const buildingX = lot.x + Math.round((lot.w - buildingW) / 2) + randInt(-24, 24);
  // Both rows leave the same depth of front yard between the house and the kerb.
  const buildingY = side === 'top' ? lot.y + 34 : lot.y + lot.h - 34 - buildingH;

  const building: Rect = { x: buildingX, y: buildingY, w: buildingW, h: buildingH };
  const frontEdgeY = side === 'top' ? building.y + building.h : building.y;

  const doorX = building.x + Math.round(building.w * rand(0.32, 0.68));
  const door: Vec2 = { x: doorX, y: frontEdgeY };

  const yardTop = side === 'top' ? frontEdgeY : lot.y;
  const yardBottom = side === 'top' ? lot.y + lot.h : frontEdgeY;

  const walkway: Rect = { x: doorX - 26, y: yardTop, w: 52, h: yardBottom - yardTop };

  const driveOnLeft = chance(0.5);
  const driveW = 96;
  const driveway: Rect = {
    x: driveOnLeft ? lot.x + 8 : lot.x + lot.w - driveW - 8,
    y: side === 'top' ? frontEdgeY - 50 : yardTop,
    w: driveW,
    h: yardBottom - yardTop + 50,
  };

  const mailbox: Rect = {
    x: doorX + (driveOnLeft ? 64 : -80),
    y: side === 'top' ? lot.y + lot.h - 30 : lot.y + 12,
    w: 16,
    h: 18,
  };

  const car: Rect | null = chance(0.38)
    ? {
        x: driveway.x + 14,
        y: side === 'top' ? driveway.y + driveway.h - 140 : driveway.y + 32,
        w: driveW - 28,
        h: 108,
      }
    : null;

  const tierName = pickWeighted(TIER_NAMES, TIER_WEIGHTS);
  const tier = HOUSE_TIERS[tierName];

  return {
    id,
    side,
    lot,
    building,
    windows: windowsFor(building, side),
    door,
    facing,
    walkway,
    driveway,
    mailbox,
    car,
    tier,
    state: 'IDLE',
    reactTimer: 0,
    reward: Math.round(rand(tier.reward[0], tier.reward[1])),
    // A lit porch is the visual tell that somebody in there is already awake.
    porchLight: chance(tierName === 'EASY' ? 0.12 : tierName === 'ALERT' ? 0.35 : 0.62),
    spooked: 0,
    bonusMultiplier: 1,
    doorOpen: 0,
    fuse: 0,
    cued: 0,
    floodlit: tierName === 'VALUABLE',
    // Off to the side of the lot, not across the walkway: the dog is a threat you
    // can see and route around, not an ambush sitting in the only way out.
    kennel:
      tierName === 'RISKY'
        ? {
            x: door.x + (driveOnLeft ? 168 : -168),
            y: side === 'top' ? frontEdgeY + 58 : frontEdgeY - 58,
          }
        : null,
  };
}

function windowsFor(building: Rect, side: 'top' | 'bottom'): Rect[] {
  const windows: Rect[] = [];
  const count = randInt(2, 3);
  const frontY = side === 'top' ? building.y + building.h - 36 : building.y + 18;
  const span = (building.w - 56) / count;
  for (let i = 0; i < count; i++) {
    windows.push({ x: building.x + 24 + i * span, y: frontY, w: 38, h: 24 });
  }
  return windows;
}

/**
 * Hedges divide the front yards. Every divider has exactly one gap, so cutting
 * between gardens is possible but costs a detour — which is the decision that
 * makes a chase interesting instead of a straight-line footrace.
 */
function hedgesFor(house: House): Rect[] {
  const hedges: Rect[] = [];
  const yardTop = house.side === 'top' ? house.building.y + house.building.h : house.lot.y;
  const yardBottom = house.side === 'top' ? house.lot.y + house.lot.h : house.building.y;
  const yardHeight = yardBottom - yardTop;
  if (yardHeight < 80) return hedges;

  const dividerX = house.lot.x + house.lot.w + 2;
  const gapSize = 120;
  const gapStart = yardTop + rand(0.1, 0.6) * (yardHeight - gapSize);

  hedges.push({ x: dividerX, y: yardTop, w: 16, h: Math.max(0, gapStart - yardTop) });
  hedges.push({
    x: dividerX,
    y: gapStart + gapSize,
    w: 16,
    h: Math.max(0, yardBottom - (gapStart + gapSize)),
  });

  // A decorative clump near the porch — cover you can actually duck behind.
  if (chance(0.65)) {
    const doorOnRightHalf = house.door.x - house.building.x > house.building.w / 2;
    hedges.push({
      x: doorOnRightHalf ? house.building.x + 10 : house.door.x + 48,
      y: house.side === 'top' ? yardTop + rand(46, 96) : yardBottom - rand(74, 124),
      w: rand(70, 130),
      h: 26,
    });
  }

  return hedges.filter((hedge) => hedge.h > 12 && hedge.w > 8);
}

/** The closest house whose doorbell is within `reach`, or null. */
export function houseInReach(world: World, x: number, y: number, reach: number): House | null {
  let best: House | null = null;
  let bestDist = reach;

  for (const house of world.houses) {
    const d = Math.hypot(house.door.x - x, house.door.y - y);
    if (d < bestDist) {
      bestDist = d;
      best = house;
    }
  }
  return best;
}

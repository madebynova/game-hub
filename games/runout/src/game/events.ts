import { chance, dist, pick, rand, randInt } from '../engine/math';
import type { Vec2 } from '../engine/math';
import { audio } from '../engine/audio';
import type { ChaserKind } from './config';
import { HEAT, WORLD } from './config';
import type { House, World } from './world';

/**
 * Neighbourhood events.
 *
 * Every one of these exists to push on the ring-run-escape loop: it either
 * changes what a house is worth, changes how fast it reacts, puts something new
 * between you and the van, or hands you a reason to risk one more door.
 */

export interface EventContext {
  world: World;
  /** Where the player is, so events happen somewhere they can actually see. */
  player: Vec2;
  heat: number;
  /** Seconds of night left. */
  timeLeft: number;
  housesRung: number;
  /** False while the street already has its patrol, or is in the quiet window. */
  canPatrol: boolean;
  toast: (text: string, color?: string) => void;
  spawn: (kind: ChaserKind, x: number, y: number, roams?: boolean) => void;
  shake: (amount: number) => void;
  /** Flag a spot on the map so the player is told where something just changed. */
  mark: (x: number, y: number, label: string, color: string) => void;
  /** Drop a temporary pool of light, e.g. headlights sweeping a driveway. */
  flare: (x: number, y: number, radius: number, seconds: number) => void;
  /** Scales everyone's sight range for a while (rain, fog). */
  setSightModifier: (multiplier: number, seconds: number) => void;
}

interface EventDef {
  id: string;
  /** Relative likelihood given the current heat, or 0 to sit this one out. */
  weight: (ctx: EventContext) => number;
  run: (ctx: EventContext) => void;
}

export class EventDirector {
  private timer = 16;
  private sinceLast = 0;
  /** Houses currently boosted by the golden-house event. */
  private golden: { house: House; timer: number } | null = null;

  update(step: number, ctx: EventContext): void {
    this.sinceLast += step;
    this.timer -= step;

    if (this.golden) {
      this.golden.timer -= step;
      if (this.golden.timer <= 0 || this.golden.house.state !== 'IDLE') {
        if (this.golden.house.state === 'IDLE') {
          this.golden.house.bonusMultiplier = 1;
          ctx.toast('THE PACKAGE WENT INSIDE', '#94a3b8');
        }
        this.golden = null;
      }
    }

    if (this.timer > 0) return;

    this.fire(ctx);

    // A hotter street is a busier street: events come in faster the longer you
    // have been out here, so Heat raises the tempo as well as the danger.
    const heatRush = 1 - Math.min(HEAT.eventRushAt100, (ctx.heat / 100) * HEAT.eventRushAt100);
    this.timer = rand(13, 24) * heatRush;
    this.sinceLast = 0;
  }

  private fire(ctx: EventContext): void {
    const candidates = EVENTS.filter((event) => event.weight(ctx) > 0);
    if (candidates.length === 0) return;

    let total = 0;
    for (const event of candidates) total += event.weight(ctx);
    let roll = Math.random() * total;

    for (const event of candidates) {
      roll -= event.weight(ctx);
      if (roll <= 0) {
        if (event.id === 'golden') this.runGolden(ctx);
        else event.run(ctx);
        return;
      }
    }
  }

  private runGolden(ctx: EventContext): void {
    const house = pickIdleHouse(ctx.world, ctx.player);
    if (!house) return;
    ctx.mark(house.door.x, house.door.y, 'PACKAGE', '#fbbf24');
    house.bonusMultiplier = 3;
    house.spooked = Math.max(house.spooked, 0.35);
    this.golden = { house, timer: 32 };
    audio.alarm();
    ctx.toast('PORCH PACKAGE — TRIPLE VALUE, 30 SECONDS', '#fbbf24');
  }

  /** The house the golden event is currently pointing at, for the HUD marker. */
  get goldenHouse(): House | null {
    return this.golden?.house ?? null;
  }

  get goldenTimeLeft(): number {
    return this.golden?.timer ?? 0;
  }
}

/**
 * Prefer a house the player can plausibly see. An event on the far side of a
 * 3800px street is just a toast about nothing; one on the house you were about
 * to ring is a decision.
 */
function pickIdleHouse(world: World, near?: Vec2): House | null {
  const idle = world.houses.filter((house) => house.state === 'IDLE');
  if (idle.length === 0) return null;
  if (!near) return pick(idle);

  const close = idle.filter((house) => dist(house.door.x, house.door.y, near.x, near.y) < NEARBY);
  return close.length > 0 ? pick(close) : pick(idle);
}

/** Roughly a screen and a half at the usual zoom. */
const NEARBY = 1500;

const EVENTS: readonly EventDef[] = [
  {
    // Headlights swing into a drive: that house is now wide awake and worth more.
    id: 'car-home',
    weight: () => 20,
    run: (ctx) => {
      const house = pickIdleHouse(ctx.world, ctx.player);
      if (!house) return;
      house.spooked = 1;
      house.porchLight = true;
      house.bonusMultiplier = Math.max(house.bonusMultiplier, 1.5);
      // Headlights actually light the place up for a few seconds, so this can
      // catch you mid-escape rather than just being a line of text.
      ctx.flare(house.driveway.x + house.driveway.w / 2, house.door.y, 300, 6);
      ctx.mark(house.door.x, house.door.y, 'CAR HOME', '#fb923c');
      audio.carHorn();
      ctx.toast('HEADLIGHTS — SOMEONE JUST GOT HOME', '#fb923c');
    },
  },
  {
    id: 'porch-light',
    weight: () => 18,
    run: (ctx) => {
      const dark = ctx.world.houses.filter(
        (house) => house.state === 'IDLE' && !house.porchLight && dist(house.door.x, house.door.y, ctx.player.x, ctx.player.y) < NEARBY,
      );
      if (dark.length === 0) return;
      const house = pick(dark);
      house.porchLight = true;
      ctx.mark(house.door.x, house.door.y, 'LIGHT ON', '#fbbf24');
      house.spooked = Math.max(house.spooked, 0.5);
      house.bonusMultiplier = Math.max(house.bonusMultiplier, 1.25);
      audio.blip();
      ctx.toast('A PORCH LIGHT CAME ON', '#fbbf24');
    },
  },
  {
    // A loose dog is the one thing you genuinely cannot outrun.
    id: 'loose-dog',
    weight: (ctx) => (ctx.heat > 18 ? 11 : 4),
    run: (ctx) => {
      const house = pickIdleHouse(ctx.world, ctx.player) ?? pick(ctx.world.houses);
      const x = house.door.x + rand(-60, 60);
      const y = house.door.y + house.facing * rand(90, 150);
      ctx.spawn('DOG', x, y);
      ctx.mark(x, y, 'DOG', '#fcd34d');
      audio.bark();
      ctx.shake(0.2);
      ctx.toast('A DOG GOT OUT — KEEP AWAY FROM IT', '#fcd34d');
    },
  },
  {
    id: 'watch-patrol',
    weight: (ctx) => (ctx.canPatrol && ctx.heat > 40 ? 22 : 0),
    run: (ctx) => {
      const fromLeft = chance(0.5);
      const x = fromLeft ? 60 : WORLD.width - 60;
      const y = (WORLD.roadTop + WORLD.roadBottom) / 2;
      ctx.spawn('WATCH', x, y, true);
      ctx.mark(x, y, 'PATROL', '#67e8f9');
      audio.alarm();
      ctx.toast('NEIGHBOURHOOD WATCH IS OUT', '#67e8f9');
    },
  },
  {
    id: 'security',
    weight: (ctx) => (ctx.canPatrol && ctx.heat > 74 ? 20 : 0),
    run: (ctx) => {
      const y = (WORLD.roadTop + WORLD.roadBottom) / 2;
      ctx.spawn('SECURITY', WORLD.width - 80, y, true);
      ctx.mark(WORLD.width - 80, y, 'SECURITY', '#a5b4fc');
      audio.alarm();
      ctx.shake(0.3);
      ctx.toast('PRIVATE SECURITY CALLED IN', '#a5b4fc');
    },
  },
  {
    // Rain is a gift: it is the one event that makes you harder to see.
    id: 'rain',
    weight: () => 12,
    run: (ctx) => {
      ctx.setSightModifier(0.68, randInt(22, 34));
      ctx.toast('RAIN — HARDER TO SPOT YOU. GO NOW.', '#7dd3fc');
    },
  },
  {
    id: 'golden',
    weight: (ctx) => (ctx.housesRung >= 1 ? 14 : 0),
    run: () => {
      /* handled by EventDirector.runGolden so it can track the timer */
    },
  },
  {
    // Pure pressure: no new threat, just a reminder that Heat is a clock.
    id: 'curtains',
    weight: (ctx) => (ctx.heat > 30 ? 10 : 4),
    run: (ctx) => {
      const lit = ctx.world.houses.filter((house) => house.state === 'IDLE');
      let count = 0;
      for (const house of lit) {
        if (chance(0.4)) {
          house.porchLight = true;
          house.spooked = Math.max(house.spooked, 0.3);
          count++;
        }
      }
      if (count > 0) {
        audio.blip();
        ctx.toast('CURTAINS TWITCHING UP AND DOWN THE STREET', '#f0abfc');
      }
    },
  },
  {
    id: 'sunrise-warning',
    weight: (ctx) => (ctx.timeLeft < 70 && ctx.timeLeft > 40 ? 30 : 0),
    run: (ctx) => {
      audio.heatSting(0.8);
      ctx.toast('SKY IS GETTING LIGHT — GET TO THE VAN', '#fb7185');
    },
  },
];

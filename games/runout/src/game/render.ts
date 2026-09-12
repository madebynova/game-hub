import type { Rect } from '../engine/math';
import { clamp, dist } from '../engine/math';
import type { Stage } from '../engine/stage';
import type { Chaser } from './chasers';
import { LIGHT, RING, RUN } from './config';
import type { Run } from './run';
import type { House, World } from './world';

const PALETTE = {
  grass: ['#223a29', '#26412f', '#1e3525', '#294732', '#213826'],
  road: '#31353f',
  roadLine: '#565d70',
  kerb: '#434a59',
  sidewalk: '#3d4250',
  driveway: '#373b46',
  walkway: '#4a5263',
  wall: '#454b60',
  wallShade: '#373d4e',
  roof: '#2c3242',
  hedge: '#2a5438',
  hedgeTop: '#367048',
  windowDark: '#191e29',
  windowLit: '#fcd77f',
  van: '#3b4356',
  vanTrim: '#7dd3fc',
} as const;

/** Draws the whole neighbourhood, then the darkness on top of it. */
export class Renderer {
  private lightCanvas = document.createElement('canvas');
  private lightCtx: CanvasRenderingContext2D | null = this.lightCanvas.getContext('2d');

  draw(stage: Stage, run: Run): void {
    const { ctx } = stage;

    ctx.save();
    run.camera.apply(stage);

    const view = viewBounds(stage, run);

    this.drawGround(ctx, run.world, view);
    this.drawLots(ctx, run.world, view);
    this.drawRoad(ctx, run.world, view);
    this.drawHedges(ctx, run.world, view);
    this.drawHouses(ctx, run, view);
    this.drawVan(ctx, run);
    this.drawFlares(ctx, run);
    this.drawRipples(ctx, run);
    this.drawDecoys(ctx, run);
    this.drawChasers(ctx, run);
    this.drawPlayer(ctx, run);

    ctx.restore();

    this.drawDarkness(stage, run);

    // Labels and markers draw in screen space, above the darkness, so they stay
    // legible at any camera zoom.
    this.drawHouseLabels(stage, run, view);
    this.drawRingFuses(stage, run);
    this.drawEventMarks(stage, run);
    this.drawAlerts(stage, run);
    this.drawPrompts(stage, run);
  }

  // ------------------------------------------------------------- background

  private drawGround(ctx: CanvasRenderingContext2D, world: World, view: Rect): void {
    ctx.fillStyle = PALETTE.grass[0] ?? '#16241a';
    ctx.fillRect(view.x, view.y, view.w, view.h);
    void world;
  }

  private drawLots(ctx: CanvasRenderingContext2D, world: World, view: Rect): void {
    for (const house of world.houses) {
      if (!intersects(house.lot, view)) continue;

      // A little shade variation so the street doesn't read as one flat field.
      ctx.fillStyle = PALETTE.grass[house.id % PALETTE.grass.length] ?? '#16241a';
      ctx.fillRect(house.lot.x, house.lot.y, house.lot.w, house.lot.h);

      ctx.fillStyle = PALETTE.driveway;
      fillRect(ctx, house.driveway);

      ctx.fillStyle = PALETTE.walkway;
      fillRect(ctx, house.walkway);
    }
  }

  private drawRoad(ctx: CanvasRenderingContext2D, world: World, view: Rect): void {
    ctx.fillStyle = PALETTE.sidewalk;
    for (const walk of world.sidewalks) fillRect(ctx, walk);

    ctx.fillStyle = PALETTE.road;
    fillRect(ctx, world.road);

    ctx.fillStyle = PALETTE.kerb;
    ctx.fillRect(world.road.x, world.road.y - 3, world.road.w, 3);
    ctx.fillRect(world.road.x, world.road.y + world.road.h, world.road.w, 3);

    // Centre line, only across the visible span.
    ctx.fillStyle = PALETTE.roadLine;
    const midY = world.road.y + world.road.h / 2 - 3;
    const from = Math.max(0, Math.floor(view.x / 90) * 90);
    const to = Math.min(world.road.w, view.x + view.w);
    for (let x = from; x < to; x += 90) ctx.fillRect(x, midY, 48, 6);
  }

  private drawHedges(ctx: CanvasRenderingContext2D, world: World, view: Rect): void {
    for (const hedge of world.hedges) {
      if (!intersects(hedge, view)) continue;
      ctx.fillStyle = PALETTE.hedge;
      ctx.fillRect(hedge.x, hedge.y + 4, hedge.w, hedge.h);
      ctx.fillStyle = PALETTE.hedgeTop;
      ctx.fillRect(hedge.x, hedge.y, hedge.w, Math.min(hedge.h, 8));
    }
  }

  // ----------------------------------------------------------------- houses

  private drawHouses(ctx: CanvasRenderingContext2D, run: Run, view: Rect): void {
    for (const house of run.world.houses) {
      if (!intersects(house.lot, view)) continue;

      // A floodlit approach, drawn on the ground so you can see the trap before
      // you walk into it.
      if (house.floodlit) {
        const glow = ctx.createRadialGradient(
          house.door.x,
          house.door.y,
          20,
          house.door.x,
          house.door.y,
          LIGHT.floodlightRadius,
        );
        glow.addColorStop(0, 'rgba(226, 232, 240, 0.18)');
        glow.addColorStop(1, 'rgba(226, 232, 240, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(house.door.x, house.door.y, LIGHT.floodlightRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      if (house.kennel) this.drawKennel(ctx, house);

      if (house.car) {
        this.drawCar(ctx, house.car, house.id);
      }

      // Mailbox: post plus flag.
      ctx.fillStyle = '#4b5262';
      fillRect(ctx, house.mailbox);

      const b = house.building;
      ctx.fillStyle = PALETTE.wall;
      roundRect(ctx, b.x, b.y, b.w, b.h, 6);
      ctx.fill();

      // Roof band along the back edge reads as a pitch from above.
      ctx.fillStyle = PALETTE.roof;
      const roofH = 54;
      if (house.side === 'top') {
        roundRect(ctx, b.x, b.y, b.w, roofH, 6);
      } else {
        roundRect(ctx, b.x, b.y + b.h - roofH, b.w, roofH, 6);
      }
      ctx.fill();

      ctx.fillStyle = PALETTE.wallShade;
      ctx.fillRect(b.x, house.side === 'top' ? b.y + roofH : b.y + b.h - roofH - 4, b.w, 4);

      const lit = house.porchLight || house.state === 'REACTING' || house.state === 'RINGING';
      for (const win of house.windows) {
        ctx.fillStyle = lit ? PALETTE.windowLit : PALETTE.windowDark;
        roundRect(ctx, win.x, win.y, win.w, win.h, 3);
        ctx.fill();
      }

      this.drawDoor(ctx, house);
    }
  }

  private drawDoor(ctx: CanvasRenderingContext2D, house: House): void {
    const { door, facing } = house;
    const width = 44;
    const depth = 12;
    const y = facing === 1 ? door.y - depth : door.y;

    // Warm spill from an open door.
    if (house.doorOpen > 0.02) {
      const spill = ctx.createRadialGradient(door.x, door.y, 4, door.x, door.y, 190 * house.doorOpen);
      spill.addColorStop(0, `rgba(253, 224, 143, ${0.5 * house.doorOpen})`);
      spill.addColorStop(1, 'rgba(253, 224, 143, 0)');
      ctx.fillStyle = spill;
      ctx.beginPath();
      ctx.arc(door.x, door.y, 190 * house.doorOpen, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = house.doorOpen > 0.5 ? '#fde68a' : '#3d4353';
    ctx.fillRect(door.x - width / 2, y, width, depth);

    // The doorbell itself — the thing the whole game is about.
    ctx.fillStyle =
      house.state === 'RINGING' ? '#ffffff' : house.state === 'IDLE' ? house.tier.color : '#5b6474';
    ctx.beginPath();
    ctx.arc(door.x + width / 2 + 8, y + depth / 2, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Porch step, so doors read as doors from a distance.
    ctx.fillStyle = '#353b49';
    ctx.fillRect(door.x - width / 2 - 6, facing === 1 ? door.y : door.y - 5, width + 12, 5);
  }

  /** The dog house on a RISKY lot, and the dog asleep beside it until you ring. */
  private drawKennel(ctx: CanvasRenderingContext2D, house: House): void {
    const k = house.kennel;
    if (!k) return;

    ctx.fillStyle = '#4a3b2e';
    roundRect(ctx, k.x - 22, k.y - 18, 44, 36, 6);
    ctx.fill();
    ctx.fillStyle = '#2a2118';
    ctx.beginPath();
    ctx.arc(k.x, k.y + 4, 11, 0, Math.PI * 2);
    ctx.fill();

    if (house.state === 'IDLE') {
      // Curled up asleep. Still there, still a warning.
      ctx.fillStyle = '#fcd34d';
      ctx.beginPath();
      ctx.ellipse(k.x + 26, k.y + 8, 13, 9, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawCar(ctx: CanvasRenderingContext2D, car: Rect, seed: number): void {
    const colors = ['#3f4a63', '#4a3f52', '#38505a', '#523f3f'];
    ctx.fillStyle = colors[seed % colors.length] ?? '#3f4a63';
    roundRect(ctx, car.x, car.y, car.w, car.h, 10);
    ctx.fill();
    ctx.fillStyle = 'rgba(180, 205, 255, 0.16)';
    roundRect(ctx, car.x + 7, car.y + car.h * 0.24, car.w - 14, car.h * 0.3, 5);
    ctx.fill();
    roundRect(ctx, car.x + 7, car.y + car.h * 0.62, car.w - 14, car.h * 0.2, 5);
    ctx.fill();
  }

  private drawVan(ctx: CanvasRenderingContext2D, run: Run): void {
    const { van } = run.world;

    // Extraction ring, pulsing when you are close enough to use it.
    const inRange = dist(run.player.x, run.player.y, van.x, van.y) < RUN.extractRadius;
    ctx.save();
    ctx.setLineDash([10, 10]);
    ctx.lineWidth = inRange ? 3 : 2;
    ctx.strokeStyle = inRange
      ? run.beingHunted
        ? 'rgba(248, 113, 113, 0.85)'
        : 'rgba(74, 222, 128, 0.9)'
      : 'rgba(125, 211, 252, 0.35)';
    ctx.beginPath();
    ctx.arc(van.x, van.y, RUN.extractRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    const r = van.rect;
    ctx.fillStyle = PALETTE.van;
    roundRect(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.fill();
    ctx.fillStyle = '#2b3244';
    roundRect(ctx, r.x + r.w - 46, r.y + 8, 38, r.h - 16, 8);
    ctx.fill();
    ctx.fillStyle = PALETTE.vanTrim;
    ctx.fillRect(r.x + 12, r.y + r.h / 2 - 3, r.w - 70, 6);

    ctx.fillStyle = 'rgba(230, 233, 240, 0.85)';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('THE VAN', van.x, r.y - 10);
  }

  // --------------------------------------------------------------- entities

  private drawPlayer(ctx: CanvasRenderingContext2D, run: Run): void {
    const { player } = run;
    const bob = Math.sin(player.stepPhase / 16) * (player.sprinting ? 2.4 : 1.2);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(player.x, player.y + 13, 15, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(player.x, player.y + bob);

    // Body.
    ctx.fillStyle = '#7dd3fc';
    ctx.beginPath();
    ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
    ctx.fill();

    // Hood pointing where you are headed.
    ctx.fillStyle = '#0ea5e9';
    ctx.beginPath();
    ctx.arc(Math.cos(player.facing) * 7, Math.sin(player.facing) * 7, 9, 0, Math.PI * 2);
    ctx.fill();

    if (player.sprinting) {
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, player.radius + 5 + Math.sin(player.stepPhase / 8) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawChasers(ctx: CanvasRenderingContext2D, run: Run): void {
    for (const chaser of run.chasers) {
      const isDog = chaser.spec.kind === 'DOG';

      // Fades out while walking home, so giving up reads as leaving.
      ctx.save();
      ctx.globalAlpha = chaser.fade;

      // Top-tier scout app: anyone you cannot currently see is outlined, so you
      // route around the street knowing where everybody is.
      if (run.seesThroughWalls && chaser.state !== 'RETURN' && !run.canSeeChaser(chaser)) {
        ctx.save();
        ctx.globalAlpha = 0.55 * chaser.fade;
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = chaser.spec.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(chaser.x, chaser.y, chaser.spec.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.ellipse(chaser.x, chaser.y + 12, chaser.spec.radius, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(chaser.x, chaser.y);
      ctx.rotate(chaser.facing);

      ctx.fillStyle = chaser.spec.color;
      if (isDog) {
        // Stretched along its heading so it reads as something four-legged.
        ctx.beginPath();
        ctx.ellipse(0, 0, chaser.spec.radius * 1.5, chaser.spec.radius * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, chaser.spec.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.arc(chaser.spec.radius * 0.45, 0, chaser.spec.radius * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      if (run.loadoutShowsSight && chaser.state !== 'RETURN') {
        ctx.strokeStyle = `${chaser.spec.color}22`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(chaser.x, chaser.y, chaser.spec.sight * run.currentSightMultiplier, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  private drawDecoys(ctx: CanvasRenderingContext2D, run: Run): void {
    for (const decoy of run.decoys) {
      if (!decoy.spent) {
        const blink = Math.sin(decoy.fuse * 30) > 0 ? '#fbbf24' : '#78350f';
        ctx.fillStyle = blink;
        ctx.beginPath();
        ctx.arc(decoy.x, decoy.y, 6, 0, Math.PI * 2);
        ctx.fill();
      } else if (decoy.flash > 0) {
        const t = clamp(decoy.flash / 0.45, 0, 1);
        const glow = ctx.createRadialGradient(decoy.x, decoy.y, 2, decoy.x, decoy.y, 150 * t);
        glow.addColorStop(0, `rgba(255, 244, 214, ${0.9 * t})`);
        glow.addColorStop(1, 'rgba(251, 191, 36, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(decoy.x, decoy.y, 150 * t, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /** Headlights and the like: real light on the ground, and real exposure. */
  private drawFlares(ctx: CanvasRenderingContext2D, run: Run): void {
    for (const flare of run.flares) {
      const fade = clamp(flare.life / Math.min(1.5, flare.maxLife), 0, 1);
      const glow = ctx.createRadialGradient(flare.x, flare.y, 10, flare.x, flare.y, flare.radius);
      glow.addColorStop(0, `rgba(255, 244, 214, ${0.3 * fade})`);
      glow.addColorStop(1, 'rgba(255, 244, 214, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(flare.x, flare.y, flare.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawRipples(ctx: CanvasRenderingContext2D, run: Run): void {
    ctx.save();
    ctx.lineWidth = 3;
    for (const ripple of run.ripples) {
      ctx.globalAlpha = clamp(ripple.life, 0, 1) * 0.65;
      ctx.strokeStyle = ripple.color;
      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // --------------------------------------------------------------- lighting

  /**
   * Paints night over the finished frame, then erases holes where the lights
   * are. Being outside those holes is what makes you hard to see, so the
   * lighting is a gameplay read, not just a look.
   */
  private drawDarkness(stage: Stage, run: Run): void {
    const { ctx } = stage;
    const lightCtx = this.lightCtx;
    if (!lightCtx) return;

    const w = Math.max(1, Math.round(stage.width));
    const h = Math.max(1, Math.round(stage.height));
    if (this.lightCanvas.width !== w || this.lightCanvas.height !== h) {
      this.lightCanvas.width = w;
      this.lightCanvas.height = h;
    }

    // Dawn burns the darkness off — and takes your cover with it.
    // Dawn burns the darkness off — and so does a neighbourhood with every light
    // on, which is how high Heat takes away your best escape tool.
    const dawn = (run.timeLeft <= 0 ? 0.45 : 1) * (1 - run.exposure * 0.55);
    lightCtx.setTransform(1, 0, 0, 1, 0, 0);
    lightCtx.clearRect(0, 0, w, h);
    lightCtx.fillStyle = `rgba(7, 10, 22, ${0.6 * dawn})`;
    lightCtx.fillRect(0, 0, w, h);

    lightCtx.globalCompositeOperation = 'destination-out';

    const zoom = run.camera.zoom;
    const punch = (worldX: number, worldY: number, worldRadius: number, strength: number): void => {
      const sx = run.camera.worldToScreenX(worldX, stage);
      const sy = run.camera.worldToScreenY(worldY, stage);
      const radius = Math.max(1, worldRadius * zoom);
      if (sx < -radius || sy < -radius || sx > w + radius || sy > h + radius) return;

      const gradient = lightCtx.createRadialGradient(sx, sy, 0, sx, sy, radius);
      gradient.addColorStop(0, `rgba(0, 0, 0, ${strength})`);
      gradient.addColorStop(0.55, `rgba(0, 0, 0, ${strength * 0.5})`);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      lightCtx.fillStyle = gradient;
      lightCtx.beginPath();
      lightCtx.arc(sx, sy, radius, 0, Math.PI * 2);
      lightCtx.fill();
    };

    for (const lamp of run.world.lamps) punch(lamp.x, lamp.y, lamp.radius, 0.95);

    for (const house of run.world.houses) {
      if (house.floodlit) punch(house.door.x, house.door.y, LIGHT.floodlightRadius, 0.92);
      if (house.porchLight || house.state === 'REACTING' || house.state === 'RINGING') {
        punch(house.door.x, house.door.y, LIGHT.porchRadius, 0.85);
      }
      if (house.doorOpen > 0.1) punch(house.door.x, house.door.y, 210 * house.doorOpen, 0.9);
    }

    for (const decoy of run.decoys) {
      if (decoy.spent && decoy.flash > 0) punch(decoy.x, decoy.y, 260 * (decoy.flash / 0.45), 1);
    }

    for (const flare of run.flares) {
      punch(flare.x, flare.y, flare.radius, 0.9 * clamp(flare.life / Math.min(1.5, flare.maxLife), 0, 1));
    }

    // A soft bubble around the player so the ground around you always reads.
    punch(run.player.x, run.player.y, 240, 0.5);

    lightCtx.globalCompositeOperation = 'source-over';

    ctx.save();
    ctx.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
    ctx.drawImage(this.lightCanvas, 0, 0);

    // Warm tint over the lamps, added on top of the darkness.
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.07 * dawn;
    for (const lamp of run.world.lamps) {
      const sx = run.camera.worldToScreenX(lamp.x, stage);
      const sy = run.camera.worldToScreenY(lamp.y, stage);
      const radius = lamp.radius * zoom;
      if (sx < -radius || sy < -radius || sx > stage.width + radius || sy > stage.height + radius) continue;
      const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
      glow.addColorStop(0, 'rgba(255, 214, 140, 0.8)');
      glow.addColorStop(1, 'rgba(255, 214, 140, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(sx - radius, sy - radius, radius * 2, radius * 2);
    }
    ctx.restore();
  }

  // ----------------------------------------------------------------- labels

  private drawHouseLabels(stage: Stage, run: Run, view: Rect): void {
    const { ctx } = stage;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const house of run.world.houses) {
      if (!intersects(house.lot, view)) continue;

      const d = dist(run.player.x, run.player.y, house.door.x, house.door.y);
      if (d > run.scoutRange) continue;

      // Push the label clear of the countdown ring while the bell is ringing.
      const offset = house.state === 'RINGING' ? RING.fuseRadius + 30 : 44;
      const x = run.camera.worldToScreenX(house.door.x, stage);
      const y = run.camera.worldToScreenY(house.door.y + house.facing * offset, stage);
      if (x < -90 || x > stage.width + 90 || y < -40 || y > stage.height + 40) continue;

      // Fade the furthest readable houses so the street doesn't turn into a wall
      // of labels the moment you buy the scout app.
      ctx.globalAlpha = clamp(1 - (d - run.scoutRange * 0.72) / (run.scoutRange * 0.28), 0.2, 1);

      if (house.state === 'PAID' || house.state === 'BURNED') {
        ctx.font = '700 11px system-ui, sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.fillText(house.state === 'PAID' ? 'DONE' : 'BURNED', x, y);
        ctx.globalAlpha = 1;
        continue;
      }

      const golden = run.director.goldenHouse === house;
      const label = golden ? 'PACKAGE x3' : house.tier.name;
      const value = Math.round(house.reward * house.bonusMultiplier * run.payoutMultiplier);
      const color = golden ? '#fbbf24' : house.tier.color;

      ctx.font = '800 12px system-ui, sans-serif';
      const boxW = Math.max(ctx.measureText(label).width + 20, 76);

      ctx.fillStyle = 'rgba(8, 11, 18, 0.82)';
      roundRect(ctx, x - boxW / 2, y - 12, boxW, 24, 7);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.fillText(label, x, y);

      ctx.font = '700 11px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(226, 232, 240, 0.72)';
      ctx.fillText(`$${value}`, x, y + house.facing * 20);

      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  /**
   * A shrinking arc at every ringing door. The wait between the bell and the
   * door opening is the most important second in the game; this makes it a
   * countdown you can read rather than a blank pause.
   */
  private drawRingFuses(stage: Stage, run: Run): void {
    const { ctx } = stage;

    for (const house of run.world.houses) {
      if (house.state !== 'RINGING' || house.fuse <= 0) continue;

      const left = clamp(house.reactTimer / house.fuse, 0, 1);
      const x = run.camera.worldToScreenX(house.door.x, stage);
      const y = run.camera.worldToScreenY(house.door.y, stage);
      if (x < -80 || x > stage.width + 80 || y < -80 || y > stage.height + 80) continue;

      const radius = RING.fuseRadius * run.camera.zoom;
      const urgent = left < 0.34;

      ctx.save();
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(8, 11, 18, 0.65)';
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = urgent ? '#f87171' : house.tier.color;
      ctx.lineWidth = urgent ? 5 : 4;
      ctx.beginPath();
      ctx.arc(x, y, radius, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2);
      ctx.stroke();

      // A last flare as the handle turns.
      if (urgent) {
        ctx.globalAlpha = (1 - left / 0.34) * 0.5;
        ctx.fillStyle = '#f87171';
        ctx.beginPath();
        ctx.arc(x, y, radius * 0.82, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawAlerts(stage: Stage, run: Run): void {
    const { ctx } = stage;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const chaser of run.chasers) {
      const marker = markerFor(chaser);
      if (!marker) continue;

      const x = run.camera.worldToScreenX(chaser.x, stage);
      const y = run.camera.worldToScreenY(chaser.y - chaser.spec.radius - 26, stage);
      if (x < -40 || x > stage.width + 40 || y < -40 || y > stage.height + 40) continue;

      ctx.font = '900 20px system-ui, sans-serif';
      ctx.fillStyle = marker.color;
      ctx.fillText(marker.glyph, x, y);
    }
    ctx.restore();
  }

  /**
   * Points at whatever just changed. An event the player cannot locate is only
   * a line of text; an event with a marker is something to react to.
   */
  private drawEventMarks(stage: Stage, run: Run): void {
    const { ctx, width, height } = stage;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const mark of run.marks) {
      const fade = clamp(mark.life / 1.2, 0, 1);
      const sx = run.camera.worldToScreenX(mark.x, stage);
      const sy = run.camera.worldToScreenY(mark.y, stage);
      const margin = 52;
      const onScreen = sx > margin && sx < width - margin && sy > margin && sy < height - margin;

      ctx.globalAlpha = fade;

      if (onScreen) {
        const pulse = 1 - ((mark.maxLife - mark.life) % 1);
        ctx.strokeStyle = mark.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, sy, 26 + (1 - pulse) * 34, 0, Math.PI * 2);
        ctx.stroke();
        ctx.font = '800 11px system-ui, sans-serif';
        ctx.fillStyle = mark.color;
        ctx.fillText(mark.label, sx, sy - 42);
      } else {
        // Off screen: an arrow on the rim so you still know which way to look.
        const angle = Math.atan2(sy - height / 2, sx - width / 2);
        const radius = Math.min(width, height) / 2 - 44;
        const x = width / 2 + Math.cos(angle) * radius;
        const y = height / 2 + Math.sin(angle) * radius;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillStyle = mark.color;
        ctx.beginPath();
        ctx.moveTo(11, 0);
        ctx.lineTo(-7, -7);
        ctx.lineTo(-7, 7);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        ctx.font = '800 10px system-ui, sans-serif';
        ctx.fillStyle = mark.color;
        ctx.fillText(mark.label, x, y + 20);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  private drawPrompts(stage: Stage, run: Run): void {
    const { ctx } = stage;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const van = run.world.van;
    if (run.promptHouse) {
      const house = run.promptHouse;
      const x = run.camera.worldToScreenX(house.door.x, stage);
      const y = run.camera.worldToScreenY(house.door.y + house.facing * 86, stage);
      prompt(ctx, x, y, '[ E ]  RING DOORBELL', house.tier.color);
    } else if (run.canExtract) {
      const x = run.camera.worldToScreenX(van.x, stage);
      const y = run.camera.worldToScreenY(van.y + 88, stage);
      prompt(ctx, x, y, `[ E ]  EXTRACT  $${run.stash}`, '#4ade80');
    } else if (run.extractBlocked) {
      const x = run.camera.worldToScreenX(van.x, stage);
      const y = run.camera.worldToScreenY(van.y + 88, stage);
      prompt(ctx, x, y, 'LOSE THEM FIRST', '#f87171');
    }
    ctx.restore();
  }
}

function markerFor(chaser: Chaser): { glyph: string; color: string } | null {
  // Startling: they are on their feet but haven't set off yet. Without a marker
  // a motionless chaser at the start of a chase just looks stuck on scenery.
  if (chaser.startle > 0) {
    return { glyph: chaser.spec.kind === 'DOG' ? 'z' : '!?', color: '#cbd5e1' };
  }

  switch (chaser.state) {
    case 'CHASE':
      return { glyph: '!', color: '#f87171' };
    case 'SEARCH':
      // They heard something: you are about to be found unless you go quiet.
      if (chaser.heardTimer > 0) return { glyph: '👂', color: '#fb923c' };
      return { glyph: '?', color: '#fbbf24' };
    case 'LURED':
      return { glyph: '?!', color: '#a3e635' };
    default:
      return null;
  }
}

function prompt(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string): void {
  ctx.font = '700 14px system-ui, sans-serif';
  const width = ctx.measureText(text).width + 26;

  ctx.fillStyle = 'rgba(8, 11, 18, 0.88)';
  roundRect(ctx, x - width / 2, y - 15, width, 30, 8);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function viewBounds(stage: Stage, run: Run): Rect {
  const pad = 160;
  const w = run.camera.viewWidth(stage);
  const h = run.camera.viewHeight(stage);
  return { x: run.camera.x - w / 2 - pad, y: run.camera.y - h / 2 - pad, w: w + pad * 2, h: h + pad * 2 };
}

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function fillRect(ctx: CanvasRenderingContext2D, rect: Rect): void {
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, Math.max(0, h), radius);
}

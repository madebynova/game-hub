import { audio } from '../engine/audio';
import { Camera } from '../engine/camera';
import type { Input } from '../engine/input';
import { chance, clamp, dist, rand, type Rect, type Vec2 } from '../engine/math';
import type { Stage } from '../engine/stage';
import type { Chaser } from './chasers';
import {
  hasLineOfSight,
  isActivelyHunting,
  lureChaser,
  spawnChaser,
  updateChaser,
  type ChaseContext,
} from './chasers';
import { DECOY, HEAT, LIGHT, NOISE, PATROL, RING, RUN, WORLD, type ChaserKind } from './config';
import { EventDirector } from './events';
import { Player } from './player';
import type { Loadout } from './upgrades';
import { generateWorld, houseInReach, type House, type World } from './world';
import type { Job } from './jobs';

export type RunPhase = 'ACTIVE' | 'CAUGHT' | 'EXTRACTED';

export interface RunSummary {
  outcome: 'EXTRACTED' | 'CAUGHT';
  /** Banked on extraction, mostly lost on a bust. */
  stash: number;
  /** Part of the stash salvaged from a bust by DRAINPIPE STASH. */
  recovered: number;
  jobName: string;
  /** Bonus paid for meeting the job's clip quota. */
  quotaBonus: number;
  doorbells: number;
  clips: number;
  maxHeat: number;
  duration: number;
}

export interface Toast {
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface Ripple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  color: string;
}

/** A spot on the map the player is being pointed at after an event. */
export interface EventMark {
  x: number;
  y: number;
  label: string;
  color: string;
  life: number;
  maxLife: number;
}

/** A temporary pool of light, e.g. headlights swinging into a drive. */
export interface Flare {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
}

export interface Decoy {
  x: number;
  y: number;
  fuse: number;
  /** Seconds the bang stays visible after it goes off. */
  flash: number;
  spent: boolean;
}

const DOORBELL_REACH = 64;

export class Run {
  readonly world: World;
  readonly player: Player;
  readonly camera: Camera;
  readonly chasers: Chaser[] = [];
  readonly toasts: Toast[] = [];
  readonly ripples: Ripple[] = [];
  readonly decoys: Decoy[] = [];
  readonly marks: EventMark[] = [];
  readonly flares: Flare[] = [];
  readonly director = new EventDirector();

  phase: RunPhase = 'ACTIVE';
  heat = 0;
  /** Heat can never fall below this. Rises with every bell; never falls. */
  heatFloor = 0;
  maxHeat = 0;
  stash = 0;
  doorbells = 0;
  clips = 0;
  /** Paid on extraction when the job's clip quota is met. */
  quotaBonus = 0;
  timeLeft = RUN.nightLength;
  elapsed = 0;

  /** Set while the player is within reach of a bell they can actually ring. */
  promptHouse: House | null = null;
  canExtract = false;
  /** Why extraction is refused, for the prompt. */
  extractBlocked = false;

  /**
   * Obstacles the player collides with. With HOPPERS this leaves the hedges
   * out — they still stop everyone chasing you, which is the whole point.
   */
  private readonly playerObstacles: Rect[];
  /** Recent player positions, newest last. Dogs follow this. */
  private readonly trail: Vec2[] = [];
  private trailTimer = 0;
  private grace = RUN.spawnGrace;
  private sinceHunted = 99;
  private sightModifier = 1;
  private sightModifierTimer = 0;
  private patrolsSpawned = 0;
  /** Quiet window after a patrol leaves; no new one arrives while this runs. */
  private patrolCooldown = 0;
  private decoyCooldown = 0;
  private stepSound = 0;
  private heatStingAt = 0;
  /** 0..1 flash used for the screen pulse when Heat crosses a tier. */
  heatFlash = 0;
  /** 0..1 flash for the moment somebody first lays eyes on you. */
  spottedFlash = 0;
  /** Tracks how many chasers had eyes on you last frame, to detect the moment. */
  private seenByCount = 0;

  constructor(
    private readonly loadout: Loadout,
    readonly job: Job,
  ) {
    this.world = generateWorld(job.tierBias);
    this.player = new Player(loadout);
    this.camera = new Camera(WORLD.width, WORLD.height);

    const hedges = new Set<Rect>(this.world.hedges);
    this.playerObstacles = loadout.vaultHedges
      ? this.world.obstacles.filter((rect) => !hedges.has(rect))
      : this.world.obstacles;
    this.player.climbRects = loadout.vaultHedges ? this.world.hedges : [];

    // Start beside the van, on the road, facing the neighbourhood.
    this.player.placeAt(this.world.van.x + 120, this.world.van.y);

    // The job decides what kind of night this is, using systems that already
    // exist: the clock, the Heat you arrive with, who is already outside, and
    // whether the weather is on your side to begin with.
    this.timeLeft = job.nightLength;
    this.heat = job.startHeat;
    // Some of the Heat you arrive with is baked in — you cannot simply wait out
    // a job that starts hot.
    this.heatFloor = job.startHeat * 0.6;
    this.maxHeat = this.heat;

    if (job.rainSeconds > 0) {
      this.sightModifier = 0.68;
      this.sightModifierTimer = job.rainSeconds;
    }

    for (let i = 0; i < job.patrolsAtStart; i++) {
      const y = (WORLD.roadTop + WORLD.roadBottom) / 2;
      this.addChaser('WATCH', i % 2 === 0 ? WORLD.width - 90 : 90, y, null, 0, true);
    }
  }

  get heatTier(): { name: string; color: string } {
    let current = HEAT.tiers[0] ?? { at: 0, name: 'CALM', color: '#5eead4' };
    for (const tier of HEAT.tiers) if (this.heat >= tier.at) current = tier;
    return { name: current.name, color: current.color };
  }

  get heatFraction(): number {
    return clamp(this.heat / HEAT.max, 0, 1);
  }

  get heatFloorFraction(): number {
    return clamp(this.heatFloor / HEAT.max, 0, 1);
  }

  /**
   * How exposed the player is, 0..1. A hot street has its lights on, which is
   * what takes darkness away as an escape tool at the top of the Heat curve.
   */
  get exposure(): number {
    if (this.heat <= HEAT.exposureFrom) return 0;
    return clamp((this.heat - HEAT.exposureFrom) / (HEAT.max - HEAT.exposureFrom), 0, 1);
  }

  /** True while anyone is actively looking for the player. */
  get beingHunted(): boolean {
    return this.chasers.some(isActivelyHunting);
  }

  get chasedBy(): Chaser | null {
    let closest: Chaser | null = null;
    let best = Infinity;
    for (const chaser of this.chasers) {
      if (chaser.state !== 'CHASE') continue;
      const d = dist(chaser.x, chaser.y, this.player.x, this.player.y);
      if (d < best) {
        best = d;
        closest = chaser;
      }
    }
    return closest;
  }

  get raining(): boolean {
    return this.sightModifierTimer > 0;
  }

  /** Loadout values the renderer and HUD need to read. */
  get scoutRange(): number {
    return this.loadout.scoutRange;
  }

  get payoutMultiplier(): number {
    return this.loadout.payoutMultiplier;
  }

  /** How far the player's footsteps carry right now. */
  get noiseRadius(): number {
    if (this.player.speed < 24) return 0;
    const base = this.player.sprinting ? NOISE.sprintRadius : NOISE.walkRadius;
    return base * this.loadout.noiseMultiplier;
  }

  /**
   * Whether the street is allowed another patrol right now. One at a time (two
   * once things are critical), and never during the quiet window that escaping
   * one earns you.
   */
  get canSpawnPatrol(): boolean {
    if (this.patrolCooldown > 0) return false;
    const cap = this.heat >= 78 ? PATROL.maxAtCriticalHeat : PATROL.maxOnStreet;
    return this.chasers.filter((chaser) => chaser.roams).length < cap;
  }

  /** True when the player actually bought firecrackers this run. */
  get hasDecoys(): boolean {
    return this.loadout.decoys > 0;
  }

  get loadoutShowsSight(): boolean {
    return this.loadout.showSight;
  }

  get seesThroughWalls(): boolean {
    return this.loadout.seeThroughWalls;
  }

  /** Scout app: mark which houses keep a dog or run a floodlight. */
  get showsHouseTells(): boolean {
    return this.loadout.showHouseTells;
  }

  get canVault(): boolean {
    return this.loadout.vaultHedges;
  }

  get currentSightMultiplier(): number {
    return this.sightModifier;
  }

  summary(): RunSummary {
    return {
      outcome: this.phase === 'EXTRACTED' ? 'EXTRACTED' : 'CAUGHT',
      stash: this.stash,
      recovered: 0,
      jobName: this.job.name,
      quotaBonus: this.quotaBonus,
      doorbells: this.doorbells,
      clips: this.clips,
      maxHeat: Math.round(this.maxHeat),
      duration: this.elapsed,
    };
  }

  update(input: Input, stage: Stage, step: number): void {
    if (this.phase !== 'ACTIVE') {
      // Let the world settle for the outro, but stop simulating threats.
      this.camera.follow(this.player.x, this.player.y, stage, step);
      this.decayEffects(step);
      return;
    }

    this.elapsed += step;
    this.grace = Math.max(0, this.grace - step);
    this.decoyCooldown = Math.max(0, this.decoyCooldown - step);

    this.updateClock(step);
    // Endurance upgrades pay off between houses rather than during a chase.
    this.player.resting = !this.beingHunted;
    this.player.update(input, this.playerObstacles, step, false);
    if (this.player.justVaulted) audio.vault();
    if (this.player.caughtSecondWind) {
      audio.secondWind();
      this.toast('SECOND WIND', '#7dd3fc');
      this.camera.addShake(0.12);
    }
    this.updateTrail(step);
    this.updateFootsteps();
    this.updateHouses(step);
    this.updateDecoys(input, step);
    this.updateChasers(step);
    this.updateHeat(step);
    this.updateInteraction(input);
    this.updatePatrolPressure();

    this.director.update(step, {
      world: this.world,
      player: { x: this.player.x, y: this.player.y },
      heat: this.heat,
      timeLeft: this.timeLeft,
      housesRung: this.doorbells,
      canPatrol: this.canSpawnPatrol,
      toast: (text, color) => this.toast(text, color),
      spawn: (kind, x, y, roams) => this.addChaser(kind, x, y, null, 0, roams),
      shake: (amount) => this.camera.addShake(amount),
      mark: (x, y, label, color) => this.mark(x, y, label, color),
      flare: (x, y, radius, seconds) => {
        this.flares.push({ x, y, radius, life: seconds, maxLife: seconds });
      },
      setSightModifier: (multiplier, seconds) => {
        this.sightModifier = multiplier;
        this.sightModifierTimer = seconds;
      },
    });

    this.camera.follow(this.player.x, this.player.y, stage, step);
    this.decayEffects(step);
  }

  // ---------------------------------------------------------------- doorbell

  private updateInteraction(input: Input): void {
    const house = houseInReach(this.world, this.player.x, this.player.y, DOORBELL_REACH);
    this.promptHouse = house && house.state === 'IDLE' ? house : null;

    const atVan = dist(this.player.x, this.player.y, this.world.van.x, this.world.van.y) < RUN.extractRadius;
    this.canExtract = atVan && !this.beingHunted;
    this.extractBlocked = atVan && this.beingHunted;

    const pressed = input.wasPressed('KeyE');
    if (!pressed) return;

    if (this.canExtract) {
      this.extract();
      return;
    }
    if (this.extractBlocked) {
      this.toast('LOSE THEM FIRST', '#f87171');
      audio.thud();
      return;
    }
    if (this.promptHouse) this.ring(this.promptHouse);
  }

  private ring(house: House): void {
    house.state = 'RINGING';

    // Heat, a hot street and a spooked house all shorten the fuse.
    const heatSpeedUp = 1 - this.heatFraction * (1 - HEAT.reactionSpeedUpAt100);
    const spookSpeedUp = 1 - house.spooked * 0.4;
    house.reactTimer = Math.max(0.22, house.tier.reactionDelay * heatSpeedUp * spookSpeedUp);

    const gained = house.tier.heat * this.loadout.heatMultiplier * this.job.heatMultiplier;
    this.heat = Math.min(HEAT.max, this.heat + gained);
    // Half of it sticks for the rest of the night. This is the ratchet that
    // eventually makes staying out the wrong answer.
    this.heatFloor = Math.min(HEAT.floorMax, this.heatFloor + gained * HEAT.floorShare);
    this.maxHeat = Math.max(this.maxHeat, this.heat);
    this.doorbells++;
    this.sinceHunted = 0;

    house.fuse = house.reactTimer;
    house.cued = 0;

    audio.dingDong();
    this.camera.addShake(0.14);
    this.ripple(house.door.x, house.door.y, 250, house.tier.color);
    this.toast('DING DONG — RUN!', house.tier.color);
  }

  private updateHouses(step: number): void {
    for (const house of this.world.houses) {
      if (house.spooked > 0) house.spooked = Math.max(0, house.spooked - step * 0.05);

      const wantsOpen = house.state === 'REACTING';
      house.doorOpen = clamp(house.doorOpen + (wantsOpen ? step * 5 : -step * 2), 0, 1);

      if (house.state !== 'RINGING') continue;

      house.reactTimer -= step;

      // Somebody is coming. Two escalating cues turn the wait from a blank pause
      // into a countdown you can actually read — and make the difference between
      // an EASY fuse and a VALUABLE one something you hear, not just a number.
      const elapsed = house.fuse > 0 ? 1 - house.reactTimer / house.fuse : 1;
      if (house.cued < 1 && elapsed >= RING.cueFootsteps) {
        house.cued = 1;
        audio.approach();
      } else if (house.cued < 2 && elapsed >= RING.cueLock) {
        house.cued = 2;
        audio.latch();
        this.camera.addShake(0.08);
      }

      if (house.reactTimer > 0) continue;

      this.openDoor(house);
    }
  }

  private openDoor(house: House): void {
    const distanceToDoor = dist(this.player.x, this.player.y, house.door.x, house.door.y);
    const witnessed = distanceToDoor <= RUN.witnessRadius;

    audio.doorSlam();
    this.camera.addShake(0.22);
    this.ripple(house.door.x, house.door.y, 160, '#ffffff');

    const spawned = this.spawnReaction(house);

    if (!witnessed) {
      // The whole point is being seen legging it. Ring and vanish and you get nothing.
      house.state = 'BURNED';
      this.toast('NOBODY SAW YOU — NO CLIP', '#94a3b8');
      return;
    }

    if (spawned === 0) {
      house.state = 'BURNED';
      return;
    }

    house.state = 'REACTING';
    audio.shout();
  }

  /** Returns how many people came out. */
  private spawnReaction(house: House): number {
    const roster: ChaserKind[] = [];

    switch (house.tier.name) {
      case 'EASY':
        roster.push('RESIDENT');
        break;
      case 'ALERT':
        roster.push('ANGRY');
        break;
      case 'RISKY':
        roster.push('ANGRY');
        break;
      case 'VALUABLE':
        roster.push('SECURITY', 'ANGRY');
        break;
    }

    // A hot neighbourhood answers the door mob-handed — unless you work quietly.
    if (this.heat > 58 && chance(0.4 * this.loadout.mobChance)) roster.push('RESIDENT');
    if (this.heat > 84 && chance(this.loadout.mobChance)) roster.push('ANGRY');

    // A hot street reacts quicker, but never instantly — you always get a beat.
    const startle = 0.64 - this.heatFraction * 0.24;

    for (let i = 0; i < roster.length; i++) {
      const kind = roster[i];
      if (!kind) continue;
      const spread = (i - (roster.length - 1) / 2) * 28;
      this.addChaser(
        kind,
        house.door.x + spread,
        house.door.y + house.facing * 34,
        house.id,
        // Dogs are off the porch before anyone has finished blinking.
        kind === 'DOG' ? startle * 0.55 : startle,
      );
    }

    // Dogs only ever come from a kennel, never out of a door. If you can see a
    // kennel in the garden this house has a dog; if you cannot, it does not.
    if (house.kennel) {
      // It was asleep, and it starts closer to you than anyone coming through a
      // door, so rousing it takes noticeably longer. That wake-up is the window
      // you bought by spotting the kennel before you rang.
      this.addChaser('DOG', house.kennel.x, house.kennel.y, house.id, startle * 1.2);
      audio.bark();
      return roster.length + 1;
    }

    return roster.length;
  }

  private addChaser(
    kind: ChaserKind,
    x: number,
    y: number,
    houseId: number | null,
    startle = 0,
    roams = false,
  ): void {
    const chaser = spawnChaser(kind, x, y, houseId, { startle, roams });

    if (houseId !== null) {
      // Somebody answering their own door heard the bell and looks straight at
      // whoever is legging it. Only they get to start out knowing where you are.
      chaser.lastSeenX = this.player.x;
      chaser.lastSeenY = this.player.y;
    } else {
      // A loose dog or a patrol has no idea you exist yet. It mills about near
      // where it appeared until it actually sees or hears you — being hunted
      // across the street by something you never provoked is not a game.
      chaser.lastSeenX = x + rand(-140, 140);
      chaser.lastSeenY = y + rand(-140, 140);
    }

    this.chasers.push(chaser);
  }

  // ---------------------------------------------------------------- chasing

  private updateChasers(step: number): void {
    const ctx: ChaseContext = {
      player: { x: this.player.x, y: this.player.y },
      playerLit: this.isLit(this.player.x, this.player.y),
      obstacles: this.world.obstacles,
      blockers: this.world.blockers,
      street: {
        minX: 120,
        maxX: WORLD.width - 120,
        minY: WORLD.roadTop + 20,
        maxY: WORLD.roadBottom - 20,
      },
      noiseRadius: this.noiseRadius,
      playerVx: this.player.vx,
      playerVy: this.player.vy,
      trail: this.trail,
      speedBonus: this.heatFraction * HEAT.chaserSpeedBonusAt100,
      sightMultiplier: this.sightModifier,
      step,
      playerHidden: this.phase !== 'ACTIVE',
    };

    for (const chaser of this.chasers) {
      updateChaser(chaser, ctx);

      if (chaser.state === 'CHASE') {
        chaser.noiseTimer -= step;
        if (chaser.noiseTimer <= 0) {
          chaser.noiseTimer = chaser.spec.kind === 'DOG' ? rand(0.7, 1.3) : rand(1.8, 3.4);
          if (chaser.spec.kind === 'DOG') audio.bark();
          else if (chance(0.55)) audio.shout();
        }
      }

      if (
        this.grace <= 0 &&
        chaser.startle <= 0 &&
        chaser.state === 'CHASE' &&
        dist(chaser.x, chaser.y, this.player.x, this.player.y) < RUN.grabRadius + chaser.spec.radius
      ) {
        this.getCaught(chaser);
        return;
      }
    }

    const seenBy = this.chasers.reduce((count, c) => count + (c.state === 'CHASE' ? 1 : 0), 0);
    if (seenBy > 0 && this.seenByCount === 0) {
      // First eyes on you this chase: make it unmissable.
      this.spottedFlash = 1;
      this.camera.addShake(0.26);
      audio.spotted();
    }
    const wasHunted = this.seenByCount > 0;
    this.seenByCount = seenBy;

    if (this.beingHunted) {
      this.sinceHunted = 0;
    } else {
      if (wasHunted && this.sinceHunted === 0) {
        // The exhale: the street goes quiet again.
        audio.allClear();
        this.toast('LOST THEM', '#7dd3fc');
        this.player.rearmSecondWind();
      }
      this.sinceHunted += step;
    }

    this.resolveEscapes();

    // Anyone who has given up walks off and is gone. Patrols included: recycling
    // them into a fresh full-patience hunt meant one person could chase you all
    // night long every time you came near. New pressure arrives as new people.
    for (let i = this.chasers.length - 1; i >= 0; i--) {
      const chaser = this.chasers[i];
      if (!chaser?.done) continue;

      if (chaser.roams) {
        // You lost a patrol. That is supposed to be worth something.
        this.patrolCooldown = PATROL.cooldownAfterLeaving;
        this.toast('PATROL HAS MOVED ON', '#a3e635');
        audio.allClear();
      }
      this.chasers.splice(i, 1);
    }
  }

  /** A house pays out the moment everyone it sent after you has given up. */
  private resolveEscapes(): void {
    for (const house of this.world.houses) {
      if (house.state !== 'REACTING') continue;

      let stillLooking = false;
      let closeCall = false;
      let sawAnyone = false;

      for (const chaser of this.chasers) {
        if (chaser.houseId !== house.id) continue;
        sawAnyone = true;
        if (isActivelyHunting(chaser)) stillLooking = true;
        if (chaser.closeCall) closeCall = true;
      }

      if (stillLooking) continue;
      if (!sawAnyone) {
        // Everyone already despawned; still counts as getting away with it.
        closeCall = false;
      }

      this.payOut(house, closeCall);
    }
  }

  private payOut(house: House, closeCall: boolean): void {
    house.state = 'PAID';

    const base =
      house.reward * house.bonusMultiplier * this.loadout.payoutMultiplier * this.job.payMultiplier;
    const amount = Math.round(base * (closeCall ? 1 + RUN.closeCallBonus : 1));

    this.stash += amount;
    this.clips++;

    audio.cash();
    this.ripple(this.player.x, this.player.y, 120, '#4ade80');
    this.toast(
      closeCall ? `CLOSE CALL!  +$${amount}` : `CLEAN GETAWAY  +$${amount}`,
      closeCall ? '#fbbf24' : '#4ade80',
    );
  }

  private getCaught(chaser: Chaser): void {
    this.phase = 'CAUGHT';
    audio.caught();
    this.camera.addShake(0.7);
    this.toast(`GRABBED BY A ${chaser.spec.label}`, '#f87171');
  }

  private extract(): void {
    this.phase = 'EXTRACTED';

    const quota = this.job.quota;
    if (quota && this.clips >= quota.clips) {
      this.quotaBonus = quota.bonus;
      this.stash += quota.bonus;
      this.toast(`JOB BONUS  +$${quota.bonus}`, '#fbbf24');
    }

    audio.extract();
    this.toast('EXTRACTED', '#4ade80');
  }

  // ---------------------------------------------------------------- systems

  private updateHeat(step: number): void {
    if (this.sinceHunted > HEAT.decayDelay && this.heat > this.heatFloor) {
      this.heat = Math.max(this.heatFloor, this.heat - HEAT.decayPerSecond * step);
    }

    if (this.timeLeft <= 0) {
      this.heat = Math.min(HEAT.max, this.heat + RUN.dawnHeatPerSecond * step);
    }

    this.maxHeat = Math.max(this.maxHeat, this.heat);

    // One sting per tier crossing, so the street audibly tightens around you.
    const tierIndex = HEAT.tiers.filter((tier) => this.heat >= tier.at).length;
    if (tierIndex > this.heatStingAt) {
      const climbing = tierIndex > this.heatStingAt;
      this.heatStingAt = tierIndex;
      if (tierIndex > 1 && climbing) this.escalate(tierIndex);
    } else if (tierIndex < this.heatStingAt) {
      this.heatStingAt = tierIndex;
    }
  }

  /**
   * Each Heat tier does something to the street you can see, not just something
   * to a number. By CRITICAL the whole neighbourhood has its lights on, which
   * takes away the darkness you have been escaping into all night.
   */
  private escalate(tierIndex: number): void {
    audio.heatSting(this.heatFraction);
    this.camera.addShake(0.3);
    this.heatFlash = 1;
    this.toast(`HEAT: ${this.heatTier.name}`, this.heatTier.color);

    // How much of the street wakes up, by tier.
    const share = tierIndex === 2 ? 0.35 : tierIndex === 3 ? 0.7 : 1;
    let lit = 0;
    for (const house of this.world.houses) {
      if (house.state !== 'IDLE') continue;
      if (house.porchLight || !chance(share)) continue;
      house.porchLight = true;
      house.spooked = Math.max(house.spooked, share * 0.6);
      lit++;
    }

    if (tierIndex >= 4) {
      this.toast('EVERY LIGHT ON THE STREET IS ON', '#f87171');
    } else if (lit > 0) {
      this.toast(`${lit} MORE PORCHES LIT UP`, this.heatTier.color);
    }
  }

  private updateClock(step: number): void {
    const wasAboveZero = this.timeLeft > 0;
    this.timeLeft = Math.max(0, this.timeLeft - step);
    if (wasAboveZero && this.timeLeft <= 0) {
      audio.alarm();
      this.toast('SUNRISE — THE STREET IS WAKING UP', '#fb7185');
    }

    this.patrolCooldown = Math.max(0, this.patrolCooldown - step);

    if (this.sightModifierTimer > 0) {
      this.sightModifierTimer -= step;
      if (this.sightModifierTimer <= 0) this.sightModifier = 1;
    }
  }

  /** Heat guarantees patrols even if the random events never roll one. */
  private updatePatrolPressure(): void {
    const due = HEAT.patrolThresholds.filter((threshold) => this.heat >= threshold).length;
    if (due <= this.patrolsSpawned) return;
    // Hold the threshold rather than spending it: the patrol still owes you a
    // visit, it just isn't allowed to arrive on top of the one you just lost.
    if (!this.canSpawnPatrol) return;

    this.patrolsSpawned = due;
    const y = (WORLD.roadTop + WORLD.roadBottom) / 2;
    const fromLeft = this.player.x > WORLD.width / 2;
    this.addChaser(due >= 3 ? 'SECURITY' : 'WATCH', fromLeft ? 60 : WORLD.width - 60, y, null, 0, true);
    audio.alarm();
    this.toast(due >= 3 ? 'SECURITY SWEEPING THE STREET' : 'PATROL ON THE STREET', '#67e8f9');
  }

  private updateDecoys(input: Input, step: number): void {
    if (input.wasPressed('KeyQ') && this.player.decoys > 0 && this.decoyCooldown <= 0) {
      this.player.decoys--;
      this.decoyCooldown = DECOY.cooldown;
      // Lobbed back over your shoulder, not ahead of you. Thrown forwards it
      // pulled everyone onto the route you were escaping along, which made the
      // upgrade actively worse than not owning it.
      const throwDistance = 210;
      const behind = this.player.facing + Math.PI;
      this.decoys.push({
        x: this.player.x + Math.cos(behind) * throwDistance,
        y: this.player.y + Math.sin(behind) * throwDistance,
        fuse: DECOY.fuse,
        flash: 0,
        spent: false,
      });
      audio.thud();
      this.toast('FIRECRACKER OUT', '#fbbf24');
    }

    for (let i = this.decoys.length - 1; i >= 0; i--) {
      const decoy = this.decoys[i];
      if (!decoy) continue;

      if (!decoy.spent) {
        decoy.fuse -= step;
        if (decoy.fuse <= 0) {
          decoy.spent = true;
          decoy.flash = 0.45;
          audio.alarm();
          this.camera.addShake(0.25);
          this.ripple(decoy.x, decoy.y, DECOY.radius, '#fbbf24');

          for (const chaser of this.chasers) {
            if (dist(chaser.x, chaser.y, decoy.x, decoy.y) < DECOY.radius) {
              lureChaser(chaser, decoy.x, decoy.y, DECOY.lure);
            }
          }
        }
      } else {
        decoy.flash -= step;
        if (decoy.flash <= -1.2) this.decoys.splice(i, 1);
      }
    }
  }

  /** Breadcrumbs of where the player has actually been, for scent tracking. */
  private updateTrail(step: number): void {
    this.trailTimer -= step;
    if (this.trailTimer > 0) return;
    this.trailTimer = RUN.trailInterval;

    this.trail.push({ x: this.player.x, y: this.player.y });
    // Quiet feet leave less behind for a dog to work with.
    const keep = Math.max(2, Math.round(this.loadout.trailSeconds / RUN.trailInterval));
    while (this.trail.length > keep) this.trail.shift();
  }

  private updateFootsteps(): void {
    if (this.player.speed < 30) return;
    const interval = this.player.sprinting ? 46 : 72;
    if (this.player.stepPhase - this.stepSound > interval) {
      this.stepSound = this.player.stepPhase;
      audio.footstep();
    }
  }

  private decayEffects(step: number): void {
    if (this.heatFlash > 0) this.heatFlash = Math.max(0, this.heatFlash - step * 1.6);
    if (this.spottedFlash > 0) this.spottedFlash = Math.max(0, this.spottedFlash - step * 1.5);

    for (let i = this.marks.length - 1; i >= 0; i--) {
      const mark = this.marks[i];
      if (!mark) continue;
      mark.life -= step;
      if (mark.life <= 0) this.marks.splice(i, 1);
    }

    for (let i = this.flares.length - 1; i >= 0; i--) {
      const flare = this.flares[i];
      if (!flare) continue;
      flare.life -= step;
      if (flare.life <= 0) this.flares.splice(i, 1);
    }

    for (let i = this.toasts.length - 1; i >= 0; i--) {
      const toast = this.toasts[i];
      if (!toast) continue;
      toast.life -= step;
      if (toast.life <= 0) this.toasts.splice(i, 1);
    }

    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const ripple = this.ripples[i];
      if (!ripple) continue;
      ripple.life -= step * 1.5;
      ripple.radius += (ripple.maxRadius - ripple.radius) * Math.min(1, step * 3.4);
      if (ripple.life <= 0) this.ripples.splice(i, 1);
    }
  }

  // ---------------------------------------------------------------- helpers

  /** Whether the player currently has line of sight to this chaser. */
  canSeeChaser(chaser: { x: number; y: number }): boolean {
    return hasLineOfSight(this.player.x, this.player.y, chaser.x, chaser.y, this.world.blockers);
  }

  /** Lamplight and lit porches make you much easier to spot. */
  isLit(x: number, y: number): boolean {
    // Once the street is awake enough, everyone's lights are on and the dark
    // stops being somewhere to hide. This is what CRITICAL actually costs you.
    if (this.exposure >= 1) return true;

    for (const flare of this.flares) {
      if (dist(x, y, flare.x, flare.y) < flare.radius) return true;
    }
    for (const lamp of this.world.lamps) {
      if (dist(x, y, lamp.x, lamp.y) < lamp.radius * 0.82) return true;
    }
    for (const house of this.world.houses) {
      if (house.floodlit && dist(x, y, house.door.x, house.door.y) < LIGHT.floodlightRadius) {
        return true;
      }
      if (!house.porchLight && house.state !== 'REACTING') continue;
      const reach = LIGHT.porchRadius * (1 + this.exposure * 0.8);
      if (dist(x, y, house.door.x, house.door.y) < reach) return true;
    }
    return false;
  }

  mark(x: number, y: number, label: string, color: string): void {
    this.marks.push({ x, y, label, color, life: 6, maxLife: 6 });
    if (this.marks.length > 3) this.marks.shift();
  }

  toast(text: string, color = '#e6e9f0'): void {
    // Repeating the same line just pushes useful information off screen.
    const existing = this.toasts[this.toasts.length - 1];
    if (existing && existing.text === text) {
      existing.life = existing.maxLife;
      return;
    }
    this.toasts.push({ text, color, life: 3.2, maxLife: 3.2 });
    if (this.toasts.length > 4) this.toasts.shift();
  }

  private ripple(x: number, y: number, maxRadius: number, color: string): void {
    this.ripples.push({ x, y, radius: 8, maxRadius, life: 1, color });
  }
}

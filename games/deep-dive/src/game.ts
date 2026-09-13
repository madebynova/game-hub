import { BOAT, DEPTH_ZONES, OXYGEN, PLAYER, PX_PER_METER } from './config';
import { Sfx } from './core/audio';
import { Input } from './core/input';
import { clamp, formatMoney, rand } from './core/math';
import { clearSave, loadSave, writeSave, type SaveData } from './core/save';
import { RARITIES, slotsOf } from './data/treasures';
import { FIN_CURRENT_RESIST, UPGRADES, upgradeValue, type UpgradeId } from './data/upgrades';
import { Player } from './entities/player';
import { Treasure, TreasureField } from './entities/treasure';
import { Effects } from './render/effects';
import { Renderer, type InteractTarget } from './render/renderer';
import { purchaseUpgrade, sellHaul } from './systems/economy';
import { Haul } from './systems/haul';
import { AirPocketSystem, CollapseSystem, collapsePenalty, flowAt } from './systems/hazards';
import { ObjectiveTracker, describeObjective, fillObjectives, objectiveTier, type Objective } from './systems/objectives';
import { drainRate, oxygenStatus, oxygenToSurface, type OxygenStatus } from './systems/oxygen';
import { objectiveRows, recordDiscovery, recordVisits } from './systems/progression';
import { Announcer } from './ui/announcer';
import { Hud } from './ui/hud';
import { Overlays, type BlackoutInfo } from './ui/overlays';
import { Shop, type ShopData } from './ui/shop';
import { World } from './world/world';
import { ZONES, zoneRank, type ZoneId } from './world/zones';

/**
 * Game states:
 *  - title:    title card over the live scene
 *  - boat:     standing on the deck (the trading deck overlay can be open)
 *  - dive:     in the water — oxygen, treasure, hazards, risk
 *  - blackout: ran out of air; fade out and respawn on the boat
 */
type GameState = 'title' | 'boat' | 'dive' | 'blackout';

const SATCHEL_RECOVER_SECONDS = 1;

export class Game {
  private renderer: Renderer;
  private input = new Input();
  private sfx = new Sfx();
  private save: SaveData = loadSave();
  private world = new World();
  private player = new Player();
  private treasures: TreasureField;
  private haul: Haul;
  private effects = new Effects();
  private hud: Hud;
  private shop: Shop;
  private overlays: Overlays;
  private announcer: Announcer;
  private collapses: CollapseSystem;
  private pockets: AirPocketSystem;
  private tracker: ObjectiveTracker;

  private state: GameState = 'title';
  private time = 0;
  private lastFrame = 0;
  private oxygen: number;
  private status: OxygenStatus = 'ok';
  private drowning = 0;
  private underwaterTime = 0;
  private diveMaxDepth = 0;
  private warnTimer = 0;
  private bubbleTimer = 0;
  private heartbeatTimer = 0;
  private pryTimer = 0;
  private warnedLow = false;
  private warnedCritical = false;
  private target: Treasure | 'satchel' | null = null;
  private satchelProgress = 0;
  private blackoutTimer = 0;
  private blackoutInfo: BlackoutInfo | null = null;
  /** Brief freeze on big discoveries so they land. */
  private hitstop = 0;
  private zone: ZoneId | null = null;
  private diveDeepestRank = -1;
  private currentName: string | null = null;
  private inAirPocket = false;
  private groanTimer = 8;

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    this.renderer = new Renderer(canvas);
    this.treasures = new TreasureField(this.world.spawns);
    this.haul = new Haul(this.bagCapacity);
    this.oxygen = this.maxOxygen;
    this.sfx.muted = this.save.muted;
    this.player.placeOnDeck();
    this.collapses = new CollapseSystem(this.world.collapses);
    this.pockets = new AirPocketSystem(this.world.airPockets);
    this.migrateSave();
    this.tracker = new ObjectiveTracker(this.save.objectives);

    this.hud = new Hud(uiRoot);
    this.shop = new Shop(uiRoot, {
      onSell: () => this.sell(),
      onBuy: (id) => this.buy(id),
      onDive: () => this.startDive(true),
      onClose: () => this.closeShop(),
      onReset: () => this.resetSave(),
    });
    this.overlays = new Overlays(uiRoot);
    this.announcer = new Announcer(uiRoot);
    const returning = this.save.stats.dives > 0 ? { cash: this.save.cash, dives: this.save.stats.dives } : null;
    this.overlays.showTitle(() => this.begin(), returning);

    window.addEventListener('resize', () => this.renderer.resize());
    if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = this;
  }

  start() {
    requestAnimationFrame((t) => {
      this.lastFrame = t;
      requestAnimationFrame(this.frame);
    });
  }

  /** Bring older saves up to date with the Phase 2 world without touching their progress. */
  private migrateSave() {
    const sat = this.save.lostSatchel;
    if (sat) Object.assign(sat, this.world.clampToOpenWater(sat.x, sat.y));
    fillObjectives(this.save.objectives, objectiveTier(this.save.stats.zonesVisited), Math.random, this.save.stats.zonesVisited);
    this.persist();
  }

  // ------------------------------------------------------------------ derived stats

  get maxOxygen() {
    return upgradeValue('tank', this.save.upgrades.tank);
  }

  get bagCapacity() {
    return upgradeValue('bag', this.save.upgrades.bag);
  }

  get lightRadius() {
    return upgradeValue('light', this.save.upgrades.light);
  }

  get finSpeed() {
    return upgradeValue('fins', this.save.upgrades.fins);
  }

  get finResist() {
    return FIN_CURRENT_RESIST[this.save.upgrades.fins] ?? 0;
  }

  get swimSpeed() {
    return PLAYER.maxSpeed * this.finSpeed;
  }

  // ------------------------------------------------------------------ loop

  private frame = (now: number) => {
    const dt = Math.min(0.05, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.update(dt);
    this.draw(dt);
    this.input.endFrame();
    requestAnimationFrame(this.frame);
  };

  private update(dt: number) {
    this.time += dt;
    if (this.input.wasPressed('KeyM')) this.toggleMute();

    switch (this.state) {
      case 'title':
        if (this.input.wasPressed('Space', 'Enter')) this.begin();
        break;
      case 'boat':
        this.updateBoat(dt);
        break;
      case 'dive':
        if (this.hitstop > 0) this.hitstop -= dt;
        else this.updateDive(dt);
        break;
      case 'blackout':
        this.updateBlackout(dt);
        break;
    }

    this.effects.update(dt);
    this.updateCamera(dt);
    const p = this.player;
    this.sfx.setUnderwater(p.mode === 'swim' && !p.atSurface ? clamp(p.depth / 2500, 0.35, 1) : 0);
    this.updateHud(dt);
  }

  private draw(dt: number) {
    const p = this.player;
    let interact: InteractTarget | null = null;
    if (this.state === 'dive' && this.target) {
      if (this.target === 'satchel' && this.save.lostSatchel) {
        const s = this.save.lostSatchel;
        interact = { x: s.x, y: s.y, progress: this.satchelProgress, color: '#ffb547', blocked: this.haul.freeSlots === 0 };
      } else if (this.target instanceof Treasure) {
        const t = this.target;
        interact = { x: t.x, y: t.y, progress: t.progress, color: RARITIES[t.item.rarity].color, blocked: !this.haul.canFit(t.item) };
      }
    }
    const visibility = p.mode === 'swim' ? ZONES[this.world.zoneAt(p.x, p.y)].visibility : 1;
    this.renderer.render({
      time: this.time,
      dt,
      world: this.world,
      player: p,
      treasures: this.treasures,
      effects: this.effects,
      satchel: this.save.lostSatchel,
      lightRadius: this.lightRadius * visibility,
      interact,
      oxygenStatus: this.state === 'dive' ? this.status : 'ok',
      drowning: clamp(this.drowning / OXYGEN.graceSeconds, 0, 1),
      fade: this.state === 'blackout' ? clamp(this.blackoutTimer / 1.2, 0, 1) : 0,
      collapses: this.collapses.states,
      airPockets: this.pockets,
    });
  }

  private updateCamera(dt: number) {
    const p = this.player;
    if (this.state === 'title') return this.renderer.follow(BOAT.x + 140, -30, dt, 2);
    if (this.state === 'blackout') return;
    if (p.mode === 'deck') return this.renderer.follow(p.x + 80, p.y + 90, dt, 3);
    this.renderer.follow(p.x + p.vx * 0.35, p.y + p.vy * 0.25 + 30, dt, 3.5);
  }

  private updateHud(dt: number) {
    const p = this.player;
    const underwater = p.mode === 'swim' && !p.atSurface;
    this.hud.update({
      visible: this.state !== 'title',
      oxygen: this.oxygen,
      maxOxygen: this.maxOxygen,
      needed: p.mode === 'swim' ? oxygenToSurface(p.depth, this.swimSpeed) : 0,
      status: this.state === 'dive' ? this.status : 'ok',
      refilling: p.atSurface && this.oxygen < this.maxOxygen,
      depthM: Math.round(p.depth / PX_PER_METER),
      bestDepthM: Math.max(this.save.stats.bestDepthM, Math.round(this.diveMaxDepth / PX_PER_METER)),
      onBoat: p.mode === 'deck',
      zone: underwater && this.zone ? ZONES[this.zone] : null,
      airUse: drainRate(p.depth),
      currentName: underwater ? this.currentName : null,
      inAirPocket: this.inAirPocket,
      haulValue: this.haul.total,
      haulCount: this.haul.count,
      usedSlots: this.haul.usedSlots,
      bagCapacity: this.haul.capacity,
      cash: this.save.cash,
      objectives: objectiveRows(this.tracker, this.haul.total),
    }, dt);
  }

  // ------------------------------------------------------------------ title

  private begin() {
    if (this.state !== 'title') return;
    this.sfx.unlock();
    this.overlays.hideTitle();
    this.state = 'boat';
    this.hint('start', 'Welcome aboard! Walk off the stern or press <kbd>Space</kbd> to dive in.', 6);
    this.hint('objectives', 'New: <b>dive objectives</b> (top-left) pay bonus cash when you make it back aboard.', 6);
    if (this.save.lostSatchel) {
      this.hud.toast(`Your lost satchel is still down at ${Math.round(this.save.lostSatchel.y / PX_PER_METER)}m`, 'warn', 4);
    }
  }

  // ------------------------------------------------------------------ boat

  private updateBoat(dt: number) {
    const p = this.player;
    if (this.shop.isOpen) {
      p.updateDeck(dt, 0);
      this.hud.setPrompt(null);
      if (this.input.wasPressed('Escape', 'KeyE')) this.closeShop();
      else if (this.input.wasPressed('Space')) this.startDive(true);
      return;
    }
    this.hud.setPrompt('<kbd>E</kbd> Trade &amp; upgrade <span class="sep"></span> <kbd>Space</kbd> Dive in');
    if (this.input.wasPressed('KeyE', 'Enter')) return this.openShop();
    if (this.input.wasPressed('Space', 'KeyS', 'ArrowDown')) return this.startDive(true);
    if (p.updateDeck(dt, this.input.axis().x)) this.startDive(false);
  }

  private openShop() {
    this.shop.open(this.shopData());
    this.sfx.click();
  }

  private closeShop() {
    this.shop.close();
    this.sfx.click();
  }

  private shopData(): ShopData {
    return {
      cash: this.save.cash,
      items: this.haul.items,
      total: this.haul.total,
      usedSlots: this.haul.usedSlots,
      capacity: this.haul.capacity,
      upgrades: this.save.upgrades,
      satchel: this.save.lostSatchel,
      stats: this.save.stats,
      objectives: objectiveRows(this.tracker, this.haul.total),
      discovered: this.save.discovered.length,
    };
  }

  private sell() {
    const count = this.haul.count;
    const earned = sellHaul(this.save, this.haul);
    if (!earned) return this.sfx.deny();
    this.sfx.sell(count);
    this.hud.cashPop(earned);
    this.hud.toast(`Sold ${count} item${count > 1 ? 's' : ''} for <b>${formatMoney(earned)}</b>`, 'good', 2.5);
    this.effects.burst(this.player.x, this.player.y - 10, '#ffd35a', 40, 240);
    this.effects.text(this.player.x, this.player.y - 50, `+${formatMoney(earned)}`, '#7dffb0', { big: true, life: 2 });
    this.persist();
    if (this.shop.isOpen) this.shop.refresh(this.shopData(), { sold: earned });
  }

  private buy(id: UpgradeId) {
    const res = purchaseUpgrade(this.save, id);
    if (!res.ok) {
      this.sfx.deny();
      this.shop.shake(id);
      if (res.reason === 'funds') this.hud.toast('Not enough cash — go find more treasure!', 'bad', 2);
      return;
    }
    this.sfx.upgrade();
    this.haul.capacity = this.bagCapacity;
    this.oxygen = this.maxOxygen;
    this.hud.cashPop(-res.cost);
    this.hud.toast(`${UPGRADES[id].icon} <b>${UPGRADES[id].name}</b> upgraded to Lv ${res.level + 1}!`, 'good', 2.5);
    this.effects.burst(this.player.x, this.player.y, '#7fe3ff', 30, 200);
    this.persist();
    this.shop.refresh(this.shopData(), { upgraded: id });
  }

  private startDive(jump: boolean) {
    if (this.state !== 'boat') return;
    if (this.haul.count > 0) this.sell(); // treasure never goes back down unsold
    this.shop.close();
    this.treasures.restock();
    this.collapses.reset();
    this.pockets.reset();
    this.tracker.startDive();
    this.save.stats.dives++;
    this.oxygen = this.maxOxygen;
    this.drowning = 0;
    this.diveMaxDepth = 0;
    this.underwaterTime = 0;
    this.warnedLow = this.warnedCritical = false;
    this.target = null;
    this.hitstop = 0;
    this.zone = null;
    this.diveDeepestRank = -1;
    this.currentName = null;
    this.inAirPocket = false;
    if (jump) this.player.jumpIn();
    this.state = 'dive';
    this.hud.setPrompt(null);
    this.persist();
  }

  // ------------------------------------------------------------------ dive

  private updateDive(dt: number) {
    const p = this.player;
    if (p.mode === 'airborne') {
      if (p.updateAirborne(dt)) {
        this.effects.splash(p.x, 0);
        this.sfx.splash();
        this.hint('collect', 'Treasure glints on the seafloor. Swim close and hold <kbd>E</kbd> to collect it.', 6);
      }
      return;
    }

    const { x: ax, y: ay } = this.input.axis();
    const wasSurface = p.atSurface;
    const flow = flowAt(this.world.currents, p.x, p.y, this.finResist);
    p.updateSwim(dt, ax, ay, this.world, this.finSpeed * (this.drowning > 0 ? 0.75 : 1), flow.fx, flow.fy);
    this.currentName = flow.strength > 0.3 && flow.current ? flow.current.name : null;
    if (this.currentName) this.hint('current', 'Strong current! It will carry you — <b>Power Fins</b> help you fight it.', 6);
    this.diveMaxDepth = Math.max(this.diveMaxDepth, p.depth);

    if (p.atSurface) {
      if (!wasSurface && this.underwaterTime > 1.2) this.onSurfaced();
      this.underwaterTime = 0;
      this.drowning = 0;
      this.zone = null;
      this.oxygen = Math.min(this.maxOxygen, this.oxygen + OXYGEN.refillRate * dt);
    } else {
      if (wasSurface) for (let i = 0; i < 6; i++) this.effects.bubble(p.x + rand(-12, 12), p.y + rand(0, 16));
      this.underwaterTime += dt;
      this.oxygen = Math.max(0, this.oxygen - drainRate(p.depth) * dt);
      if (this.oxygen <= 0) {
        if (this.drowning === 0) this.hud.toast('<b>Out of air!</b> Get to the surface!', 'bad', 3);
        this.drowning += dt;
        this.heartbeatTimer -= dt;
        if (this.heartbeatTimer <= 0) {
          this.sfx.heartbeat();
          this.heartbeatTimer = 0.95 - (this.drowning / OXYGEN.graceSeconds) * 0.45;
        }
        if (this.drowning >= OXYGEN.graceSeconds) return this.blackout();
      }
    }

    this.updateAirPocket(dt);
    this.updateCollapses(dt);
    this.updateZones(dt);
    this.updateOxygenWarnings(dt);
    this.updateBubbles(dt);
    this.updateInteraction(dt);
  }

  private onSurfaced() {
    const p = this.player;
    this.sfx.breathe();
    this.effects.splash(p.x, 0, 0.5);
    const close = this.drowning > 0 || this.status === 'critical';
    this.effects.text(p.x, p.y - 40, close ? 'Gasp! That was close.' : 'Fresh air', close ? '#ffd27a' : '#bdf3ff');
    this.warnedLow = this.warnedCritical = false;
    if (this.haul.count > 0) {
      this.hint('sell', 'Breathing is free — but treasure only becomes cash once you <b>sell it on the boat</b>.', 6);
    }
  }

  private updateAirPocket(dt: number) {
    const p = this.player;
    if (p.atSurface) {
      this.inAirPocket = false;
      return;
    }
    const { gained, pocket } = this.pockets.update(dt, p.x, p.y, this.oxygen, this.maxOxygen);
    this.inAirPocket = gained > 0;
    if (pocket && this.pockets.fraction(pocket.id) > 0) {
      this.hint('pocket', 'Trapped air! Stay inside to top up your tank — each pocket only holds so much.', 6);
    }
    if (gained > 0) {
      this.oxygen += gained;
      this.drowning = 0;
      if (Math.random() < dt * 5) {
        this.effects.bubble(p.x + rand(-10, 10), p.y - 10, rand(2, 5));
        this.sfx.airPocket();
      }
    }
  }

  private updateCollapses(dt: number) {
    const p = this.player;
    for (const e of this.collapses.update(dt, p.x, p.y)) {
      const r = e.state.def.rect;
      if (e.type === 'warning') {
        this.sfx.rumble();
        this.renderer.shake(3);
        this.effects.debris(r.x0, r.x1, r.y0, 20);
        this.hud.toast('<b>The wreck groans</b> — get clear!', 'warn', 1.6);
        this.hint('collapse', 'Cracked beams mean unstable wreckage. Dash through, or find another way in.', 6);
        continue;
      }
      this.sfx.debris();
      this.renderer.shake(e.hit ? 14 : 6);
      this.effects.debris(r.x0, r.x1, r.y0, 60);
      if (e.hit) {
        const loss = collapsePenalty(this.maxOxygen);
        this.oxygen = Math.max(0, this.oxygen - loss);
        p.vy += 240;
        this.hud.flashOxygen();
        this.effects.text(p.x, p.y - 30, `−${loss} air`, '#ff8a8a', { sub: 'Caught under falling debris' });
        for (let i = 0; i < 16; i++) this.effects.bubble(p.x + rand(-14, 14), p.y + rand(-14, 6), rand(2, 6));
      }
    }
  }

  private updateZones(dt: number) {
    const p = this.player;
    if (p.atSurface || p.depth < 24) return;
    const depthM = Math.round(p.depth / PX_PER_METER);
    const zone = this.world.zoneAt(p.x, p.y);
    const areas = this.world.areasAt(p.x, p.y);
    const firstTimes = recordVisits(this.save, [zone, ...areas]);
    if (firstTimes.length) this.persist();
    this.onObjectivesCompleted(this.tracker.recordVisit(areas));
    this.onObjectivesCompleted(this.tracker.recordDepth(depthM));

    if (zone !== this.zone) {
      this.zone = zone;
      const rank = zoneRank(zone);
      const first = firstTimes.includes(zone);
      if (first || rank > this.diveDeepestRank) {
        this.announcer.zone(ZONES[zone], depthM, first);
        this.sfx.zoneEnter(rank);
      }
      this.diveDeepestRank = Math.max(this.diveDeepestRank, rank);
      if (zone === 'wreck') this.hint('wreck', 'The Wreck: richer salvage inside, but tight gaps and rotten beams.', 6);
      if (zone === 'abyss') {
        this.hint('pressure', 'The Abyss: crushing pressure <b>more than doubles</b> your air use.', 6);
        if (this.save.upgrades.tank <= 3) this.hint('deepgear', 'Deep-rated tanks and lights are on sale aboard — the abyss is built to test them.', 6);
      }
    }

    if (p.depth > DEPTH_ZONES.abyss) {
      this.groanTimer -= dt;
      if (this.groanTimer <= 0) {
        this.sfx.pressureGroan();
        this.renderer.shake(1.5);
        this.groanTimer = rand(7, 14);
      }
    }
  }

  private onObjectivesCompleted(done: Objective[]) {
    for (const o of done) {
      this.sfx.objective();
      this.hud.toast(`✓ <b>${describeObjective(o)}</b> — +${formatMoney(o.reward)} when you're back aboard`, 'good', 3.5);
    }
  }

  private updateOxygenWarnings(dt: number) {
    const p = this.player;
    this.status = p.atSurface ? 'ok' : oxygenStatus(this.oxygen, this.maxOxygen, p.depth, this.swimSpeed);
    if (p.atSurface) return;
    if (this.oxygen / this.maxOxygen < 0.65) {
      this.hint('oxygen', 'Air drains faster the deeper you go. Surface <b>anywhere</b> to breathe.', 6);
    }
    if (this.status === 'low' || this.status === 'critical') {
      const critical = this.status === 'critical';
      this.warnTimer -= dt;
      if (this.warnTimer <= 0) {
        this.sfx.warn(critical);
        this.warnTimer = critical ? 1.1 : 2.4;
      }
      if (!critical && !this.warnedLow) {
        this.warnedLow = true;
        this.hud.toast('Oxygen low', 'warn', 2.5);
      }
      if (critical && !this.warnedCritical) {
        this.warnedCritical = this.warnedLow = true;
        this.hud.toast('<b>Oxygen critical</b> — head up now!', 'bad', 3);
        this.hint('marker', 'The white marker on your air gauge shows the air needed to swim straight up.', 6);
      }
    }
  }

  private updateBubbles(dt: number) {
    const p = this.player;
    if (p.atSurface) return;
    this.bubbleTimer -= dt;
    if (this.bubbleTimer > 0) return;
    this.bubbleTimer = this.oxygen <= 0 ? rand(0.8, 1.4) : rand(0.35, 0.8);
    const hx = p.x + Math.cos(p.angle) * 24;
    const hy = p.y + Math.sin(p.angle) * 24;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) this.effects.bubble(hx + rand(-3, 3), hy - i * 4);
    if (Math.random() < 0.35) this.sfx.bubble();
  }

  private updateInteraction(dt: number) {
    const p = this.player;

    if (p.atSurface && p.x > BOAT.boardLeft && p.x < BOAT.boardRight) {
      this.setTarget(null);
      const secure = this.haul.count ? ` &amp; secure <b>${formatMoney(this.haul.total)}</b>` : '';
      this.hud.setPrompt(`<kbd>E</kbd> Climb aboard${secure}`);
      if (this.input.wasPressed('KeyE')) this.board();
      return;
    }

    const sat = this.save.lostSatchel;
    let target: Treasure | 'satchel' | null = null;
    if (sat && Math.hypot(sat.x - p.x, sat.y - p.y) < PLAYER.interactRadius + 14) target = 'satchel';
    else target = this.treasures.nearest(p.x, p.y, PLAYER.interactRadius);
    this.setTarget(target);

    const holding = this.input.isDown('KeyE');
    let prompt: string | null = null;

    if (target === 'satchel' && sat) {
      if (this.haul.freeSlots === 0) {
        prompt = '<span class="bad">Bag full</span> — sell first, then recover your lost satchel';
        this.satchelProgress = 0;
      } else {
        prompt = `Hold <kbd>E</kbd> Recover lost satchel <span class="muted">· ${sat.items.length} items</span>`;
        this.satchelProgress = holding ? this.satchelProgress + dt / SATCHEL_RECOVER_SECONDS : Math.max(0, this.satchelProgress - dt * 3);
        if (holding) this.pryTicks(dt);
        if (this.satchelProgress >= 1) this.recoverSatchel();
      }
    } else if (target instanceof Treasure) {
      const r = RARITIES[target.item.rarity];
      const slots = slotsOf(target.item);
      if (!this.haul.canFit(target.item)) {
        prompt = this.haul.isFull
          ? `<span class="bad">Bag full (${this.haul.usedSlots}/${this.haul.capacity})</span> — return to the boat to sell`
          : `<span class="bad">${target.item.name} needs ${slots} slots</span> — only ${this.haul.freeSlots} free`;
        target.progress = 0;
        if (this.input.wasPressed('KeyE')) {
          this.sfx.deny();
          this.hud.shakeBag();
        }
      } else {
        const heavy = slots > 1 ? ` <span class="muted">· heavy, ${slots} slots</span>` : '';
        prompt = `Hold <kbd>E</kbd> Collect <b style="color:${r.color}">${target.item.name}</b> <span class="muted">· ${r.label}</span>${heavy}`;
        if (holding) {
          target.progress += dt / r.pryTime;
          if (r.pryTime > 0.3) this.pryTicks(dt);
          if (target.progress >= 1) this.collect(target);
        } else {
          target.progress = Math.max(0, target.progress - dt * 3);
        }
      }
    } else if (this.haul.isFull) {
      prompt = '<span class="bad">Bag full</span> — head back to the boat to sell';
    } else if (p.atSurface && this.haul.count > 0) {
      const dir = p.x < BOAT.x ? '→' : '←';
      prompt = `Boat ${dir} ${Math.round(Math.abs(p.x - BOAT.x) / PX_PER_METER)}m — sell your ${formatMoney(this.haul.total)} haul`;
    }
    this.hud.setPrompt(prompt);
  }

  private setTarget(target: Treasure | 'satchel' | null) {
    if (target === this.target) return;
    if (this.target instanceof Treasure) this.target.progress = 0;
    this.satchelProgress = 0;
    this.target = target;
  }

  private pryTicks(dt: number) {
    this.pryTimer -= dt;
    if (this.pryTimer <= 0) {
      this.pryTimer = 0.13;
      this.sfx.pryTick();
      const t = this.target;
      const pos = t === 'satchel' ? this.save.lostSatchel : t;
      if (pos) this.effects.burst(pos.x + rand(-6, 6), pos.y + 8, 'rgba(220,200,160,0.8)', 2, 50);
    }
  }

  private collect(t: Treasure) {
    const item = t.item;
    if (!this.haul.add(item)) return;
    t.collected = true;
    this.target = null;
    const r = RARITIES[item.rarity];
    const isNew = recordDiscovery(this.save, item.defId);
    this.sfx.pickup(item.rarity);
    this.hud.bumpHaul();

    if (r.tier >= 2) {
      // A discovery moment: freeze, burst, card, sting.
      this.effects.discovery(t.x, t.y, r.color, r.tier);
      this.effects.text(t.x, t.y - 24, `+${formatMoney(item.value)}`, r.color, { big: true, life: 2 });
      this.announcer.discovery(item, isNew);
      this.sfx.discovery(r.tier);
      this.hitstop = 0.08 + r.tier * 0.04;
      this.renderer.shake(r.tier >= 4 ? 10 : r.tier * 2);
    } else {
      this.effects.burst(t.x, t.y, r.color, 14 + r.tier * 10, 120 + r.tier * 45);
      this.effects.text(t.x, t.y - 24, `+${formatMoney(item.value)}`, r.color, { sub: `${item.name} · ${r.label}${isNew ? ' · New find!' : ''}` });
      if (isNew) this.sfx.newDiscovery();
    }

    if (slotsOf(item) > 1) this.hint('heavy', `Heavy treasure takes <b>${slotsOf(item)} bag slots</b>. A bigger Dive Bag carries more.`, 6);
    this.hint('haul', 'That treasure is <b>at risk</b> until you sell it. Run out of air and it sinks with you.', 6.5);
    this.onObjectivesCompleted(this.tracker.recordCollect(item));
    if (this.haul.isFull) this.hud.toast('Bag full — time to head back', 'warn', 2.5);
    if (isNew) this.persist();
  }

  private recoverSatchel() {
    const sat = this.save.lostSatchel;
    if (!sat) return;
    const leftover = this.haul.addMany(sat.items);
    const got = sat.items.length - leftover.length;
    const value = sat.items.filter((i) => !leftover.includes(i)).reduce((s, i) => s + i.value, 0);
    this.save.lostSatchel = leftover.length ? { ...sat, items: leftover } : null;
    this.effects.burst(sat.x, sat.y, '#ffb547', 36, 220);
    this.effects.text(sat.x, sat.y - 30, `Recovered ${got} item${got === 1 ? '' : 's'}`, '#ffcf7a', { sub: formatMoney(value), big: true });
    this.sfx.pickup('epic');
    this.hud.bumpHaul();
    this.setTarget(null);
    this.persist();
  }

  private board() {
    const p = this.player;
    this.recordDepth();
    p.placeOnDeck(clamp(p.x, BOAT.deckLeft + 60, BOAT.deckRight - 30));
    this.state = 'boat';
    this.oxygen = this.maxOxygen;
    this.drowning = 0;
    this.status = 'ok';
    this.zone = null;
    this.effects.splash(p.x, 0, 0.4);
    this.sfx.breathe();
    this.hud.setPrompt(null);

    this.tracker.evaluateBoarding(this.haul.total);
    this.claimObjectives();

    if (this.haul.count > 0) {
      this.hud.toast(`Haul secured aboard — <b>${formatMoney(this.haul.total)}</b>`, 'good', 2.5);
      this.openShop();
    } else {
      this.hud.toast('Back aboard', 'info', 1.5);
    }
    this.persist();
  }

  private claimObjectives() {
    const claimed = this.tracker.claim();
    if (!claimed.length) return;
    const total = claimed.reduce((s, o) => s + o.reward, 0);
    this.save.cash += total;
    this.save.stats.totalEarned += total;
    this.save.stats.objectivesDone += claimed.length;
    this.hud.cashPop(total);
    this.sfx.objective();
    for (const o of claimed) this.hud.toast(`Objective reward <b>+${formatMoney(o.reward)}</b> · ${describeObjective(o)}`, 'good', 3.5);
    fillObjectives(this.save.objectives, objectiveTier(this.save.stats.zonesVisited), Math.random, this.save.stats.zonesVisited);
  }

  private recordDepth() {
    this.save.stats.bestDepthM = Math.max(this.save.stats.bestDepthM, Math.round(this.diveMaxDepth / PX_PER_METER));
  }

  // ------------------------------------------------------------------ blackout

  private blackout() {
    const p = this.player;
    const lost = this.haul.clear();
    const valueLost = lost.reduce((s, i) => s + i.value, 0);
    if (lost.length) {
      const prev = this.save.lostSatchel?.items ?? [];
      this.save.lostSatchel = { x: p.x, y: p.y, items: [...prev, ...lost] };
    }
    this.recordDepth();
    this.tracker.failDive();
    this.blackoutInfo = { itemsLost: lost.length, valueLost, depthM: Math.round(p.depth / PX_PER_METER) };
    this.state = 'blackout';
    this.blackoutTimer = 0;
    this.zone = null;
    this.inAirPocket = false;
    this.currentName = null;
    this.setTarget(null);
    this.hud.setPrompt(null);
    this.sfx.blackout();
    this.persist();
  }

  private updateBlackout(dt: number) {
    this.blackoutTimer += dt;
    if (this.blackoutTimer > 1.4 && this.blackoutInfo) {
      this.overlays.showBlackout(this.blackoutInfo, () => this.respawn());
      this.blackoutInfo = null;
    }
    if (this.overlays.blackoutVisible && this.input.wasPressed('Space', 'Enter')) this.respawn();
  }

  private respawn() {
    if (this.state !== 'blackout') return;
    this.overlays.hideBlackout();
    this.player.placeOnDeck();
    this.oxygen = this.maxOxygen;
    this.drowning = 0;
    this.status = 'ok';
    this.state = 'boat';
    this.renderer.cam.y = 0;
    this.sfx.breathe();
    if (this.save.lostSatchel) {
      this.hint('satchel', 'Your lost satchel glows where you blacked out. Recover it to get your treasure back.', 6);
    }
  }

  // ------------------------------------------------------------------ misc

  private hint(id: string, html: string, seconds = 5) {
    if (this.save.seenHints.includes(id)) return;
    this.save.seenHints.push(id);
    this.hud.toast(html, 'hint', seconds);
    this.persist();
  }

  private toggleMute() {
    this.save.muted = !this.save.muted;
    this.sfx.setMuted(this.save.muted);
    this.hud.toast(this.save.muted ? 'Sound off' : 'Sound on', 'info', 1.2);
    this.persist();
  }

  private resetSave() {
    if (!window.confirm('Reset all progress? Your cash and upgrades will be lost.')) return;
    clearSave();
    window.location.reload();
  }

  private persist() {
    writeSave(this.save);
  }
}

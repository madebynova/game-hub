/**
 * RUNOUT — DING DONG
 *
 * Top level state machine:
 *   TITLE  →  RUN  →  SUMMARY  →  SHOP  →  RUN  →  ...
 *
 * The run itself lives in run.ts; this file owns the meta loop — the money, the
 * upgrades, and the screens between one night and the next.
 */

import { audio } from '../engine/audio';
import type { Input } from '../engine/input';
import type { Stage } from '../engine/stage';
import { drawHud } from './hud';
import { Renderer } from './render';
import { Run, type RunSummary } from './run';
import { loadSave, writeSave, type SaveData } from './save';
import { buttonAt, drawShop, drawSummary, drawTitle, type ButtonList } from './screens';
import { UPGRADES, buildLoadout, retentionFor, upgradeCost } from './upgrades';

type Screen = 'TITLE' | 'RUN' | 'SUMMARY' | 'SHOP';

export class Game {
  private screen: Screen = 'TITLE';
  private save: SaveData = loadSave();
  private renderer = new Renderer();
  private run: Run | null = null;
  private lastSummary: RunSummary | null = null;
  private buttons: ButtonList = [];
  private shopMessage = '';
  /** Stops a single click from being consumed by two screens in a row. */
  private inputLock = 0;

  constructor(
    private readonly stage: Stage,
    private readonly input: Input,
  ) {}

  update(step: number): void {
    this.inputLock = Math.max(0, this.inputLock - step);

    if (this.input.wasPressed('KeyM')) {
      const muted = audio.toggleMute();
      this.run?.toast(muted ? 'SOUND OFF' : 'SOUND ON', '#8b94a8');
    }

    switch (this.screen) {
      case 'TITLE':
        if (this.confirmPressed()) this.startRun();
        break;

      case 'RUN':
        this.updateRun(step);
        break;

      case 'SUMMARY':
        if (this.confirmPressed()) {
          this.screen = 'SHOP';
          this.shopMessage = '';
          this.lock();
        }
        break;

      case 'SHOP':
        this.updateShop();
        break;
    }
  }

  render(): void {
    const { ctx, width, height } = this.stage;
    ctx.fillStyle = '#0b0d12';
    ctx.fillRect(0, 0, width, height);

    switch (this.screen) {
      case 'TITLE':
        this.buttons = drawTitle(this.stage, this.save);
        break;

      case 'RUN':
        if (this.run) {
          this.renderer.draw(this.stage, this.run);
          drawHud(this.stage, this.run, this.save.cash);
          this.drawRunOutro(this.run);
        }
        break;

      case 'SUMMARY':
        if (this.lastSummary) this.buttons = drawSummary(this.stage, this.lastSummary, this.save);
        break;

      case 'SHOP':
        this.buttons = drawShop(this.stage, this.save, this.shopMessage);
        break;
    }
  }

  // -------------------------------------------------------------------- run

  private startRun(): void {
    this.run = new Run(buildLoadout(this.save.upgrades));
    this.run.camera.snapTo(this.run.player.x, this.run.player.y, this.stage);
    this.screen = 'RUN';
    this.lock();

    this.save.stats.runs++;
    this.persist();
  }

  private updateRun(step: number): void {
    const run = this.run;
    if (!run) return;

    run.update(this.input, this.stage, step);

    if (run.phase === 'ACTIVE') return;

    // Hold on the world for a beat so the bust or the getaway lands.
    this.outroTimer += step;
    if (this.outroTimer < OUTRO_SECONDS) return;

    this.finishRun(run);
  }

  private outroTimer = 0;

  private finishRun(run: Run): void {
    const summary = run.summary();
    this.lastSummary = summary;
    this.outroTimer = 0;

    this.save.stats.doorbells += summary.doorbells;
    if (summary.outcome === 'EXTRACTED') {
      this.save.cash += summary.stash;
      this.save.stats.totalEarned += summary.stash;
      this.save.stats.extractions++;
      this.save.stats.bestRun = Math.max(this.save.stats.bestRun, summary.stash);
    } else {
      // Anything posted into a drainpipe on the way survives the bust.
      summary.recovered = Math.round(summary.stash * retentionFor(this.save.upgrades['charm'] ?? 0));
      this.save.cash += summary.recovered;
      this.save.stats.totalEarned += summary.recovered;
      this.save.stats.busts++;
    }
    this.persist();

    this.run = null;
    this.screen = 'SUMMARY';
    this.lock();
  }

  /** Full-screen wash over the frozen world while the outro plays. */
  private drawRunOutro(run: Run): void {
    if (run.phase === 'ACTIVE') return;

    const { ctx, width, height } = this.stage;
    const t = Math.min(1, this.outroTimer / 0.7);
    const won = run.phase === 'EXTRACTED';

    ctx.save();
    ctx.fillStyle = won ? `rgba(6, 24, 14, ${0.7 * t})` : `rgba(30, 6, 10, ${0.72 * t})`;
    ctx.fillRect(0, 0, width, height);

    ctx.globalAlpha = t;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${Math.min(74, width / 9)}px system-ui, sans-serif`;
    ctx.fillStyle = won ? '#4ade80' : '#f87171';
    ctx.fillText(won ? 'EXTRACTED' : 'BUSTED', width / 2, height / 2 - 10);

    ctx.font = '700 16px system-ui, sans-serif';
    ctx.fillStyle = won ? 'rgba(226, 255, 235, 0.85)' : 'rgba(255, 226, 230, 0.85)';
    ctx.fillText(
      won ? `+$${run.stash} banked` : run.stash > 0 ? `$${run.stash} was on you` : 'nothing to lose, at least',
      width / 2,
      height / 2 + 42,
    );
    ctx.restore();
  }

  // ------------------------------------------------------------------- shop

  private updateShop(): void {
    for (let i = 0; i < UPGRADES.length; i++) {
      const upgrade = UPGRADES[i];
      if (upgrade && this.input.wasPressed(`Digit${i + 1}`)) this.buy(upgrade.id);
    }

    if (this.confirmPressed()) {
      this.startRun();
      return;
    }

    const clicked = this.clickedButton();
    if (!clicked) return;

    if (clicked.id === 'primary') this.startRun();
    else if (clicked.id.startsWith('buy:')) this.buy(clicked.id.slice(4));
  }

  private buy(id: string): void {
    const upgrade = UPGRADES.find((candidate) => candidate.id === id);
    if (!upgrade) return;

    const level = this.save.upgrades[id] ?? 0;
    if (level >= upgrade.maxLevel) {
      this.shopMessage = `${upgrade.name} is already maxed.`;
      audio.thud();
      return;
    }

    const cost = upgradeCost(upgrade, level);
    if (this.save.cash < cost) {
      this.shopMessage = `Need $${cost - this.save.cash} more for ${upgrade.name}.`;
      audio.thud();
      return;
    }

    this.save.cash -= cost;
    this.save.upgrades[id] = level + 1;
    this.shopMessage = `${upgrade.name} → level ${level + 1}`;
    audio.cash();
    this.persist();
  }

  // ---------------------------------------------------------------- helpers

  /** E, Space or a click on the primary button all mean "go". */
  private confirmPressed(): boolean {
    if (this.inputLock > 0) return false;
    if (this.input.wasPressed('KeyE', 'Space', 'Enter', 'NumpadEnter')) return true;

    const clicked = this.clickedButton();
    return clicked?.id === 'primary';
  }

  private clickedButton() {
    if (this.inputLock > 0 || !this.input.pointerPressed) return null;
    return buttonAt(this.buttons, this.input.pointerX, this.input.pointerY);
  }

  private lock(): void {
    this.inputLock = 0.22;
    this.buttons = [];
  }

  private persist(): void {
    writeSave(this.save);
  }
}

const OUTRO_SECONDS = 1.6;

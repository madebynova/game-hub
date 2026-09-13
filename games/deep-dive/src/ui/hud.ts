import { DEPTH_ZONES, PX_PER_METER } from '../config';
import { clamp, damp, formatMoney } from '../core/math';
import type { OxygenStatus } from '../systems/oxygen';
import type { ZoneDef } from '../world/zones';
import { ZONES } from '../world/zones';

export interface ObjectiveRow {
  text: string;
  progress: string;
  done: boolean;
  reward: number;
}

export interface HudState {
  visible: boolean;
  oxygen: number;
  maxOxygen: number;
  /** Oxygen needed to swim straight up from the current depth. */
  needed: number;
  status: OxygenStatus;
  refilling: boolean;
  depthM: number;
  bestDepthM: number;
  onBoat: boolean;
  /** Current zone while underwater (null on deck or at the surface). */
  zone: ZoneDef | null;
  /** Oxygen drained per second right now. */
  airUse: number;
  currentName: string | null;
  inAirPocket: boolean;
  haulValue: number;
  haulCount: number;
  usedSlots: number;
  bagCapacity: number;
  cash: number;
  objectives: ObjectiveRow[];
}

export type ToastKind = 'info' | 'good' | 'warn' | 'bad' | 'hint' | 'epic';

/** Deepest point shown on the depth gauge, in meters. */
const GAUGE_MAX_M = 260;

export class Hud {
  private root: HTMLElement;
  private q = <T extends HTMLElement = HTMLElement>(sel: string) => this.root.querySelector<T>(sel)!;
  private shownCash: number | null = null;
  private shownHaul = 0;
  private pips = -1;
  private cache = new Map<HTMLElement, string>();
  private promptHtml: string | null = '';
  private objectivesKey = '';

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'hud hidden';
    const band = (from: number, to: number, zone: ZoneDef) =>
      `<div class="dg-band" style="top:${(from / GAUGE_MAX_M) * 100}%;height:${((to - from) / GAUGE_MAX_M) * 100}%;--accent:${zone.accent}"><span>${zone.name.replace('The ', '').replace('Shallow ', '')}</span></div>`;
    const wreckM = Math.round(DEPTH_ZONES.wreck / PX_PER_METER);
    const abyssM = Math.round(DEPTH_ZONES.abyss / PX_PER_METER);
    this.root.innerHTML = `
      <div class="hud-left">
        <div class="hud-panel hud-oxygen">
          <div class="hud-label"><span>Oxygen</span><span class="o2-pct">100%</span></div>
          <div class="o2-bar">
            <div class="o2-fill"></div>
            <div class="o2-mark" title="Air needed to swim straight up"></div>
          </div>
          <div class="hud-depth"><span class="depth-val">0</span><small>m</small><span class="zone">On deck</span></div>
          <div class="hud-air">
            <span class="air-use">Air use 1.0×</span>
            <span class="chip chip-current hidden"></span>
            <span class="chip chip-pocket hidden">Air pocket</span>
          </div>
        </div>
        <div class="hud-panel hud-objectives">
          <div class="hud-label"><span>Objectives</span><span class="obj-hint">paid at the boat</span></div>
          <ul class="obj-list"></ul>
        </div>
      </div>
      <div class="hud-panel hud-stats">
        <div class="stat stat-haul">
          <div class="hud-label"><span>Dive haul</span><span class="haul-tag"></span></div>
          <div class="stat-val haul-val">$0</div>
        </div>
        <div class="stat stat-bag">
          <div class="hud-label"><span>Bag</span><span class="bag-count">0 / 5</span></div>
          <div class="bag-pips"></div>
        </div>
        <div class="stat stat-cash">
          <div class="hud-label"><span>Cash</span><span class="cash-tag">banked</span></div>
          <div class="stat-val cash-val">$0</div>
        </div>
      </div>
      <div class="depth-gauge" aria-hidden="true">
        ${band(0, wreckM, ZONES.reef)}${band(wreckM, abyssM, ZONES.wreck)}${band(abyssM, GAUGE_MAX_M, ZONES.abyss)}
        <div class="dg-best"></div>
        <div class="dg-marker"><span class="dg-marker-label">0m</span></div>
      </div>
      <div class="prompt hidden"></div>
      <div class="toasts"></div>
    `;
    parent.appendChild(this.root);
  }

  private setText(el: HTMLElement, text: string) {
    if (this.cache.get(el) !== text) {
      el.textContent = text;
      this.cache.set(el, text);
    }
  }

  update(s: HudState, dt: number) {
    this.root.classList.toggle('hidden', !s.visible);
    if (!s.visible) return;

    const frac = clamp(s.oxygen / s.maxOxygen, 0, 1);
    this.q('.o2-fill').style.transform = `scaleX(${frac})`;
    const bar = this.q('.o2-bar');
    bar.dataset.status = s.status;
    bar.classList.toggle('refilling', s.refilling || s.inAirPocket);
    this.setText(this.q('.o2-pct'), `${Math.ceil(frac * 100)}%`);
    const mark = this.q('.o2-mark');
    mark.style.opacity = s.needed > 1 && !s.onBoat ? '1' : '0';
    mark.style.left = `${clamp(s.needed / s.maxOxygen, 0, 1) * 100}%`;

    this.setText(this.q('.depth-val'), String(s.depthM));
    const zoneEl = this.q('.zone');
    this.setText(zoneEl, s.onBoat ? 'On deck' : s.depthM <= 0 || !s.zone ? 'Surface' : s.zone.name);
    zoneEl.style.color = s.zone && !s.onBoat && s.depthM > 0 ? s.zone.accent : '';

    const underwater = !s.onBoat && s.depthM > 0;
    const airUse = this.q('.air-use');
    this.setText(airUse, underwater ? `Air use ${s.airUse.toFixed(1)}×` : s.onBoat ? 'Breathing easy' : 'Breathing');
    airUse.dataset.level = !underwater ? 'calm' : s.airUse >= 2.2 ? 'crushing' : s.airUse >= 1.5 ? 'heavy' : 'normal';
    const chip = this.q('.chip-current');
    chip.classList.toggle('hidden', !s.currentName);
    if (s.currentName) this.setText(chip, `⇢ ${s.currentName}`);
    this.q('.chip-pocket').classList.toggle('hidden', !s.inAirPocket);

    this.renderObjectives(s.objectives);

    this.shownHaul = Math.abs(this.shownHaul - s.haulValue) < 1 ? s.haulValue : damp(this.shownHaul, s.haulValue, 10, dt);
    this.setText(this.q('.haul-val'), formatMoney(this.shownHaul));
    const tagText = s.haulCount === 0 ? '' : s.onBoat ? 'secured' : 'at risk';
    this.setText(this.q('.haul-tag'), tagText);
    this.q('.stat-haul').dataset.risk = tagText === 'at risk' ? 'yes' : 'no';

    if (this.pips !== s.bagCapacity) {
      this.pips = s.bagCapacity;
      const pipBox = this.q('.bag-pips');
      pipBox.innerHTML = '<i></i>'.repeat(s.bagCapacity);
      pipBox.classList.toggle('dense', s.bagCapacity > 16);
    }
    const pipEls = this.q('.bag-pips').children;
    for (let i = 0; i < pipEls.length; i++) pipEls[i].classList.toggle('on', i < s.usedSlots);
    this.setText(this.q('.bag-count'), `${s.usedSlots} / ${s.bagCapacity}`);
    this.q('.stat-bag').classList.toggle('full', s.usedSlots >= s.bagCapacity);

    if (this.shownCash === null) this.shownCash = s.cash;
    this.shownCash = Math.abs(this.shownCash - s.cash) < 1 ? s.cash : damp(this.shownCash, s.cash, 6, dt);
    this.setText(this.q('.cash-val'), formatMoney(this.shownCash));

    const gauge = this.q('.depth-gauge');
    gauge.classList.toggle('dim', s.onBoat);
    const pos = clamp(s.depthM / GAUGE_MAX_M, 0, 1) * 100;
    this.q('.dg-marker').style.top = `${pos}%`;
    this.setText(this.q('.dg-marker-label'), `${s.depthM}m`);
    this.q('.dg-best').style.top = `${clamp(s.bestDepthM / GAUGE_MAX_M, 0, 1) * 100}%`;
  }

  private renderObjectives(rows: ObjectiveRow[]) {
    const key = rows.map((r) => `${r.text}|${r.progress}|${r.done}`).join('~');
    if (key === this.objectivesKey) return;
    const prevDone = new Set(this.objectivesKey.split('~').filter((k) => k.endsWith('|true')).map((k) => k.split('|')[0]));
    this.objectivesKey = key;
    const list = this.q('.obj-list');
    list.innerHTML = rows.map((r) => `
      <li class="${r.done ? 'done' : ''} ${r.done && !prevDone.has(r.text) ? 'just-done' : ''}">
        <span class="obj-check">${r.done ? '✓' : ''}</span>
        <span class="obj-text">${r.text}</span>
        <span class="obj-prog">${r.done ? `+${formatMoney(r.reward)}` : r.progress}</span>
      </li>`).join('');
    this.q('.hud-objectives').classList.toggle('hidden', rows.length === 0);
  }

  setPrompt(html: string | null) {
    if (html === this.promptHtml) return;
    this.promptHtml = html;
    const el = this.q('.prompt');
    el.classList.toggle('hidden', !html);
    if (html) el.innerHTML = html;
  }

  toast(html: string, kind: ToastKind = 'info', seconds = 2.5) {
    const box = this.q('.toasts');
    const el = document.createElement('div');
    el.className = `toast toast-${kind}`;
    el.innerHTML = html;
    box.appendChild(el);
    while (box.children.length > 4) box.firstElementChild!.remove();
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 400);
    }, seconds * 1000);
  }

  private restartAnim(el: HTMLElement, cls: string) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  bumpHaul() {
    this.restartAnim(this.q('.stat-haul'), 'bump');
    this.restartAnim(this.q('.stat-bag'), 'bump');
  }

  shakeBag() {
    this.restartAnim(this.q('.stat-bag'), 'shake');
  }

  flashOxygen() {
    this.restartAnim(this.q('.hud-oxygen'), 'shake');
  }

  cashPop(amount: number) {
    const stat = this.q('.stat-cash');
    this.restartAnim(stat, amount >= 0 ? 'bump-good' : 'bump');
    const pop = document.createElement('span');
    pop.className = `cash-pop ${amount >= 0 ? 'gain' : 'spend'}`;
    pop.textContent = `${amount >= 0 ? '+' : '−'}${formatMoney(Math.abs(amount))}`;
    stat.appendChild(pop);
    setTimeout(() => pop.remove(), 1400);
  }
}

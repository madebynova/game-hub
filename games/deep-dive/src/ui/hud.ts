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
/** Messages on screen at once; older ones make way. */
const MAX_TOASTS = 3;

type StyleProp = 'transform' | 'left' | 'top' | 'opacity' | 'color';

/**
 * The in-dive HUD. Hierarchy: oxygen and depth (top-left), money (top-right),
 * objectives under the oxygen panel, messages in the gap between, prompts at the bottom.
 */
export class Hud {
  private root: HTMLElement;
  private el: Record<
    | 'oxygen' | 'pct' | 'bar' | 'fill' | 'mark' | 'depth' | 'zone' | 'air' | 'chips' | 'current' | 'pocket'
    | 'objectives' | 'objList' | 'haul' | 'haulVal' | 'haulTag' | 'bag' | 'bagCount' | 'pips' | 'cash' | 'cashVal'
    | 'gauge' | 'marker' | 'markerLabel' | 'best' | 'prompt' | 'toasts',
    HTMLElement
  >;
  private shownCash: number | null = null;
  private shownHaul = 0;
  private pipCapacity = -1;
  private pipsOn = -1;
  private texts = new Map<HTMLElement, string>();
  private styles = new Map<string, string>();
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
        <div class="hud-panel hud-oxygen" data-status="ok">
          <div class="o2-head"><span class="hud-label">Oxygen</span><span class="o2-pct">100%</span></div>
          <div class="o2-bar">
            <div class="o2-fill"></div>
            <div class="o2-mark" title="Air needed to swim straight up"></div>
          </div>
          <div class="dive-row">
            <span class="depth"><span class="depth-val">0</span><small>m</small></span>
            <span class="zone-info"><span class="zone">On deck</span><span class="air-use">Breathing easy</span></span>
          </div>
          <div class="chips hidden">
            <span class="chip chip-current hidden"></span>
            <span class="chip chip-pocket hidden">Air pocket</span>
          </div>
        </div>
        <div class="hud-panel hud-objectives">
          <div class="obj-head"><span class="hud-label">Objectives</span><span class="obj-hint">paid aboard</span></div>
          <ul class="obj-list"></ul>
        </div>
      </div>
      <div class="hud-panel hud-stats">
        <div class="stat stat-haul">
          <div class="stat-head"><span class="hud-label">Dive haul</span><span class="haul-tag"></span></div>
          <div class="stat-val haul-val">$0</div>
        </div>
        <div class="stat stat-bag">
          <div class="stat-head"><span class="hud-label">Bag</span><span class="bag-count">0/5</span></div>
          <div class="bag-pips"></div>
        </div>
        <div class="stat stat-cash">
          <div class="stat-head"><span class="hud-label">Cash</span></div>
          <div class="stat-val cash-val">$0</div>
        </div>
      </div>
      <div class="depth-gauge" aria-hidden="true">
        ${band(0, wreckM, ZONES.reef)}${band(wreckM, abyssM, ZONES.wreck)}${band(abyssM, GAUGE_MAX_M, ZONES.abyss)}
        <div class="dg-best"></div>
        <div class="dg-marker"><span class="dg-marker-label">0m</span></div>
      </div>
      <div class="prompt hidden"></div>
      <div class="toasts" aria-live="polite"></div>
    `;
    parent.appendChild(this.root);

    const pick = (sel: string) => this.root.querySelector<HTMLElement>(sel)!;
    this.el = {
      oxygen: pick('.hud-oxygen'), pct: pick('.o2-pct'), bar: pick('.o2-bar'), fill: pick('.o2-fill'), mark: pick('.o2-mark'),
      depth: pick('.depth-val'), zone: pick('.zone'), air: pick('.air-use'),
      chips: pick('.chips'), current: pick('.chip-current'), pocket: pick('.chip-pocket'),
      objectives: pick('.hud-objectives'), objList: pick('.obj-list'),
      haul: pick('.stat-haul'), haulVal: pick('.haul-val'), haulTag: pick('.haul-tag'),
      bag: pick('.stat-bag'), bagCount: pick('.bag-count'), pips: pick('.bag-pips'),
      cash: pick('.stat-cash'), cashVal: pick('.cash-val'),
      gauge: pick('.depth-gauge'), marker: pick('.dg-marker'), markerLabel: pick('.dg-marker-label'), best: pick('.dg-best'),
      prompt: pick('.prompt'), toasts: pick('.toasts'),
    };
  }

  private setText(el: HTMLElement, text: string) {
    if (this.texts.get(el) !== text) {
      el.textContent = text;
      this.texts.set(el, text);
    }
  }

  /** Write a style only when its value changes — keeps per-frame DOM work minimal. */
  private setStyle(el: HTMLElement, key: string, prop: StyleProp, value: string) {
    if (this.styles.get(key) === value) return;
    this.styles.set(key, value);
    el.style[prop] = value;
  }

  private setData(el: HTMLElement, name: string, value: string) {
    if (el.dataset[name] !== value) el.dataset[name] = value;
  }

  update(s: HudState, dt: number) {
    this.root.classList.toggle('hidden', !s.visible);
    if (!s.visible) return;
    const e = this.el;

    // Oxygen — the panel itself changes colour as air becomes dangerous.
    const frac = clamp(s.oxygen / s.maxOxygen, 0, 1);
    this.setStyle(e.fill, 'fill', 'transform', `scaleX(${frac.toFixed(3)})`);
    this.setData(e.oxygen, 'status', s.status);
    e.bar.classList.toggle('refilling', s.refilling || s.inAirPocket);
    this.setText(e.pct, `${Math.ceil(frac * 100)}%`);
    const showMark = s.needed > 1 && !s.onBoat;
    this.setStyle(e.mark, 'markOpacity', 'opacity', showMark ? '1' : '0');
    if (showMark) this.setStyle(e.mark, 'markLeft', 'left', `${(clamp(s.needed / s.maxOxygen, 0, 1) * 100).toFixed(1)}%`);

    // Depth and zone.
    const underwater = !s.onBoat && s.depthM > 0;
    this.setText(e.depth, String(s.depthM));
    this.setText(e.zone, s.onBoat ? 'On deck' : underwater && s.zone ? s.zone.name : 'Surface');
    this.setStyle(e.zone, 'zoneColor', 'color', underwater && s.zone ? s.zone.accent : '');
    this.setText(e.air, underwater ? `Air use ${s.airUse.toFixed(1)}×` : s.onBoat ? 'Breathing easy' : 'Breathing');
    this.setData(e.air, 'level', !underwater ? 'calm' : s.airUse >= 2.2 ? 'crushing' : s.airUse >= 1.5 ? 'heavy' : 'normal');
    e.current.classList.toggle('hidden', !s.currentName);
    if (s.currentName) this.setText(e.current, `⇢ ${s.currentName}`);
    e.pocket.classList.toggle('hidden', !s.inAirPocket);
    e.chips.classList.toggle('hidden', !s.currentName && !s.inAirPocket);

    this.renderObjectives(s.objectives);

    // Haul (at risk) vs cash (safe).
    this.shownHaul = Math.abs(this.shownHaul - s.haulValue) < 1 ? s.haulValue : damp(this.shownHaul, s.haulValue, 10, dt);
    this.setText(e.haulVal, formatMoney(this.shownHaul));
    const tag = s.haulCount === 0 ? '' : s.onBoat ? 'secured' : 'at risk';
    this.setText(e.haulTag, tag);
    this.setData(e.haul, 'risk', tag === 'at risk' ? 'yes' : 'no');

    if (this.pipCapacity !== s.bagCapacity) {
      this.pipCapacity = s.bagCapacity;
      e.pips.innerHTML = '<i></i>'.repeat(s.bagCapacity);
      e.pips.classList.toggle('dense', s.bagCapacity > 16);
      this.pipsOn = -1;
    }
    if (this.pipsOn !== s.usedSlots) {
      this.pipsOn = s.usedSlots;
      const pips = e.pips.children;
      for (let i = 0; i < pips.length; i++) pips[i].classList.toggle('on', i < s.usedSlots);
    }
    this.setText(e.bagCount, `${s.usedSlots}/${s.bagCapacity}`);
    e.bag.classList.toggle('full', s.usedSlots >= s.bagCapacity);

    if (this.shownCash === null) this.shownCash = s.cash;
    this.shownCash = Math.abs(this.shownCash - s.cash) < 1 ? s.cash : damp(this.shownCash, s.cash, 6, dt);
    this.setText(e.cashVal, formatMoney(this.shownCash));

    // Depth gauge.
    e.gauge.classList.toggle('dim', s.onBoat);
    this.setStyle(e.marker, 'gaugeMarker', 'top', `${(clamp(s.depthM / GAUGE_MAX_M, 0, 1) * 100).toFixed(1)}%`);
    this.setText(e.markerLabel, `${s.depthM}m`);
    this.setStyle(e.best, 'gaugeBest', 'top', `${(clamp(s.bestDepthM / GAUGE_MAX_M, 0, 1) * 100).toFixed(1)}%`);
  }

  private renderObjectives(rows: ObjectiveRow[]) {
    const key = rows.map((r) => `${r.text}|${r.progress}|${r.done}`).join('~');
    if (key === this.objectivesKey) return;
    const prevDone = new Set(this.objectivesKey.split('~').filter((k) => k.endsWith('|true')).map((k) => k.split('|')[0]));
    this.objectivesKey = key;
    this.el.objList.innerHTML = rows.map((r) => {
      const progress = !r.done && r.progress !== '—' ? ` <em class="obj-prog">${r.progress}</em>` : '';
      return `<li class="${r.done ? 'done' : ''} ${r.done && !prevDone.has(r.text) ? 'just-done' : ''}">
        <span class="obj-check" aria-hidden="true">${r.done ? '✓' : ''}</span>
        <span class="obj-text">${r.text}${progress}</span>
        <span class="obj-reward">+${formatMoney(r.reward)}</span>
      </li>`;
    }).join('');
    this.el.objectives.classList.toggle('hidden', rows.length === 0);
  }

  setPrompt(html: string | null) {
    if (html === this.promptHtml) return;
    this.promptHtml = html;
    this.el.prompt.classList.toggle('hidden', !html);
    if (html) this.el.prompt.innerHTML = html;
  }

  toast(html: string, kind: ToastKind = 'info', seconds = 2.5) {
    const box = this.el.toasts;
    const el = document.createElement('div');
    el.className = `toast toast-${kind}`;
    el.innerHTML = html;
    box.appendChild(el);
    while (box.children.length > MAX_TOASTS) box.firstElementChild!.remove();
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
    this.restartAnim(this.el.haul, 'bump');
    this.restartAnim(this.el.bag, 'bump');
  }

  shakeBag() {
    this.restartAnim(this.el.bag, 'shake');
  }

  flashOxygen() {
    this.restartAnim(this.el.oxygen, 'shake');
  }

  cashPop(amount: number) {
    const stat = this.el.cash;
    this.restartAnim(stat, amount >= 0 ? 'bump-good' : 'bump');
    const pop = document.createElement('span');
    pop.className = `cash-pop ${amount >= 0 ? 'gain' : 'spend'}`;
    pop.textContent = `${amount >= 0 ? '+' : '−'}${formatMoney(Math.abs(amount))}`;
    stat.appendChild(pop);
    setTimeout(() => pop.remove(), 1400);
  }
}

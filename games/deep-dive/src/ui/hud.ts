import { DEPTH_ZONES, PX_PER_METER } from '../config';
import { clamp, damp, formatMoney } from '../core/math';
import type { OxygenStatus } from '../systems/oxygen';

export interface HudState {
  visible: boolean;
  oxygen: number;
  maxOxygen: number;
  /** Oxygen needed to swim straight up from the current depth. */
  needed: number;
  status: OxygenStatus;
  refilling: boolean;
  depthM: number;
  onBoat: boolean;
  haulValue: number;
  haulCount: number;
  bagCapacity: number;
  cash: number;
}

export type ToastKind = 'info' | 'good' | 'warn' | 'bad' | 'hint' | 'epic';

function zoneName(s: HudState) {
  if (s.onBoat) return 'On deck';
  const y = s.depthM * PX_PER_METER;
  if (s.depthM <= 0) return 'Surface';
  if (y >= DEPTH_ZONES.abyss) return 'The Abyss';
  if (y >= DEPTH_ZONES.reef) return 'Coral Reef';
  return 'Sunlit Shallows';
}

export class Hud {
  private root: HTMLElement;
  private q = <T extends HTMLElement = HTMLElement>(sel: string) => this.root.querySelector<T>(sel)!;
  private shownCash: number | null = null;
  private shownHaul = 0;
  private pips = -1;
  private cache = new Map<HTMLElement, string>();
  private promptHtml: string | null = '';

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'hud hidden';
    this.root.innerHTML = `
      <div class="hud-panel hud-oxygen">
        <div class="hud-label"><span>Oxygen</span><span class="o2-pct">100%</span></div>
        <div class="o2-bar">
          <div class="o2-fill"></div>
          <div class="o2-mark" title="Air needed to swim straight up"></div>
        </div>
        <div class="hud-depth"><span class="depth-val">0</span><small>m</small><span class="zone">On deck</span></div>
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
    bar.classList.toggle('refilling', s.refilling);
    this.setText(this.q('.o2-pct'), `${Math.ceil(frac * 100)}%`);
    const mark = this.q('.o2-mark');
    const showMark = s.needed > 1 && !s.onBoat;
    mark.style.opacity = showMark ? '1' : '0';
    mark.style.left = `${clamp(s.needed / s.maxOxygen, 0, 1) * 100}%`;

    this.setText(this.q('.depth-val'), String(s.depthM));
    this.setText(this.q('.zone'), zoneName(s));

    this.shownHaul = Math.abs(this.shownHaul - s.haulValue) < 1 ? s.haulValue : damp(this.shownHaul, s.haulValue, 10, dt);
    this.setText(this.q('.haul-val'), formatMoney(this.shownHaul));
    const tag = this.q('.haul-tag');
    const tagText = s.haulCount === 0 ? '' : s.onBoat ? 'secured' : 'at risk';
    this.setText(tag, tagText);
    this.q('.stat-haul').dataset.risk = tagText === 'at risk' ? 'yes' : 'no';

    if (this.pips !== s.bagCapacity) {
      this.pips = s.bagCapacity;
      this.q('.bag-pips').innerHTML = '<i></i>'.repeat(s.bagCapacity);
    }
    const pipEls = this.q('.bag-pips').children;
    for (let i = 0; i < pipEls.length; i++) pipEls[i].classList.toggle('on', i < s.haulCount);
    this.setText(this.q('.bag-count'), `${s.haulCount} / ${s.bagCapacity}`);
    this.q('.stat-bag').classList.toggle('full', s.haulCount >= s.bagCapacity);

    if (this.shownCash === null) this.shownCash = s.cash;
    this.shownCash = Math.abs(this.shownCash - s.cash) < 1 ? s.cash : damp(this.shownCash, s.cash, 6, dt);
    this.setText(this.q('.cash-val'), formatMoney(this.shownCash));
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

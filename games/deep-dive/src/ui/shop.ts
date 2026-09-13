import { PX_PER_METER } from '../config';
import { formatMoney } from '../core/math';
import type { LostSatchel, SaveData } from '../core/save';
import { RARITIES, TREASURES, slotsOf, type HaulItem } from '../data/treasures';
import { UPGRADES, UPGRADE_ORDER, maxLevel, nextCost, upgradeValue, type UpgradeId } from '../data/upgrades';
import type { ObjectiveRow } from './hud';

export interface ShopData {
  cash: number;
  items: HaulItem[];
  total: number;
  usedSlots: number;
  capacity: number;
  upgrades: Record<UpgradeId, number>;
  satchel: LostSatchel | null;
  stats: SaveData['stats'];
  objectives: ObjectiveRow[];
  discovered: number;
}

export interface ShopHandlers {
  onSell(): void;
  onBuy(id: UpgradeId): void;
  onDive(): void;
  onClose(): void;
  onReset(): void;
  /** Clicked an upgrade the player can't afford yet. */
  onDenied(id: UpgradeId): void;
}

/** Trading deck overlay: sell the haul, buy gear, check objectives, dive again. */
export class Shop {
  isOpen = false;
  private root: HTMLElement;
  private shownCash = 0;
  private cashAnim = 0;

  constructor(parent: HTMLElement, handlers: ShopHandlers) {
    this.root = document.createElement('div');
    this.root.className = 'shop hidden';
    this.root.innerHTML = `
      <div class="shop-card" role="dialog" aria-label="Trading deck">
        <header class="shop-head">
          <div>
            <div class="eyebrow">Aboard the <em>Salt &amp; Silver</em></div>
            <h2>Trading Deck</h2>
          </div>
          <div class="shop-cash"><span>Cash</span><b class="shop-cash-val">$0</b></div>
        </header>
        <div class="shop-grid">
          <section class="shop-haul">
            <h3>Dive haul <small>not yours until sold</small></h3>
            <ul class="haul-list"></ul>
            <div class="haul-total"><span>Total value <em class="haul-slots"></em></span><b class="haul-total-val">$0</b></div>
            <button class="btn btn-sell" data-action="sell">Sell haul</button>
            <div class="satchel-note hidden"></div>
            <div class="sold-stamp hidden"></div>
          </section>
          <section class="shop-upgrades">
            <h3>Gear upgrades</h3>
            <div class="upgrade-list"></div>
          </section>
        </div>
        <section class="shop-objectives">
          <h3>Dive objectives <small>complete underwater, paid when you climb aboard</small></h3>
          <div class="obj-cards"></div>
        </section>
        <footer class="shop-foot">
          <div class="shop-stats"></div>
          <div class="shop-actions">
            <button class="btn btn-ghost btn-small" data-action="reset">Reset save</button>
            <button class="btn btn-ghost" data-action="close">Close <kbd>Esc</kbd></button>
            <button class="btn btn-dive" data-action="dive">Dive <kbd>Space</kbd></button>
          </div>
        </footer>
      </div>`;
    parent.appendChild(this.root);

    this.root.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const btn = target.closest<HTMLButtonElement>('[data-action]');
      if (!btn) {
        // Disabled buy buttons let the pointer through, so the click lands on their wrapper.
        const blocked = target.closest('.upg.short')?.querySelector<HTMLButtonElement>('.btn-buy:disabled');
        if (blocked && target.closest('.upg-buy')) handlers.onDenied(blocked.dataset.id as UpgradeId);
        return;
      }
      if (btn.disabled) return;
      // Mouse clicks drop focus so Space goes back to the game; keyboard presses (detail 0) keep it.
      if (e.detail > 0) btn.blur();
      switch (btn.dataset.action) {
        case 'sell': return handlers.onSell();
        case 'buy': return handlers.onBuy(btn.dataset.id as UpgradeId);
        case 'dive': return handlers.onDive();
        case 'close': return handlers.onClose();
        case 'reset': return handlers.onReset();
      }
    });
  }

  open(data: ShopData) {
    this.isOpen = true;
    this.root.classList.remove('hidden');
    this.shownCash = data.cash;
    this.refresh(data);
  }

  close() {
    this.isOpen = false;
    if (document.activeElement instanceof HTMLElement && this.root.contains(document.activeElement)) document.activeElement.blur();
    this.root.classList.add('hidden');
    this.q('.sold-stamp').classList.add('hidden');
  }

  private q<T extends HTMLElement = HTMLElement>(sel: string) {
    return this.root.querySelector<T>(sel)!;
  }

  refresh(data: ShopData, fx: { sold?: number; upgraded?: UpgradeId } = {}) {
    // Re-rendering replaces the buttons, so remember which one had keyboard focus.
    const active = document.activeElement instanceof HTMLElement && this.root.contains(document.activeElement)
      ? document.activeElement.closest<HTMLElement>('[data-action]')
      : null;
    const focusSelector = active
      ? `[data-action="${active.dataset.action}"]${active.dataset.id ? `[data-id="${active.dataset.id}"]` : ''}`
      : null;

    this.renderHaul(data);
    this.renderUpgrades(data);
    this.renderObjectives(data.objectives);
    this.animateCash(data.cash);

    const s = data.stats;
    const total = Object.keys(TREASURES).length;
    this.q('.shop-stats').innerHTML =
      `Dives <b>${s.dives}</b> · Deepest <b>${s.bestDepthM}m</b> · Earned <b>${formatMoney(s.totalEarned)}</b> · Treasure log <b>${data.discovered}/${total}</b>`;
    this.q('.btn-dive').innerHTML = data.items.length ? 'Sell &amp; dive <kbd>Space</kbd>' : 'Dive <kbd>Space</kbd>';

    if (fx.sold) {
      const stamp = this.q('.sold-stamp');
      stamp.textContent = `Sold +${formatMoney(fx.sold)}`;
      stamp.classList.remove('hidden', 'go');
      void stamp.offsetWidth;
      stamp.classList.add('go');
    }
    if (fx.upgraded) this.root.querySelector<HTMLElement>(`.upg[data-id="${fx.upgraded}"]`)?.classList.add('flash');
    if (focusSelector) {
      const again = this.root.querySelector<HTMLButtonElement>(focusSelector);
      (again && !again.disabled ? again : this.q<HTMLButtonElement>('.btn-dive')).focus();
    }
  }

  shake(id: UpgradeId) {
    const card = this.root.querySelector<HTMLElement>(`.upg[data-id="${id}"]`);
    if (!card) return;
    card.classList.remove('shake');
    void card.offsetWidth;
    card.classList.add('shake');
  }

  private renderHaul(data: ShopData) {
    const groups = new Map<string, { item: HaulItem; count: number; value: number }>();
    for (const it of data.items) {
      const g = groups.get(it.defId) ?? { item: it, count: 0, value: 0 };
      g.count++;
      g.value += it.value;
      groups.set(it.defId, g);
    }
    const rows = [...groups.values()].sort((a, b) => RARITIES[b.item.rarity].tier - RARITIES[a.item.rarity].tier || b.value - a.value);
    this.q('.haul-list').innerHTML = rows.length
      ? rows.map(({ item, count, value }) => {
          const r = RARITIES[item.rarity];
          const heavy = slotsOf(item) > 1 ? ' <small class="heavy">heavy</small>' : '';
          return `<li style="--c:${r.color}">
            <span class="dot"></span>
            <span class="name">${item.name}${count > 1 ? ` <small>×${count}</small>` : ''}${heavy}</span>
            <span class="rar">${r.label}</span>
            <span class="val">${formatMoney(value)}</span>
          </li>`;
        }).join('')
      : `<li class="empty">Your bag is empty.<br>Dive in and bring something back!</li>`;
    this.q('.haul-total-val').textContent = formatMoney(data.total);
    this.q('.haul-slots').textContent = data.items.length ? `· ${data.usedSlots}/${data.capacity} slots` : '';
    const sell = this.q<HTMLButtonElement>('.btn-sell');
    sell.disabled = data.items.length === 0;
    sell.textContent = data.items.length ? `Sell for ${formatMoney(data.total)}` : 'Nothing to sell';

    const note = this.q('.satchel-note');
    if (data.satchel) {
      const value = data.satchel.items.reduce((s, i) => s + i.value, 0);
      note.innerHTML = `<b>Lost haul</b> waiting at ${Math.round(data.satchel.y / PX_PER_METER)}m — ${data.satchel.items.length} item${data.satchel.items.length > 1 ? 's' : ''} worth ${formatMoney(value)}`;
      note.classList.remove('hidden');
    } else note.classList.add('hidden');
  }

  private renderUpgrades(data: ShopData) {
    this.q('.upgrade-list').innerHTML = UPGRADE_ORDER.map((id) => {
      const def = UPGRADES[id];
      const level = data.upgrades[id];
      const cost = nextCost(id, level);
      const maxed = cost === null;
      const afford = !maxed && data.cash >= cost;
      const deepTier = level >= 3 && !maxed && id !== 'fins';
      const pips = Array.from({ length: maxLevel(id) + 1 }, (_, i) => `<i class="${i <= level ? 'on' : ''} ${i >= 4 && id !== 'fins' ? 'deep' : ''}"></i>`).join('');
      const cur = def.format(upgradeValue(id, level));
      const stat = maxed ? `<b>${cur}</b> · max level` : `${cur} <span class="arrow">→</span> <b>${def.format(upgradeValue(id, level + 1))}</b>`;
      const short = maxed || afford ? 0 : cost - data.cash;
      const label = maxed
        ? `${def.name} is at max level`
        : afford ? `Buy ${def.name} for ${formatMoney(cost)}` : `${def.name} costs ${formatMoney(cost)}, you need ${formatMoney(short)} more`;
      return `<div class="upg ${maxed ? 'maxed' : ''} ${afford ? 'afford' : ''} ${short ? 'short' : ''}" data-id="${id}">
        <div class="upg-icon">${def.icon}</div>
        <div class="upg-body">
          <div class="upg-title">${def.name} <span class="pips">${pips}</span>${deepTier ? '<span class="deep-tag">deep-rated</span>' : ''}</div>
          <div class="upg-desc">${def.description}</div>
          <div class="upg-stat">${stat}</div>
        </div>
        <div class="upg-buy" title="${label}">
          <button class="btn btn-buy" data-action="buy" data-id="${id}" ${afford ? '' : 'disabled'} aria-label="${label}">
            ${maxed ? 'Maxed' : formatMoney(cost)}
          </button>
          ${short ? `<span class="upg-short">Need ${formatMoney(short)} more</span>` : ''}
        </div>
      </div>`;
    }).join('');
  }

  private renderObjectives(rows: ObjectiveRow[]) {
    this.q('.obj-cards').innerHTML = rows.map((r) => `
      <div class="obj-card ${r.done ? 'done' : ''}">
        <div class="obj-card-text">${r.text}</div>
        <div class="obj-card-reward">+${formatMoney(r.reward)}</div>
      </div>`).join('');
  }

  private animateCash(target: number) {
    cancelAnimationFrame(this.cashAnim);
    const el = this.q('.shop-cash-val');
    const from = this.shownCash;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 700);
      const e = 1 - Math.pow(1 - t, 3);
      this.shownCash = from + (target - from) * e;
      el.textContent = formatMoney(this.shownCash);
      if (t < 1) this.cashAnim = requestAnimationFrame(tick);
    };
    el.textContent = formatMoney(from);
    this.cashAnim = requestAnimationFrame(tick);
  }
}

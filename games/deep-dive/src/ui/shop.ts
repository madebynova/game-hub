import { PX_PER_METER } from '../config';
import { formatMoney } from '../core/math';
import type { LostSatchel, SaveData } from '../core/save';
import { RARITIES, type HaulItem } from '../data/treasures';
import { UPGRADES, UPGRADE_ORDER, maxLevel, nextCost, upgradeValue, type UpgradeId } from '../data/upgrades';

export interface ShopData {
  cash: number;
  items: HaulItem[];
  total: number;
  upgrades: Record<UpgradeId, number>;
  satchel: LostSatchel | null;
  stats: SaveData['stats'];
}

export interface ShopHandlers {
  onSell(): void;
  onBuy(id: UpgradeId): void;
  onDive(): void;
  onClose(): void;
  onReset(): void;
}

/** Trading deck overlay: sell the haul, buy gear, dive again. */
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
            <div class="haul-total"><span>Total value</span><b class="haul-total-val">$0</b></div>
            <button class="btn btn-sell" data-action="sell">Sell haul</button>
            <div class="satchel-note hidden"></div>
            <div class="sold-stamp hidden"></div>
          </section>
          <section class="shop-upgrades">
            <h3>Gear upgrades</h3>
            <div class="upgrade-list"></div>
          </section>
        </div>
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
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
      if (!btn || btn.disabled) return;
      btn.blur(); // keep Space from re-triggering focused buttons
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
    this.root.classList.add('hidden');
    this.q('.sold-stamp').classList.add('hidden');
  }

  private q<T extends HTMLElement = HTMLElement>(sel: string) {
    return this.root.querySelector<T>(sel)!;
  }

  refresh(data: ShopData, fx: { sold?: number; upgraded?: UpgradeId } = {}) {
    this.renderHaul(data);
    this.renderUpgrades(data);
    this.animateCash(data.cash);

    const s = data.stats;
    this.q('.shop-stats').innerHTML = `Dives <b>${s.dives}</b> · Deepest <b>${s.bestDepthM}m</b> · Earned <b>${formatMoney(s.totalEarned)}</b>`;
    this.q('.btn-dive').innerHTML = data.items.length ? 'Sell &amp; dive <kbd>Space</kbd>' : 'Dive <kbd>Space</kbd>';

    if (fx.sold) {
      const stamp = this.q('.sold-stamp');
      stamp.textContent = `Sold +${formatMoney(fx.sold)}`;
      stamp.classList.remove('hidden', 'go');
      void stamp.offsetWidth;
      stamp.classList.add('go');
    }
    if (fx.upgraded) {
      const card = this.root.querySelector<HTMLElement>(`.upg[data-id="${fx.upgraded}"]`);
      card?.classList.add('flash');
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
          return `<li style="--c:${r.color}">
            <span class="dot"></span>
            <span class="name">${item.name}${count > 1 ? ` <small>×${count}</small>` : ''}</span>
            <span class="rar">${r.label}</span>
            <span class="val">${formatMoney(value)}</span>
          </li>`;
        }).join('')
      : `<li class="empty">Your bag is empty.<br>Dive in and bring something back!</li>`;
    this.q('.haul-total-val').textContent = formatMoney(data.total);
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
      const pips = Array.from({ length: maxLevel(id) + 1 }, (_, i) => `<i class="${i <= level ? 'on' : ''}"></i>`).join('');
      const cur = def.format(upgradeValue(id, level));
      const stat = maxed ? `<b>${cur}</b> · max level` : `${cur} <span class="arrow">→</span> <b>${def.format(upgradeValue(id, level + 1))}</b>`;
      return `<div class="upg ${maxed ? 'maxed' : ''} ${afford ? 'afford' : ''}" data-id="${id}">
        <div class="upg-icon">${def.icon}</div>
        <div class="upg-body">
          <div class="upg-title">${def.name} <span class="pips">${pips}</span></div>
          <div class="upg-desc">${def.description}</div>
          <div class="upg-stat">${stat}</div>
        </div>
        <button class="btn btn-buy" data-action="buy" data-id="${id}" ${maxed ? 'disabled' : ''}>
          ${maxed ? 'Maxed' : formatMoney(cost)}
        </button>
      </div>`;
    }).join('');
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
    this.cashAnim = requestAnimationFrame(tick);
  }
}

import { formatMoney } from '../core/math';
import { RARITIES, TREASURES, slotsOf, type HaulItem } from '../data/treasures';
import { renderTreasureIcon } from '../render/treasureArt';
import type { ZoneDef } from '../world/zones';

/**
 * Big moments that deserve more than a toast: entering a new zone, and pulling
 * something rare out of the dark.
 */
export class Announcer {
  private banner: HTMLElement;
  private card: HTMLElement;
  private bannerTimer = 0;
  private cardTimer = 0;

  constructor(parent: HTMLElement) {
    this.banner = document.createElement('div');
    this.banner.className = 'zone-banner hidden';
    this.card = document.createElement('div');
    this.card.className = 'discovery hidden';
    parent.append(this.banner, this.card);
  }

  zone(zone: ZoneDef, depthM: number, firstVisit: boolean) {
    clearTimeout(this.bannerTimer);
    this.banner.style.setProperty('--accent', zone.accent);
    this.banner.innerHTML = `
      ${firstVisit ? '<div class="zb-eyebrow">New zone discovered</div>' : ''}
      <div class="zb-title">${zone.name}</div>
      <div class="zb-sub">${depthM}m · ${zone.tagline}</div>`;
    this.restart(this.banner);
    this.bannerTimer = window.setTimeout(() => this.banner.classList.add('hidden'), firstVisit ? 3600 : 2400);
  }

  /** Discovery card for rare (tier 2) and better finds. */
  discovery(item: HaulItem, isNew: boolean) {
    const def = TREASURES[item.defId];
    const r = RARITIES[item.rarity];
    clearTimeout(this.cardTimer);
    this.banner.classList.add('hidden');
    this.card.dataset.tier = String(r.tier);
    this.card.style.setProperty('--c', r.color);
    const slots = slotsOf(item);
    this.card.innerHTML = `
      <canvas class="disc-icon" width="96" height="96"></canvas>
      <div class="disc-body">
        <div class="disc-rarity">${r.label}${isNew ? ' <span class="disc-new">New find</span>' : ''}</div>
        <div class="disc-name">${def.name}</div>
        <div class="disc-meta">${def.category}${slots > 1 ? ` · ${slots} bag slots` : ''}</div>
      </div>
      <div class="disc-value">${formatMoney(item.value)}</div>`;
    renderTreasureIcon(this.card.querySelector('canvas')!, item.defId, 0.5);
    this.restart(this.card);
    this.cardTimer = window.setTimeout(() => this.card.classList.add('hidden'), 1800 + r.tier * 700);
  }

  private restart(el: HTMLElement) {
    el.classList.add('hidden');
    void el.offsetWidth;
    el.classList.remove('hidden');
  }
}

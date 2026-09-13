import { formatMoney } from '../core/math';

export interface BlackoutInfo {
  itemsLost: number;
  valueLost: number;
  depthM: number;
}

/** Full-screen title and blackout cards. */
export class Overlays {
  private title: HTMLElement;
  private blackout: HTMLElement;

  constructor(parent: HTMLElement) {
    this.title = document.createElement('div');
    this.title.className = 'overlay title-screen hidden';
    this.blackout = document.createElement('div');
    this.blackout.className = 'overlay blackout hidden';
    parent.append(this.title, this.blackout);
  }

  showTitle(onStart: () => void, returning: { cash: number; dives: number } | null) {
    this.title.innerHTML = `
      <div class="title-inner">
        <h1 class="logo" aria-label="ABYSSBOUND"><span class="logo-abyss" aria-hidden="true">Abyss</span><span class="logo-bound" aria-hidden="true">bound</span></h1>
        <p class="tagline">How deep will you go before you turn back?</p>
        <button class="btn btn-start">${returning ? 'Continue diving' : 'Start diving'}</button>
        ${returning ? `<p class="returning">Welcome back — ${formatMoney(returning.cash)} banked after ${returning.dives} dive${returning.dives === 1 ? '' : 's'}.</p>` : ''}
        <div class="controls">
          <div><span class="keys"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span> Swim <small>(or arrows)</small></div>
          <div><span class="keys"><kbd>E</kbd></span> Collect · climb aboard · trade</div>
          <div><span class="keys"><kbd>Space</kbd></span> Dive in from the boat</div>
          <div><span class="keys"><kbd>M</kbd></span> Mute</div>
        </div>
      </div>`;
    this.title.classList.remove('hidden');
    this.title.querySelector('.btn-start')!.addEventListener('click', onStart, { once: true });
  }

  hideTitle() {
    this.title.classList.add('out');
    setTimeout(() => this.title.classList.add('hidden'), 500);
  }

  showBlackout(info: BlackoutInfo, onContinue: () => void) {
    const lost = info.itemsLost
      ? `<div class="loss"><b>${info.itemsLost} item${info.itemsLost > 1 ? 's' : ''}</b> worth <b>${formatMoney(info.valueLost)}</b> sank at ${info.depthM}m.</div>
         <p class="sub">Your satchel is still down there, glowing. Dive back and recover it.</p>`
      : `<p class="sub">Luckily your bag was empty — nothing was lost.</p>`;
    this.blackout.innerHTML = `
      <div class="blackout-card">
        <h2>You blacked out</h2>
        <p>The crew hauled you back aboard, coughing but alive.</p>
        ${lost}
        <p class="tip">Tip: the white marker on the air gauge shows the air you need to swim straight up.</p>
        <button class="btn btn-continue">Continue <kbd>Space</kbd></button>
      </div>`;
    this.blackout.classList.remove('hidden');
    this.blackout.querySelector('.btn-continue')!.addEventListener('click', onContinue, { once: true });
  }

  hideBlackout() {
    this.blackout.classList.add('hidden');
  }

  get blackoutVisible() {
    return !this.blackout.classList.contains('hidden');
  }
}

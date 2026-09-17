/**
 * UNTITLED GARAGE — entry point.
 *
 * This file does three things and nothing else:
 *   1. constructs every system,
 *   2. bundles them into the `api` object that content modules receive,
 *   3. runs the frame loop and the boot flow.
 *
 * All actual behaviour lives in src/systems, src/world, src/ui and src/data.
 */

import { EventBus } from './core/events.js';
import { GameState } from './core/state.js';
import { Input } from './core/input.js';
import { Loop } from './core/loop.js';

import { SaveSystem } from './systems/save.js';
import { AudioSystem } from './systems/audio.js';
import { Inventory } from './systems/inventory.js';
import { ResearchSystem } from './systems/research.js';
import { MemorySystem } from './systems/memory.js';
import { PortalSystem } from './systems/portal.js';
import { StorySystem } from './systems/story.js';

import { World } from './world/world.js';
import { UI } from './ui/ui.js';
import { FX } from './ui/fx.js';
import { Playback } from './ui/playback.js';
import { inventoryPanel, journalPanel, helpPanel } from './ui/panels.js';

import { getResearch } from './data/research.js';
import { getDimension } from './data/dimensions.js';

// ── Construction ───────────────────────────────────────────────────────────

const canvas = document.getElementById('game');
const bus = new EventBus();
const state = new GameState(bus);
const input = new Input(canvas, bus);
const ui = new UI(input, bus);
const fx = new FX(document.getElementById('fx'));
const audio = new AudioSystem(state, bus);
const save = new SaveSystem(state, bus);
const inventory = new Inventory(state, bus);
const research = new ResearchSystem(state, bus, { inventory });
const memory = new MemorySystem(state, bus);

/**
 * The service bundle. Every prop, panel and story beat receives this, so
 * content never imports systems directly and new systems can be added here
 * without rewriting content.
 */
const api = {
  bus, state, input, ui, fx, audio, save, inventory, research, memory,
  world: null, portal: null, story: null, playback: null,
  /** Convenience used by panels and story beats. */
  playFragment: (id, replay = false) => api.playback.play(id, replay),
};

api.world = new World(api);
api.portal = new PortalSystem(api);
api.playback = new Playback(api);
ui.attach(api);
api.story = new StorySystem(state, bus, api);

// Expose for debugging on a school laptop with no devtools muscle memory.
window.GAME = api;

// ── Cross-system reactions ─────────────────────────────────────────────────

bus.on('research:complete', ({ entry }) => {
  audio.play('research_done');
  ui.toast(`Analysis complete: ${entry.title}`, { kind: 'odd', label: 'RESEARCH STATION' });
  if (entry.rewards?.unlockText) {
    ui.toast(entry.rewards.unlockText, { kind: 'warn', label: 'UNLOCKED', ms: 9000 });
  }
  if (ui.panelId() === 'research') ui.refreshPanel();
  api.world.refreshProps();
});

bus.on('research:blocked', ({ reason }) => {
  audio.play('denied');
  ui.toast(reason, { kind: 'warn', label: 'RESEARCH STATION' });
});

bus.on('clue:found', () => { ui.flashTab('journal'); });

// Any progression event can change what is present in the world (an unlocked
// prop, a marker that should stop nagging), so re-evaluate prop visibility
// centrally rather than remembering to do it at every call site.
for (const evt of ['memory:recovered', 'flag:set', 'item:collected', 'item:removed', 'dimension:unlocked']) {
  bus.on(evt, () => api.world.refreshProps());
}

bus.on('memory:recovered', ({ fragment, recovery }) => {
  ui.toast(`${fragment.title} — memory recovery now ${recovery}%`, { kind: 'odd', label: 'MEMORY RIG', ms: 8000 });
});

bus.on('item:collected', () => { if (ui.panelId() === 'research') ui.refreshPanel(); });

// Keep the research ticker honest even when the station panel is closed.
bus.on('research:start', ({ entry }) => ui.updateTicker(entry, 0));
bus.on('research:complete', () => ui.updateTicker(null, 0));
bus.on('research:cancelled', () => ui.updateTicker(null, 0));

// ── HUD buttons ────────────────────────────────────────────────────────────

const PANELS = {
  inventory: ['POCKETS', inventoryPanel],
  journal: ['JOURNAL — WHAT YOU KNOW', journalPanel],
  help: ['HELP & SETTINGS', helpPanel],
};

for (const btn of document.querySelectorAll('#bottom-bar .tab[data-panel]')) {
  btn.addEventListener('click', () => {
    const id = btn.dataset.panel;
    const [title, builder] = PANELS[id];
    audio.play('ui_blip');
    ui.openPanel(id, title, builder);
  });
}

const audioBtn = document.getElementById('audio-toggle');
audioBtn.addEventListener('click', () => {
  audio.unlock();
  const muted = audio.toggleMute();
  audioBtn.textContent = `AUDIO: ${muted ? 'OFF' : 'ON'}`;
});

// ── Frame ──────────────────────────────────────────────────────────────────

let running = false;

function update(dt) {
  if (!running) return;

  ui.update(dt);
  research.tick(dt);
  save.tick(dt);

  if (research.active) {
    ui.updateTicker(getResearch(research.active.entryId), research.progress());
  }

  // Apparition timer (the watcher silhouette) lives on the world so areas can
  // paint it however they like.
  if (api.world.apparition > 0) api.world.apparition = Math.max(0, api.world.apparition - dt);

  api.world.update(dt, input);

  // Interaction: press E, or click the thing itself.
  const focus = api.world.focus;
  if (focus && !ui.narrating && !ui.isPanelOpen()) {
    ui.showHint(`${focus.hint ?? 'Examine'} — ${focus.label ?? ''}`.replace(/ — $/, ''));

    let clickedIt = false;
    if (input.consumeClick()) {
      // Only count the click if it actually landed on/near the focused prop —
      // otherwise a stray click anywhere on screen would trigger interactions.
      const cam = api.world.renderer.camera;
      const wx = input.mouse.x + cam.x;
      const wy = input.mouse.y + cam.y;
      const reach = (focus.radius ?? 64) * 0.8;
      clickedIt = Math.hypot(wx - focus.x, wy - (focus.y - (focus.h ?? 40) / 2)) < reach;
    }
    if (input.pressed('interact') || clickedIt) api.world.interact();
  } else {
    ui.hideHint();
    input.consumeClick();
  }

  // Panel hotkeys. These use the RAW input check on purpose: an open panel
  // locks gameplay input, but I/J/H should still switch between panels and
  // toggle the current one shut. Narration and memory playback own the
  // keyboard entirely, so they are excluded.
  if (!ui.narrating && !api.playback.active) {
    if (input.pressedRaw('inventory')) ui.openPanel('inventory', ...PANELS.inventory);
    else if (input.pressedRaw('journal')) ui.openPanel('journal', ...PANELS.journal);
    else if (input.pressedRaw('help')) ui.openPanel('help', ...PANELS.help);
  }

  input.flush();
}

function render(ctx) {
  api.world.render(ctx);
}

const loop = new Loop(canvas, update, render);

// ── Boot ───────────────────────────────────────────────────────────────────

const bootEl = document.getElementById('boot');
const btnNew = document.getElementById('btn-new');
const btnContinue = document.getElementById('btn-continue');
const wipeWrap = document.getElementById('boot-wipe');

if (save.hasSave()) {
  btnContinue.classList.remove('hidden');
  btnNew.textContent = 'START OVER';
  btnNew.classList.add('ghost');
  wipeWrap.classList.remove('hidden');
  document.getElementById('btn-wipe').addEventListener('click', () => {
    if (!confirm('Erase saved progress?')) return;
    save.wipe();
    location.reload();
  });
}

btnContinue.addEventListener('click', () => startGame(true));
btnNew.addEventListener('click', () => {
  if (save.hasSave() && !confirm('Start over? Your current progress will be erased.')) return;
  save.wipe();
  startGame(false);
});

async function startGame(continuing) {
  bootEl.classList.add('hidden');
  audio.unlock();
  audioBtn.textContent = `AUDIO: ${state.data.settings.muted ? 'OFF' : 'ON'}`;

  if (continuing) {
    const loaded = save.load();
    if (loaded) state.replace(loaded);
  }

  running = true;
  loop.start();

  // A save can name an area that a later build renamed or removed; never let
  // that strand the player on a black screen.
  let areaId = state.data.player.area ?? 'garage';
  if (!getDimension(areaId)?.build) {
    console.warn(`[boot] saved area "${areaId}" no longer exists — returning to the garage.`);
    areaId = 'garage';
  }
  api.world.enter(areaId, { x: state.data.player.x, y: state.data.player.y });
  audio.ambience(api.world.current.ambience);

  if (!save.available) {
    ui.toast('This browser will not let the game save. Progress will be lost when you close the tab.',
      { kind: 'warn', label: 'NO SAVE', ms: 12000 });
  }

  if (continuing) {
    await fx.fadeIn(700);
    ui.toast('Progress restored.', { label: 'SAVE' });
    api.story.evaluate();
    return;
  }

  await runIntro();
}

/** The cold open. Short, disorienting, then hands over control. */
async function runIntro() {
  fx.blackout();
  ui.lockInput(true);
  await ui.wait(400);

  await ui.narrate([
    'You were walking home.',
    'Lower rings, night cycle, the usual smell of ozone and fried something. You were thinking about nothing in particular.',
    'Someone said your name behind you. You turned around because that is what people do.',
    'A sting in the side of your neck. Cold going up, not down.',
    'Then a floor.',
  ]);

  await fx.fadeIn(2200);
  audio.play('unease');
  await ui.wait(400);

  state.addClue('clue_woke_here');
  state.log('Woke up on the floor of a garage. No idea how.', 'event');

  await ui.narrate([
    'You are lying on the floor of a garage.',
    'It is not your garage. You do not have a garage. The ceiling is covered in equipment you have no name for and one thing that is definitely a severed arm in a jar.',
    'Your neck hurts. There is a small, clean puncture mark on it, already scabbed over.',
    'In the corner of the room, something green is turning slowly in the air, and it is the only thing here that looks like a way out.',
  ]);

  state.setFlag('introSeen', true);
  ui.toast('Move with WASD or the arrow keys. Press E next to things.', { label: 'CONTROLS', ms: 9000 });
  save.save();
}

// A tab that loses focus mid-narration shouldn't eat the keypress queue.
window.addEventListener('blur', () => input.down.clear());

// Surface hard errors instead of freezing on a blank canvas.
window.addEventListener('error', (e) => {
  console.error('[fatal]', e.error ?? e.message);
  if (running) ui.toast('Something broke. Check the console — and tell the developer.', { kind: 'warn', label: 'ERROR' });
});

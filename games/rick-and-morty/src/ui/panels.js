/**
 * Panel builders.
 *
 * Each export is a function that fills the panel body for one screen. They
 * receive (body, api, refresh) and are re-run whenever `refresh()` is called,
 * so they can be written as plain "render current state" functions.
 */

import { RARITY_COLOR } from '../data/items.js';
import { getResearch } from '../data/research.js';
import { groupClues } from '../data/clues.js';
import { DIMENSIONS, dialableDimensions } from '../data/dimensions.js';
import { TOTAL_FRAGMENTS } from '../data/memories.js';
import { formatTime } from '../core/util.js';

/** Minimal DOM builder: h('div.row', {}, [children]) */
export function h(tag, props = {}, children = []) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(props)) {
    if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'class') el.className = `${el.className} ${v}`.trim();
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== null && v !== undefined) el.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

const section = (t) => h('div.p-section', { text: t });
const lead = (t) => h('p.p-lead', { text: t });
const empty = (t) => h('div.p-empty', { text: t });

/** Standard list row with a glyph, name/desc and optional action button. */
function row(glyph, name, desc, action, opts = {}) {
  return h('div.row', { class: opts.class ?? '' }, [
    h('div.glyph', { text: glyph, style: opts.color ? `color:${opts.color}` : '' }),
    h('div.meta', {}, [h('b', { text: name }), h('span', { text: desc })]),
    action ?? null,
  ]);
}

// ───────────────────────────────────────────────────────────────────────────
// POCKETS
// ───────────────────────────────────────────────────────────────────────────
export function inventoryPanel(body, api) {
  const items = api.inventory.list();
  body.appendChild(lead('Everything you are carrying. You do not remember owning any of it, which tracks.'));
  if (!items.length) {
    body.appendChild(empty('Empty. Lint, and the vague sense of having been robbed.'));
    return;
  }
  for (const { item, count } of items) {
    const researched = api.research.availableEntries()
      .filter((e) => e.item === item.id && api.research.isComplete(e.id)).length > 0;
    body.appendChild(row(
      item.glyph,
      count > 1 ? `${item.name} ×${count}` : item.name,
      item.desc,
      researched ? h('span.tagchip', { text: 'analysed' }) : null,
      { class: item.rarity === 'common' ? '' : 'odd', color: RARITY_COLOR[item.rarity] },
    ));
  }
}

// ───────────────────────────────────────────────────────────────────────────
// JOURNAL — clues grouped by thread, plus a plain log
// ───────────────────────────────────────────────────────────────────────────
export function journalPanel(body, api) {
  const s = api.state.data;
  body.appendChild(lead('What you know, sorted into the shapes it seems to want to make.'));

  const groups = groupClues(s.clues);
  if (!groups.length) {
    body.appendChild(empty('You know nothing. Aggressively nothing.'));
  }
  for (const g of groups) {
    body.appendChild(section(g.thread.name));
    for (const clue of g.clues) {
      body.appendChild(h('div.row', {}, [
        h('div.glyph', { text: '❯', style: 'color:#97ce4c' }),
        h('div.meta', {}, [h('b', { text: clue.title }), h('span', { text: clue.text })]),
      ]));
    }
  }

  body.appendChild(section('Log'));
  const log = s.journal.slice(-14).reverse();
  if (!log.length) body.appendChild(empty('Nothing logged yet.'));
  const pre = h('div.term');
  for (const entry of log) {
    const time = new Date(entry.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    pre.appendChild(h('span.dim', { text: `[${time}] ` }));
    pre.appendChild(document.createTextNode(`${entry.text}\n`));
  }
  body.appendChild(pre);
}

// ───────────────────────────────────────────────────────────────────────────
// HELP
// ───────────────────────────────────────────────────────────────────────────
export function helpPanel(body, api) {
  const s = api.state.data;
  body.appendChild(lead('This is a Phase 1 beta. Things are missing on purpose. Other things are missing by accident.'));

  body.appendChild(section('Controls'));
  const controls = [
    ['W A S D / arrows', 'walk'],
    ['Shift', 'walk faster'],
    ['E / Space', 'interact with whatever you are standing next to'],
    ['Mouse click', 'interact with the highlighted thing'],
    ['I', 'pockets'],
    ['J', 'journal'],
    ['H', 'this screen'],
    ['Esc', 'close a panel'],
  ];
  const list = h('div');
  for (const [k, v] of controls) {
    list.appendChild(h('div', { style: 'margin-bottom:6px' }, [
      h('kbd.k', { text: k }), document.createTextNode(`  ${v}`),
    ]));
  }
  body.appendChild(list);

  body.appendChild(section('What you are supposed to do'));
  body.appendChild(h('p', { text: 'Nothing, specifically. Look at things. Take things that come loose. Bring them back to the research station and find out what they are. The game does not keep a to-do list for you on purpose.' }));

  body.appendChild(section('This run'));
  body.appendChild(h('div.term', {}, [
    `PLAYTIME     ${formatTime(s.stats.playtimeMs)}\n` +
    `DISCOVERIES  ${s.stats.discoveries}\n` +
    `PORTAL TRIPS ${s.stats.portalTrips}\n` +
    `RESEARCH     ${s.research.completed.length} / ${api.research.totalEntries()}\n` +
    `MEMORY       ${s.memory.recovery}%  (${s.memory.fragments.length} / ${TOTAL_FRAGMENTS} fragments)\n` +
    `SAVED        ${s.savedAt ? new Date(s.savedAt).toLocaleTimeString() : 'not yet'}`,
  ]));

  body.appendChild(section('Audio'));
  const vol = h('input', {
    type: 'range', min: '0', max: '100', value: String(Math.round(s.settings.volume * 100)),
    style: 'width:220px',
    oninput: (e) => api.audio.setVolume(Number(e.target.value) / 100),
  });
  body.appendChild(h('div', {}, [vol]));

  body.appendChild(section('Danger zone'));
  body.appendChild(h('button.act.ghost', {
    text: 'ERASE SAVE AND RESTART',
    onclick: () => {
      if (!confirm('Erase all progress? There is no undo, and the garage will not remember you.')) return;
      api.save.wipe();
      location.reload();
    },
  }));
}

// ───────────────────────────────────────────────────────────────────────────
// RESEARCH STATION
// ───────────────────────────────────────────────────────────────────────────
export function researchPanel(body, api, refresh) {
  const job = api.research.active;
  body.appendChild(lead('Rick\'s analysis rig. Mostly duct tape and opinions. It will tell you what a thing is, eventually.'));

  if (job) {
    const entry = getResearch(job.entryId);
    const pct = Math.round(api.research.progress() * 100);
    body.appendChild(section('In progress'));
    body.appendChild(h('div.row.odd', {}, [
      h('div.glyph', { text: '⚗' }),
      h('div.meta', {}, [
        h('b', { text: entry.title }),
        h('span', { text: `${pct}% — ${Math.ceil(job.remaining)}s remaining. You can walk away; it keeps working.` }),
      ]),
      h('button.act.ghost', { text: 'CANCEL', onclick: () => { api.research.cancel(); refresh(); } }),
    ]));
  }

  const entries = api.research.availableEntries();
  body.appendChild(section(job ? 'Queue' : 'Samples the station recognises'));
  if (!entries.length) {
    body.appendChild(empty('Nothing here it can read. Bring back something strange.'));
  }

  for (const entry of entries) {
    const done = api.research.isComplete(entry.id);
    const blocked = api.research.blockedReason(entry);
    let action;
    if (done) {
      action = h('button.act.ghost', {
        text: 'READ REPORT',
        onclick: () => { api.audio.play('ui_blip'); showReport(body, api, entry, refresh); },
      });
    } else {
      action = h('button.act', {
        text: `ANALYSE · ${entry.seconds}s`,
        disabled: blocked ? 'disabled' : null,
        title: blocked ?? '',
        onclick: () => {
          if (api.research.start(entry.id)) { api.audio.play('research_start'); refresh(); }
        },
      });
    }
    body.appendChild(row(
      done ? '✔' : '⚗',
      entry.title,
      done ? 'Analysis on file.' : (blocked ?? `Estimated analysis time: ${entry.seconds} seconds.`),
      action,
      { class: done ? 'done' : '' },
    ));
  }
}

/** Render a finished report in place of the list. */
export function showReport(body, api, entry, refresh) {
  body.textContent = '';
  body.appendChild(h('button.act.ghost', { text: '‹ BACK', onclick: refresh }));
  body.appendChild(section(entry.title));
  const term = h('div.term');
  for (const para of entry.report) {
    term.appendChild(document.createTextNode(`${para}\n\n`));
  }
  if (entry.rewards?.unlockText) {
    term.appendChild(h('span.odd', { text: `>> ${entry.rewards.unlockText}\n` }));
  }
  body.appendChild(term);
  if (!api.state.data.research.read.includes(entry.id)) api.state.data.research.read.push(entry.id);
}

// ───────────────────────────────────────────────────────────────────────────
// MEMORY DEVICE
// ───────────────────────────────────────────────────────────────────────────
export function memoryPanel(body, api, refresh) {
  const s = api.state.data;
  const online = api.memory.isOnline();

  body.appendChild(h('div', { style: 'text-align:center;margin-bottom:6px' }, [
    h('div', { class: 'mem-pct', text: `MEMORY RECOVERY: ${s.memory.recovery}%` }),
  ]));
  const gauge = h('div.mem-gauge', {}, [h('i')]);
  body.appendChild(gauge);
  // Animate after insert so the CSS transition actually runs.
  requestAnimationFrame(() => { gauge.firstChild.style.width = `${s.memory.recovery}%`; });
  body.appendChild(h('p.p-lead', { text: api.memory.progressText(), style: 'text-align:center' }));

  if (!online) {
    body.appendChild(h('div.term', {}, [
      h('span.bad', { text: 'STATUS: IDLE — NO SOURCE MATERIAL\n' }),
      'The rig is intact and powered. It has nothing to reconstruct from.\n\n',
      h('span.dim', { text: 'Memory is not stored in your head the way you think it is. It leaves residue on whatever removed it. Find the thing that removed yours.' }),
    ]));
    return;
  }

  const pending = api.memory.pending();
  if (pending.length) {
    body.appendChild(section('Reconstructable'));
    for (const frag of pending) {
      body.appendChild(row('✦', frag.title, `Estimated recovery: +${frag.recovery}%`,
        h('button.act', {
          text: 'RECONSTRUCT',
          onclick: () => api.playFragment(frag.id),
        }), { class: 'odd' }));
    }
  }

  const owned = api.memory.owned();
  body.appendChild(section('Recovered'));
  if (!owned.length) body.appendChild(empty('Nothing reconstructed yet.'));
  for (const frag of owned) {
    body.appendChild(fragmentCard(frag, api));
  }
}

/** A recovered fragment, with its own little painted still. */
export function fragmentCard(frag, api) {
  const card = h('div.frag-card');
  const canvas = h('canvas', { width: '640', height: '200' });
  card.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  // One static frame is enough in the archive view; playback animates it.
  try { frag.paint(ctx, canvas.width, canvas.height, 1.4); } catch (err) { console.error(err); }

  const b = h('div.frag-body');
  b.appendChild(h('h4', { text: frag.title }));
  for (const line of frag.transcript) b.appendChild(h('p', { text: line }));
  if (frag.note) b.appendChild(h('p', { class: 'p-lead', text: frag.note }));
  const tags = h('div.frag-tags');
  for (const l of frag.locations ?? []) tags.appendChild(h('span.tagchip', { text: l.replace(/_/g, ' ') }));
  for (const c of frag.characters ?? []) tags.appendChild(h('span.tagchip', { text: c.replace(/_/g, ' ') }));
  b.appendChild(tags);
  b.appendChild(h('div', { style: 'margin-top:10px' }, [
    h('button.act.ghost', { text: 'REPLAY', onclick: () => api.playFragment(frag.id, true) }),
  ]));
  card.appendChild(b);
  return card;
}

// ───────────────────────────────────────────────────────────────────────────
// PORTAL DIAL
// ───────────────────────────────────────────────────────────────────────────
export function portalPanel(body, api) {
  const s = api.state.data;
  body.appendChild(lead('The gun is clamped into a wall rig and wired to the garage power. Somebody set it up to be used without them.'));

  const here = s.player.area;
  for (const dim of dialableDimensions(s)) {
    const known = s.dimensions.known.includes(dim.id);
    const check = api.portal.check(dim.id);
    const visits = s.dimensions.visited[dim.id]?.visits ?? 0;

    let desc = dim.blurb;
    if (!check.ok) desc = check.reason;
    else if (visits) desc = `${dim.blurb}  ·  ${visits} visit${visits === 1 ? '' : 's'}`;

    body.appendChild(row(
      check.ok ? '◎' : '⊘',
      `${dim.name}  —  ${dim.designation}`,
      desc,
      check.ok
        ? h('button.act', { text: here === dim.id ? 'YOU ARE HERE' : 'DIAL', disabled: here === dim.id ? 'disabled' : null,
            onclick: () => { api.ui.closePanel(); api.portal.travel(dim.id); } })
        : h('span.tagchip', { text: 'locked' }),
      { class: check.ok ? '' : 'done', color: check.ok ? '#97ce4c' : '#7f98a8' },
    ));
  }

  if (here !== 'garage') {
    body.appendChild(section('Home'));
    body.appendChild(row('⌂', DIMENSIONS.garage.name, 'Go back. Research what you found.',
      h('button.act', { text: 'RETURN', onclick: () => { api.ui.closePanel(); api.portal.travel('garage'); } })));
  }

  body.appendChild(section('Coordinate buffer'));
  body.appendChild(h('div.term', {}, [
    `KNOWN COORDINATES : ${s.dimensions.known.length}\n`,
    `REJECTED          : ${Object.values(DIMENSIONS).filter((d) => d.locked).length}\n`,
    h('span.dim', { text: 'The rig has room for a great many more than this. Most of the slots are empty. Some of the empty slots have labels.' }),
  ]));
}

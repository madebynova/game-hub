/**
 * Story clues.
 *
 * A clue is one durable piece of knowledge the player has acquired, from any
 * source (prop, research report, memory fragment, NPC line). The journal shows
 * them grouped by thread so the mystery accumulates visibly instead of being
 * scattered through dialogue the player already clicked past.
 *
 * Threads are open-ended on purpose — Phase 2 can add new ones without
 * touching the journal UI.
 */

export const THREADS = {
  waking:   { id: 'waking',   name: 'The Waking',        order: 1 },
  syringe:  { id: 'syringe',  name: 'The Syringe',       order: 2 },
  watcher:  { id: 'watcher',  name: 'Someone Is Watching', order: 3 },
  garage:   { id: 'garage',   name: 'Whose Garage Is This?', order: 4 },
  glassflats:{ id: 'glassflats', name: 'The Glass Flats', order: 5 },
};

export const CLUES = {
  clue_woke_here: {
    id: 'clue_woke_here', thread: 'waking',
    title: 'You woke up on a garage floor',
    text: 'Last clear memory: walking home from Blips & Chitz-adjacent nowhere, somewhere in the Citadel\'s lower rings. Then a sting in the neck. Then this floor.',
  },
  clue_neck_mark: {
    id: 'clue_neck_mark', thread: 'syringe',
    title: 'There is a puncture mark on your neck',
    text: 'Small, clean, already scabbed. Whoever did it has done it before, and did it fast.',
  },
  clue_not_your_garage: {
    id: 'clue_not_your_garage', thread: 'garage',
    title: 'This garage belongs to a Rick',
    text: 'The workbench, the portal residue, the handwriting on the board — a Rick lives here. He is not here now. Nothing suggests he left in a hurry.',
  },
  clue_sigil: {
    id: 'clue_sigil', thread: 'watcher',
    title: 'The open-eye sigil',
    text: 'A crude circle with a vertical slit through it, scratched into the workbench. You have seen it somewhere else. You cannot place where.',
  },
  clue_terminal_locked: {
    id: 'clue_terminal_locked', thread: 'garage',
    title: 'The terminal is not yours, and knows it',
    text: 'Most of the filesystem is locked behind an owner credential. The parts that are not locked are boring on purpose.',
  },
  clue_portal_preset: {
    id: 'clue_portal_preset', thread: 'garage',
    title: 'The portal has one destination preloaded',
    text: 'A single coordinate sits in the buffer, already dialled. Somebody queued up a trip and never took it.',
  },

  // ── Dimension side ───────────────────────────────────────────────────────
  clue_pod_crash: {
    id: 'clue_pod_crash', thread: 'glassflats',
    title: 'A Citadel transit pod crashed here',
    text: 'Not long ago. The hull is Citadel civil-transit grey, route stencil half burnt off. Nobody came to collect it, which on the Citadel means somebody decided nobody should.',
  },
  clue_pod_empty: {
    id: 'clue_pod_empty', thread: 'glassflats',
    title: 'The pod was carrying passengers',
    text: 'Four restraint harnesses. Four cut restraint harnesses. Cut from the inside.',
  },
  clue_route_9orph: {
    id: 'clue_route_9orph', thread: 'syringe',
    title: 'Route 9-ORPH',
    text: 'The transit chit lists a route that does not appear on any public Citadel line map. It terminates at a facility designation, not a district.',
  },
  clue_watched_lens: {
    id: 'clue_watched_lens', thread: 'watcher',
    title: 'Somebody was filming the flats',
    text: 'The optic you found was mounted, aimed and then ripped down. Whatever it was watching, it was watching it on purpose.',
  },
  clue_bipp: {
    id: 'clue_bipp', thread: 'glassflats',
    title: 'Bipp has seen a Rick out here',
    text: 'The salt-farmer says a Rick comes through "every few sleeps", never buys anything, and always walks back into a portal facing the wrong way.',
  },

  // ── Research / memory payoffs ────────────────────────────────────────────
  clue_lattice_is_neural: {
    id: 'clue_lattice_is_neural', thread: 'syringe',
    title: 'The shard is a memory substrate',
    text: 'Cortex lattice: a medium for storing — or removing — episodic memory. It is not alien tech. It is Citadel medical tech, modified past legality.',
  },
  clue_lattice_used: {
    id: 'clue_lattice_used', thread: 'syringe',
    title: 'The shard has been used',
    text: 'It is not blank stock. There is residue on it. Somebody put a mind through this thing, and some of what came off is still clinging to the filaments. Some of it reads as yours.',
  },
  clue_fragment1: {
    id: 'clue_fragment1', thread: 'waking',
    title: 'Memory 01: the corridor',
    text: 'A wet corridor, green light, a coat. A voice that already knows your name and sounds bored about it.',
  },
  clue_watcher_moved: {
    id: 'clue_watcher_moved', thread: 'watcher',
    title: 'Something moved while you were gone',
    text: 'You did not leave the garage like this. You are certain. Which is a strange thing to be certain about, given the state of your memory.',
  },
  clue_watcher_seen: {
    id: 'clue_watcher_seen', thread: 'watcher',
    title: 'You saw someone in the doorway',
    text: 'Tall. Lab coat. Wrong silhouette for a Rick — the proportions were off, or the light was. Gone before your eyes adjusted.',
  },
};

export function getClue(id) { return CLUES[id]; }

/** Group discovered clue ids by thread, for the journal UI. */
export function groupClues(ids) {
  const groups = new Map();
  for (const id of ids) {
    const clue = CLUES[id];
    if (!clue) continue;
    if (!groups.has(clue.thread)) groups.set(clue.thread, []);
    groups.get(clue.thread).push(clue);
  }
  return [...groups.entries()]
    .map(([threadId, clues]) => ({ thread: THREADS[threadId] ?? { id: threadId, name: threadId, order: 99 }, clues }))
    .sort((a, b) => a.thread.order - b.thread.order);
}

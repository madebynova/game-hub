/**
 * Research entries.
 *
 * One entry = one thing the research station can analyse. The station itself
 * (systems/research.js) knows nothing about specific items; it just reads these
 * definitions. That means a Phase 2 item with exotic requirements — needs a
 * garage upgrade, consumes reagents, requires another entry first, unlocks a
 * dimension — is a data change, not a code change.
 *
 * Fields:
 *   id           unique
 *   item         item id this consumes/analyses
 *   title        report heading
 *   seconds      analysis duration (real seconds of play, ticks only in-game)
 *   requires     { flags: [], research: [], upgrades: [] }  — all must be met
 *   consumes     true to remove the item when the analysis completes
 *   report       array of paragraphs shown when complete
 *   rewards      { clues: [], flags: {}, memoryFragment: 'id', dimensions: [], unlockText }
 */

export const RESEARCH = {
  res_glass_shard: {
    id: 'res_glass_shard', item: 'glass_shard', title: 'Singing Glass Shard',
    seconds: 12, consumes: false,
    report: [
      'Silicate lattice, but the lattice is doing something silicate lattices do not do: it is oscillating at a fixed 437 Hz regardless of temperature, pressure or being hit with a hammer (twice).',
      'Conclusion: the glass trees on that dimension are not geology. They are a medium. Something is using them to carry a signal.',
      'Insufficient equipment to determine what the signal says. Noted for later.',
    ],
    rewards: { clues: [], flags: {}, unlockText: 'A signal carrier. Worth revisiting when the garage can listen properly.' },
  },

  res_salt_crystal: {
    id: 'res_salt_crystal', item: 'salt_crystal', title: 'Bitter Salt Crystal',
    seconds: 8, consumes: false,
    report: [
      'Sodium chloride, trace potassium, and 0.4% of an organic compound the station files under "probably fine".',
      'The compound is a mild neural conductant. Farmed salt from that dimension would make a population very slightly more suggestible.',
      'Somebody is farming it. Draw your own conclusions; the station refuses to.',
    ],
    rewards: { clues: [] },
  },

  res_rusted_bolt: {
    id: 'res_rusted_bolt', item: 'rusted_bolt', title: 'Citadel-Standard Bolt',
    seconds: 6, consumes: false,
    report: [
      'Citadel civil-works part, batch stamp intact. Manufactured 14 cycles ago, installed recently, sheared under lateral stress.',
      'It came off something that was travelling fast and stopped disagreeing with physics all at once.',
    ],
    rewards: { clues: ['clue_pod_crash'] },
  },

  res_spore_pod: {
    id: 'res_spore_pod', item: 'spore_pod', title: 'Wilted Spore Pod', seconds: 10, consumes: false,
    report: [
      'Dormant, not dead. It is waiting for something, and the station\'s best guess at what is "a warm body".',
      'Storage recommendation: not in your pocket. Filed under: too late.',
    ],
    rewards: { clues: [] },
  },

  res_humming_cube: {
    id: 'res_humming_cube', item: 'humming_cube', title: 'Humming Cube', seconds: 20, consumes: false,
    report: [
      'No seams. No joins. No detectable interior. Mass is 2.1 kg and does not change. Temperature is 4°C below ambient and does not change.',
      'Spectrography returns an error the station has never produced before: OBJECT DECLINES.',
      'It is not an anomaly. It is a device, and it is switched off, and the off switch is on the inside.',
    ],
    rewards: { clues: [], unlockText: 'The cube is a device that is switched off. You do not have what it wants yet.' },
  },

  res_cracked_lens: {
    id: 'res_cracked_lens', item: 'cracked_lens', title: 'Cracked Optic', seconds: 14, consumes: false,
    report: [
      'Citadel surveillance optic, civilian-illegal grade. Mount shows tool marks: it was installed carefully and removed angrily.',
      'The buffer is wiped, but the wipe was done by someone in a hurry — the last frame index survives. It recorded 31 hours of the salt flats and then someone tore it off a glass tree.',
      'Thirty-one hours of a dimension where, officially, nothing happens.',
    ],
    rewards: { clues: ['clue_watched_lens', 'clue_sigil'] },
  },

  res_transit_key: {
    id: 'res_transit_key', item: 'transit_key', title: 'Scorched Transit Chit', seconds: 16, consumes: false,
    report: [
      'Citadel transit chit, single-use, punched. Route stencil: 9-ORPH.',
      'Cross-reference against the public line map: no such route. Cross-reference against the *maintenance* map, which this terminal should not have: 9-ORPH is a staff shuttle. It runs one way, at night, to a designation rather than a district.',
      'The designation is redacted even here. That takes effort. Somebody paid for that effort.',
    ],
    rewards: { clues: ['clue_route_9orph'] },
  },

  // ── The critical one ─────────────────────────────────────────────────────
  res_cortex_shard: {
    id: 'res_cortex_shard', item: 'cortex_shard', title: 'Cortex Lattice Shard',
    seconds: 25, consumes: false,
    report: [
      'Cortex lattice. Citadel medical stock, heavily modified — the read head has been reversed and the safety interlocks are not disabled so much as physically absent.',
      'In its legal form this thing helps stroke patients reconstruct episodic memory. In this form it does the same job backwards: it lifts memory out and holds it.',
      'This shard is not blank. There is residue in the filaments. Fragmentary, degraded, recoverable with the right hardware — and there is a memory reconstruction rig sitting three metres to your left, which until this moment had nothing to reconstruct from.',
      'One more thing, flagged by the station and then flagged again in a larger font: the residue is a partial genetic match to the operator. To you. This came out of your head.',
    ],
    rewards: {
      clues: ['clue_lattice_is_neural', 'clue_lattice_used'],
      flags: { memoryDeviceOnline: true },
      unlockText: 'MEMORY RECONSTRUCTION RIG: SOURCE MATERIAL DETECTED. The device in the corner has stopped being furniture.',
    },
  },
};

/** All entries that analyse a given item id. */
export function entriesForItem(itemId) {
  return Object.values(RESEARCH).filter((r) => r.item === itemId);
}

export function getResearch(id) { return RESEARCH[id]; }

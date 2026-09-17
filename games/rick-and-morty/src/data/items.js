/**
 * Item catalogue.
 *
 * Data only — no behaviour. Everything the systems need to know about an item
 * is declared here, so adding Phase 2 loot is a matter of appending entries.
 *
 * Fields:
 *   id        unique key (also the inventory key)
 *   name      display name
 *   glyph     emoji/character used in list UI (cheap stand-in for icon art)
 *   rarity    'common' | 'odd' | 'rare' | 'anomalous'   (drives colour + flavour)
 *   kind      'junk' | 'material' | 'tech' | 'bio' | 'document'
 *   desc      what the player sees before research
 *   researchable  whether the research station will accept it
 *   tags      free-form, used by future filters/recipes
 */

export const ITEMS = {
  // ── Ordinary finds ───────────────────────────────────────────────────────
  glass_shard: {
    id: 'glass_shard', name: 'Singing Glass Shard', glyph: '🔷',
    rarity: 'common', kind: 'material',
    desc: 'A sliver from one of the glass trees. It hums a quarter-tone flat when you hold it.',
    researchable: true, tags: ['glassflats', 'mineral'],
  },
  salt_crystal: {
    id: 'salt_crystal', name: 'Bitter Salt Crystal', glyph: '🧂',
    rarity: 'common', kind: 'material',
    desc: 'Tastes like salt, regret, and a little bit of batteries. You should stop tasting things.',
    researchable: true, tags: ['glassflats', 'mineral'],
  },
  rusted_bolt: {
    id: 'rusted_bolt', name: 'Citadel-Standard Bolt', glyph: '🔩',
    rarity: 'common', kind: 'junk',
    desc: 'Stamped with a Citadel part number. Somebody built something out here. Or crashed it.',
    researchable: true, tags: ['citadel', 'salvage'],
  },
  spore_pod: {
    id: 'spore_pod', name: 'Wilted Spore Pod', glyph: '🫧',
    rarity: 'common', kind: 'bio',
    desc: 'Dry, papery, faintly warm. It flinches if you squeeze it, which is upsetting.',
    researchable: true, tags: ['glassflats', 'organic'],
  },

  // ── Unusual ──────────────────────────────────────────────────────────────
  humming_cube: {
    id: 'humming_cube', name: 'Humming Cube', glyph: '⬛',
    rarity: 'odd', kind: 'tech',
    desc: 'A matte cube with no seams. It is 4°C colder than everything around it, always.',
    researchable: true, tags: ['anomaly', 'unknown-origin'],
  },
  cracked_lens: {
    id: 'cracked_lens', name: 'Cracked Optic', glyph: '👁',
    rarity: 'odd', kind: 'tech',
    desc: 'A surveillance-grade lens, snapped clean out of its housing. Recently, by the look of it.',
    researchable: true, tags: ['surveillance', 'citadel'],
  },
  transit_key: {
    id: 'transit_key', name: 'Scorched Transit Chit', glyph: '🎫',
    rarity: 'odd', kind: 'document',
    desc: 'A burnt Citadel transit chit. Most of it is ash. A route number survived: 9-ORPH.',
    researchable: true, tags: ['citadel', 'clue'],
  },

  // ── The one that matters (Phase 1 critical path) ─────────────────────────
  cortex_shard: {
    id: 'cortex_shard', name: 'Cortex Lattice Shard', glyph: '🧠',
    rarity: 'rare', kind: 'tech',
    desc: 'Wet-looking crystal threaded with hair-fine filaments. Holding it makes your teeth ache and your own handwriting appear behind your eyes.',
    researchable: true, tags: ['neural', 'critical', 'syringe'],
  },
};

export function getItem(id) {
  const item = ITEMS[id];
  if (!item) console.warn(`[items] unknown item id: ${id}`);
  return item;
}

export const RARITY_COLOR = {
  common: '#7f98a8',
  odd: '#c46bff',
  rare: '#ffc857',
  anomalous: '#ff5f6d',
};

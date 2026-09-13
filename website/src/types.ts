/** Shared content types. Add optional fields here as real information appears. */

/**
 * Where a game is in its life.
 *
 * Drives the badge, the primary action and how a card behaves, all through
 * `src/lib/gameAction.ts` — nothing else should branch on status.
 */
export type GameStatus = 'playable' | 'in-development' | 'coming-soon'

/**
 * A game in the NOVA library.
 *
 * Only `id`, `title`, `slug` and `status` are required. Every other field is
 * optional on purpose: the UI renders what exists and omits what doesn't, so a
 * game can be listed the moment it has a name and grow from there.
 */
export interface Game {
  id: string
  /** The name players see. */
  title: string
  /** URL segment, and the folder name under public/games. Never shown. */
  slug: string
  /** Optional second line under the title, e.g. a subtitle on the box art. */
  subtitle?: string
  status: GameStatus
  /** True only when there is a real, working URL people can play right now. */
  playable?: boolean
  /** Where PLAY goes. Required for `playable` to have any effect. */
  playUrl?: string
  /** Public source repository, if there is one. */
  githubUrl?: string
  /** Cover image path (put files in /public). Falls back to generated art. */
  artwork?: string
  /** Wide banner for the featured slot and game page. Falls back to the cover. */
  banner?: string
  /** Alt text for the artwork. Required whenever artwork is set. */
  artworkAlt?: string
  /** Real screenshots only. Leave empty until they exist. */
  screenshots?: { src: string; alt: string }[]
  /** One short line for library cards. Falls back to `description`. */
  tagline?: string
  /** One or two sentences. Omit entirely rather than writing a placeholder. */
  description?: string
  /** Longer body copy, rendered as paragraphs. */
  body?: string[]
  /** Concrete things the game does. Omit unless they are real. */
  features?: string[]
  /** Controls reference, when the game has a fixed control scheme. */
  controls?: { keys: string; action: string }[]
  /** Where it runs, e.g. "Browser". Shown under Project information. */
  platform?: string
  /** What it is built with, e.g. ["TypeScript", "Vite"]. */
  tech?: string[]
  /** Shows the game in the homepage spotlight. At most one should be true. */
  featured?: boolean
  /** Sorts the library. Higher first. Defaults to 0. */
  order?: number
}

/** One entry in a game's changelog. */
export interface UpdateEntry {
  id: string
  /** Slug of the game this belongs to. Updates live on that game's page. */
  gameSlug: string
  /** The game's own version label, if it has one, e.g. "v2.7". */
  version?: string
  /** Heading, e.g. "Black Market Auctions". */
  title: string
  /** ISO date, e.g. "2026-01-20". */
  date: string
  /** Optional lead paragraph. */
  summary?: string
  /** Grouped change lists. Only include groups that have real entries. */
  changes?: { label: string; items: string[] }[]
}

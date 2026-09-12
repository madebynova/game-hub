import type { Game } from '../types'

/**
 * The NOVA library.
 *
 * Empty on purpose: nothing is listed here until it is real. Adding a game
 * means adding an object to this array — no component needs touching. It then
 * appears in the library grid and gets its own page at `/games/<slug>`.
 *
 * Only `id`, `title`, `slug` and `status` are required. Every other field is
 * optional and the UI renders only what exists, so a game can be listed the
 * moment it has a name and grow from there. Never fill a field to make the
 * page look fuller — an absent section is the designed state.
 *
 * A fully populated entry looks like this:
 *
 *   {
 *     id: 'my-game',
 *     title: 'My Game',
 *     subtitle: 'Subtitle',            // optional second line
 *     slug: 'my-game',
 *     status: 'playable',              // 'playable' | 'in-development' | 'coming-soon'
 *     playable: true,                  // with playUrl, turns on PLAY NOW
 *     playUrl: 'https://…',
 *     githubUrl: 'https://github.com/…',
 *     artwork: '/games/my-game/cover.png',     // 3:4, in public/
 *     banner: '/games/my-game/banner.png',     // 16:9, in public/
 *     artworkAlt: 'What the art shows',
 *     description: 'One or two sentences.',
 *     body: ['A paragraph.', 'Another.'],
 *     features: ['Something the game actually does'],
 *     controls: [{ keys: 'WASD', action: 'Move' }],
 *     screenshots: [{ src: '/games/my-game/1.png', alt: '…' }],
 *     featured: true,                  // homepage spotlight; at most one
 *     order: 100,                      // library sort, higher first
 *   }
 *
 * See `src/types.ts` for the authoritative shape.
 */
export const games: Game[] = []

/** Library order: featured and newer entries first, then alphabetical. */
export const libraryGames: Game[] = [...games].sort(
  (a, b) => (b.order ?? 0) - (a.order ?? 0) || a.title.localeCompare(b.title),
)

export function getGame(slug: string): Game | undefined {
  return games.find((game) => game.slug === slug)
}

/** The hero game, if one is marked featured. */
export function getFeaturedGame(): Game | undefined {
  return libraryGames.find((game) => game.featured)
}

export { isPlayable } from '../lib/gameAction'

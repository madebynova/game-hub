import type { Game } from '../types'

/**
 * What a game's primary button says and does.
 *
 * Status is the only input, so every surface — card, hero, detail page — agrees
 * on it. Adding a status means editing this file and nothing else.
 *
 *   playable        PLAY NOW      → the real play URL
 *   in-development  VIEW PROJECT  → the game page
 *   coming-soon     COMING SOON   → nothing; there is nowhere to go yet
 */
export type GameActionKind = 'play' | 'view' | 'none'

/**
 * A discriminated union, so callers that check `kind` get a guaranteed
 * destination instead of an optional one.
 */
export type GameAction =
  /** Launch the game. `href` is a real, external play URL. */
  | { kind: 'play'; label: string; href: string }
  /** Read about it. `to` is an internal route. */
  | { kind: 'view'; label: string; to: string }
  /** Nowhere to go yet — render as a marker, not a button. */
  | { kind: 'none'; label: string }

/** True only when there is a real, working URL people can play right now. */
export function isPlayable(game: Game): game is Game & { playUrl: string } {
  return game.status === 'playable' && Boolean(game.playable) && Boolean(game.playUrl)
}

export function gameAction(game: Game): GameAction {
  if (isPlayable(game)) {
    return { kind: 'play', label: 'Play now', href: game.playUrl }
  }

  if (game.status === 'coming-soon') {
    return { kind: 'none', label: 'Coming soon' }
  }

  // Everything else — including a `playable` game whose URL isn't live yet —
  // has a page worth reading.
  return { kind: 'view', label: 'View project', to: `/games/${game.slug}` }
}

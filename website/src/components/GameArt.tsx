import type { Game } from '../types'
import './GameArt.css'

interface GameArtProps {
  game: Game
  /** 'cover' is the 3:4 library tile, 'banner' the wide featured slot. */
  variant?: 'cover' | 'banner'
  /** Native lazy-loading. Turn off for above-the-fold art. */
  lazy?: boolean
  className?: string
}

/** Stable 0–359 hue from a string, so each game's fallback plate is its own. */
function hueFor(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return hash % 360
}

/**
 * A game's artwork, or a generated stand-in when there isn't any yet.
 *
 * The stand-in is a typographic plate — the title, set large, on a tinted
 * ground — rather than anything pretending to be a screenshot. A game with no
 * art looks deliberately unillustrated instead of broken.
 */
export function GameArt({ game, variant = 'cover', lazy = true, className }: GameArtProps) {
  const src = variant === 'banner' ? (game.banner ?? game.artwork) : game.artwork
  const wrapper = ['art', `art--${variant}`, className].filter(Boolean).join(' ')

  if (src) {
    return (
      <div className={wrapper}>
        <img
          className="art__img"
          src={src}
          alt={game.artworkAlt ?? `${game.title} artwork`}
          loading={lazy ? 'lazy' : 'eager'}
          decoding="async"
        />
      </div>
    )
  }

  return (
    <div
      className={`${wrapper} art--generated`}
      style={{ ['--art-hue' as string]: hueFor(game.slug) }}
      aria-hidden="true"
    >
      <span className="art__tick" />
      <span className="art__wordmark">{game.title}</span>
      {game.subtitle ? <span className="art__sub">{game.subtitle}</span> : null}
    </div>
  )
}

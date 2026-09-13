import type { Game } from '../types'
import './GameArt.css'

interface GameArtProps {
  game: Game
  /** 'cover' is the 3:4 library tile, 'banner' the wide featured slot. */
  variant?: 'cover' | 'banner'
  /** Native lazy-loading. Turn off for above-the-fold art. */
  lazy?: boolean
  /** Empty alt, for art beside text that already names the game. */
  decorative?: boolean
  /**
   * On narrow screens, swap a cover for the game's banner. Used where a card
   * turns wide on phones, so the existing art is shown whole rather than
   * cropped to a sliver.
   */
  bannerOnNarrow?: boolean
  className?: string
}

/** Below this width, `bannerOnNarrow` shows the banner. Matches GameCard.css. */
const NARROW = '(max-width: 599px)'

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
export function GameArt({
  game,
  variant = 'cover',
  lazy = true,
  decorative = false,
  bannerOnNarrow = false,
  className,
}: GameArtProps) {
  const src = variant === 'banner' ? (game.banner ?? game.artwork) : game.artwork
  const wrapper = ['art', `art--${variant}`, className].filter(Boolean).join(' ')

  if (src) {
    const img = (
      <img
        className="art__img"
        src={src}
        alt={decorative ? '' : (game.artworkAlt ?? `${game.title} artwork`)}
        loading={lazy ? 'lazy' : 'eager'}
        decoding="async"
      />
    )
    const swap = bannerOnNarrow && variant === 'cover' && game.banner

    return (
      <div className={wrapper}>
        {swap ? (
          <picture style={{ display: 'contents' }}>
            <source media={NARROW} srcSet={game.banner} />
            {img}
          </picture>
        ) : (
          img
        )}
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

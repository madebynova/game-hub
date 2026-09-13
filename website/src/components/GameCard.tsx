import { Link } from 'react-router-dom'
import type { Game } from '../types'
import { GameArt } from './GameArt'
import { StatusBadge } from './StatusBadge'
import { gameAction } from '../lib/gameAction'
import { ArrowIcon, PlayIcon } from './icons'
import './GameCard.css'

interface GameCardProps {
  game: Game
  /** Above-the-fold cards should not lazy-load their art. */
  eager?: boolean
  /** Position in the grid, for the entrance stagger. */
  index?: number
}

/**
 * A library tile: artwork, title, one line about the game, its status, and
 * what you can do with it. Everything else belongs on the game page.
 *
 * The title link is stretched over the whole card, so anywhere you click opens
 * the game page. A playable game also gets a real PLAY NOW link that sits
 * above that, so launching the game is one click from the library.
 */
export function GameCard({ game, eager = false, index = 0 }: GameCardProps) {
  const action = gameAction(game)
  const playable = action.kind === 'play'
  const blurb = game.tagline ?? game.description

  return (
    <article
      className={`card${playable ? ' card--playable' : ''}`}
      style={{ ['--i' as string]: index }}
    >
      <div className="card__art">
        <GameArt game={game} lazy={!eager} decorative bannerOnNarrow />
        <div className="card__badge">
          <StatusBadge status={game.status} />
        </div>
        {playable ? (
          <span className="card__glyph" aria-hidden="true">
            <PlayIcon size={18} />
          </span>
        ) : null}
      </div>

      <div className="card__body">
        <div className="card__heading">
          <h3 className="card__title">
            <Link to={`/games/${game.slug}`} className="card__link">
              {game.title}
            </Link>
          </h3>
          {game.subtitle ? <p className="card__subtitle">{game.subtitle}</p> : null}
        </div>

        {blurb ? <p className="card__blurb">{blurb}</p> : null}

        <div className="card__actions">
          {action.kind === 'play' ? (
            <a
              className="card__btn card__btn--play"
              href={action.href}
              target="_blank"
              rel="noreferrer noopener"
            >
              <PlayIcon size={11} />
              {action.label}
              <span className="visually-hidden"> {game.title} (opens in a new tab)</span>
            </a>
          ) : null}

          {/* Visual only: the stretched title link above already goes here. */}
          <span className="card__btn card__btn--view" aria-hidden="true">
            {playable ? 'Details' : action.kind === 'none' ? action.label : 'View game'}
            <ArrowIcon size={12} className="card__arrow" />
          </span>
        </div>
      </div>
    </article>
  )
}

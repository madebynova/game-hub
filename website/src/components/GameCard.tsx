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
 * A library tile: artwork, title, status, and what you can do with it. Nothing
 * else — extra fields belong on the game page, not on a grid of covers.
 *
 * The title link is stretched over the whole card, so anywhere you click opens
 * the game page. A playable game also gets a real PLAY NOW link that sits
 * above that, so launching the game is one click from the library.
 */
export function GameCard({ game, eager = false, index = 0 }: GameCardProps) {
  const action = gameAction(game)
  const playable = action.kind === 'play'

  return (
    <article
      className={`card${playable ? ' card--playable' : ''}`}
      style={{ ['--i' as string]: index }}
    >
      <div className="card__art">
        <GameArt game={game} lazy={!eager} decorative />
        {playable ? (
          <span className="card__glyph" aria-hidden="true">
            <PlayIcon size={18} />
          </span>
        ) : null}
      </div>

      <div className="card__body">
        <h3 className="card__title">
          <Link to={`/games/${game.slug}`} className="card__link">
            {game.title}
          </Link>
        </h3>
        {game.subtitle ? <p className="card__subtitle">{game.subtitle}</p> : null}

        <div className="card__foot">
          <StatusBadge status={game.status} />

          {action.kind === 'play' ? (
            <a className="card__play" href={action.href} target="_blank" rel="noreferrer noopener">
              <PlayIcon size={10} />
              {action.label}
              <span className="visually-hidden">
                {' '}
                {game.title} (opens in a new tab)
              </span>
            </a>
          ) : (
            <span className="card__cue" aria-hidden="true">
              View
              <ArrowIcon size={12} />
            </span>
          )}
        </div>
      </div>
    </article>
  )
}

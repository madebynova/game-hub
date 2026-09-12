import { Link } from 'react-router-dom'
import type { Game } from '../types'
import { GameArt } from './GameArt'
import { StatusBadge } from './StatusBadge'
import { gameAction } from '../lib/gameAction'
import { PlayIcon } from './icons'
import './GameCard.css'

interface GameCardProps {
  game: Game
  /** Above-the-fold cards should not lazy-load their art. */
  eager?: boolean
}

/**
 * A library tile: artwork, title, status. Nothing else by default — extra
 * fields belong on the game page, not on a grid of covers.
 *
 * The whole card is one link to the game page. The PLAY chip is a visual
 * affordance rather than a nested link, so there is exactly one tab stop per
 * card and the destination is never ambiguous.
 */
export function GameCard({ game, eager = false }: GameCardProps) {
  const action = gameAction(game)

  return (
    <article className="card">
      <Link to={`/games/${game.slug}`} className="card__link">
        <div className="card__art">
          <GameArt game={game} lazy={!eager} />
          {action.kind === 'play' ? (
            <span className="card__chip card__chip--play" aria-hidden="true">
              <PlayIcon size={11} />
              Play
            </span>
          ) : null}
        </div>

        <div className="card__body">
          <h3 className="card__title">{game.title}</h3>
          <StatusBadge status={game.status} />
        </div>
      </Link>
    </article>
  )
}

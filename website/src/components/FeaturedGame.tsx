import { Link } from 'react-router-dom'
import type { Game } from '../types'
import { GameArt } from './GameArt'
import { StatusBadge } from './StatusBadge'
import { GameActions } from './GameActions'
import './FeaturedGame.css'

interface FeaturedGameProps {
  game: Game
}

/**
 * The homepage spotlight. Shows only what the game actually has: the
 * description is skipped entirely when absent, so a game with nothing but a
 * name and a status still renders cleanly.
 */
export function FeaturedGame({ game }: FeaturedGameProps) {
  return (
    <section className="featured" aria-labelledby="featured-title">
      <Link to={`/games/${game.slug}`} className="featured__art" tabIndex={-1} aria-hidden="true">
        <GameArt game={game} variant="banner" lazy={false} />
      </Link>

      <div className="featured__body">
        <p className="eyebrow">Featured</p>

        <h2 id="featured-title" className="featured__title">
          <Link to={`/games/${game.slug}`} className="featured__title-link">
            {game.title}
          </Link>
          {game.subtitle ? <span className="featured__subtitle">{game.subtitle}</span> : null}
        </h2>

        <StatusBadge status={game.status} size="md" />

        {game.description ? <p className="featured__desc">{game.description}</p> : null}

        <GameActions game={game} />
      </div>
    </section>
  )
}

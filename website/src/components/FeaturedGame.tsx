import { Link } from 'react-router-dom'
import type { Game } from '../types'
import { GameArt } from './GameArt'
import { StatusBadge } from './StatusBadge'
import { GameActions } from './GameActions'
import { NovaMark } from './icons'
import './FeaturedGame.css'

interface FeaturedGameProps {
  game: Game
}

/**
 * The homepage spotlight: the banner full-bleed, with the game's facts laid
 * over its darkened left side. Shows only what the game actually has — the
 * description is skipped entirely when absent.
 */
export function FeaturedGame({ game }: FeaturedGameProps) {
  return (
    <article className="featured" aria-labelledby="featured-title">
      <Link to={`/games/${game.slug}`} className="featured__art" tabIndex={-1} aria-hidden="true">
        <GameArt game={game} variant="banner" lazy={false} decorative />
      </Link>

      <div className="featured__body">
        <p className="featured__eyebrow">
          <NovaMark size={11} />
          Featured
        </p>

        <h2 id="featured-title" className="featured__title">
          <Link to={`/games/${game.slug}`} className="featured__title-link">
            {game.title}
          </Link>
        </h2>
        {game.subtitle ? <p className="featured__subtitle">{game.subtitle}</p> : null}

        <StatusBadge status={game.status} size="md" />

        {game.description ? <p className="featured__desc">{game.description}</p> : null}

        <GameActions game={game} />
      </div>
    </article>
  )
}

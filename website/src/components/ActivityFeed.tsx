import { Link } from 'react-router-dom'
import type { UpdateEntry } from '../types'
import { getGame } from '../data/games'
import { GameArt } from './GameArt'
import { ArrowIcon } from './icons'
import { formatDate } from '../lib/formatDate'
import './ActivityFeed.css'

interface ActivityFeedProps {
  updates: UpdateEntry[]
}

/**
 * Compact rows of recent updates, each linking to the Latest updates section
 * of its game's page. Entries for a game that isn't in the library are skipped.
 */
export function ActivityFeed({ updates }: ActivityFeedProps) {
  const rows = updates.flatMap((update) => {
    const game = getGame(update.gameSlug)
    return game ? [{ update, game }] : []
  })

  return (
    <ol className="activity">
      {rows.map(({ update, game }) => (
        <li key={update.id}>
          <Link to={`/games/${game.slug}#updates`} className="activity__item">
            <GameArt game={game} className="activity__thumb" decorative />

            <span className="activity__text">
              <span className="activity__game">
                {game.title}
                {update.version ? <span className="activity__version">{update.version}</span> : null}
              </span>
              <span className="activity__title">{update.title}</span>
            </span>

            <span className="activity__end">
              <time dateTime={update.date}>{formatDate(update.date, 'short')}</time>
              <ArrowIcon size={13} className="activity__arrow" />
            </span>
          </Link>
        </li>
      ))}
    </ol>
  )
}

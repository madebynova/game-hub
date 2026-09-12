import { Link } from 'react-router-dom'
import type { UpdateEntry } from '../types'
import { getGame } from '../data/games'
import './UpdateCard.css'

interface UpdateCardProps {
  update: UpdateEntry
  /** Hide the game name when the card is already inside that game's page. */
  showGame?: boolean
}

export function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/** One changelog entry. Groups with no items are skipped, not rendered empty. */
export function UpdateCard({ update, showGame = true }: UpdateCardProps) {
  const game = update.gameSlug ? getGame(update.gameSlug) : undefined
  const groups = (update.changes ?? []).filter((group) => group.items.length > 0)

  return (
    <article className="update">
      <header className="update__head">
        <div className="update__meta">
          {showGame && game ? (
            <Link to={`/games/${game.slug}`} className="update__game">
              {game.title}
            </Link>
          ) : null}
          <time className="update__date" dateTime={update.date}>
            {formatDate(update.date)}
          </time>
        </div>
        <h3 className="update__title">{update.title}</h3>
      </header>

      {update.summary ? <p className="update__summary">{update.summary}</p> : null}

      {groups.length > 0 ? (
        <div className="update__groups">
          {groups.map((group) => (
            <div className="update__group" key={group.label}>
              <h4 className="update__group-label">{group.label}</h4>
              <ul className="update__items">
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  )
}

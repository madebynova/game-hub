import type { UpdateEntry } from '../types'
import { countLabel } from '../lib/plural'
import { formatDate } from '../lib/formatDate'
import './UpdateCard.css'

interface UpdateCardProps {
  update: UpdateEntry
  /** Show the change lists open. Older entries start collapsed. */
  expanded?: boolean
}

/**
 * One changelog entry. The change lists sit in a native disclosure, so a long
 * history stays scannable and still works without JavaScript or a mouse.
 * Groups with no items are skipped, not rendered empty.
 */
export function UpdateCard({ update, expanded = false }: UpdateCardProps) {
  const groups = (update.changes ?? []).filter((group) => group.items.length > 0)
  const changeCount = groups.reduce((total, group) => total + group.items.length, 0)

  return (
    <article className="update">
      <header className="update__head">
        <div className="update__meta">
          {update.version ? <span className="update__version">{update.version}</span> : null}
          <time className="update__date" dateTime={update.date}>
            {formatDate(update.date)}
          </time>
        </div>
        <h3 className="update__title">{update.title}</h3>
      </header>

      {update.summary ? <p className="update__summary">{update.summary}</p> : null}

      {groups.length > 0 ? (
        <details className="update__details" open={expanded}>
          <summary className="update__toggle">{countLabel(changeCount, 'change')}</summary>
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
        </details>
      ) : null}
    </article>
  )
}

import { useId, useState } from 'react'
import type { UpdateEntry } from '../types'
import { UpdateCard } from './UpdateCard'
import { Button } from './Button'
import { countLabel } from '../lib/plural'

interface UpdateLogProps {
  updates: UpdateEntry[]
}

/** How many entries show before "Show earlier updates". */
const INITIAL = 3

/**
 * A game's changelog as a timeline, newest first. The newest entry is open,
 * the next few are collapsed, and anything older waits behind a button — so
 * the section stays the same size whether a game has three updates or thirty.
 */
export function UpdateLog({ updates }: UpdateLogProps) {
  const [showAll, setShowAll] = useState(false)
  const listId = useId()

  const visible = showAll ? updates : updates.slice(0, INITIAL)
  const hiddenCount = updates.length - INITIAL

  return (
    <div className="update-log">
      <ol className="update-list" id={listId}>
        {visible.map((update, index) => (
          <li key={update.id}>
            <UpdateCard update={update} expanded={index === 0} />
          </li>
        ))}
      </ol>

      {hiddenCount > 0 ? (
        <Button
          variant="secondary"
          className="update-log__more"
          aria-expanded={showAll}
          aria-controls={listId}
          onClick={() => setShowAll((value) => !value)}
        >
          {showAll ? 'Show fewer updates' : `Show ${countLabel(hiddenCount, 'earlier update')}`}
        </Button>
      ) : null}
    </div>
  )
}

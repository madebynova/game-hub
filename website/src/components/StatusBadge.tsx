import type { GameStatus } from '../types'
import './StatusBadge.css'

const LABELS: Record<GameStatus, string> = {
  playable: 'Playable',
  'in-development': 'In development',
  'coming-soon': 'Coming soon',
}

interface StatusBadgeProps {
  status: GameStatus
  size?: 'sm' | 'md'
}

/** The one place a status becomes visible text. */
export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  return (
    <span className={`status status--${status} status--${size}`}>
      <span className="status__dot" aria-hidden="true" />
      {LABELS[status]}
    </span>
  )
}

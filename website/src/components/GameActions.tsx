import type { Game } from '../types'
import { gameAction } from '../lib/gameAction'
import { Button, type ButtonSize } from './Button'
import { ArrowIcon, GitHubIcon, PlayIcon } from './icons'
import './GameActions.css'

interface GameActionsProps {
  game: Game
  /**
   * Where these buttons are.
   *
   * 'listing' is anywhere that points at the game — the homepage spotlight.
   * 'detail' is the game's own page, where "View project" would link to the
   * page you are already on, so it is dropped.
   */
  context?: 'listing' | 'detail'
  size?: ButtonSize
}

/**
 * A game's buttons. The primary one comes from `gameAction`, so the card, the
 * spotlight and the detail page can never disagree about what a status means.
 *
 * States with nowhere to go render a marker rather than a disabled button: a
 * dead button invites clicking.
 */
export function GameActions({ game, context = 'listing', size = 'lg' }: GameActionsProps) {
  const action = gameAction(game)
  const onDetail = context === 'detail'

  // On the game's own page a 'view' action is a self-link, so it is dropped —
  // which can leave the row with nothing but a marker to explain the absence.
  const showView = action.kind === 'view' && !onDetail
  const showPending = action.kind === 'view' && onDetail && !game.githubUrl

  return (
    <div className="actions">
      {action.kind === 'play' && (
        <Button href={action.href} size={size}>
          <PlayIcon />
          {action.label}
        </Button>
      )}

      {showView && (
        <Button to={action.to} size={size}>
          {action.label}
          <ArrowIcon />
        </Button>
      )}

      {action.kind === 'none' && <span className="actions__marker">{action.label}</span>}

      {showPending && (
        <span className="actions__marker actions__marker--soft">Not playable yet</span>
      )}

      {!onDetail && action.kind === 'play' && (
        <Button to={`/games/${game.slug}`} variant="secondary" size={size}>
          Game page
        </Button>
      )}

      {game.githubUrl && (
        <Button href={game.githubUrl} variant="secondary" size={size}>
          <GitHubIcon />
          Source
        </Button>
      )}
    </div>
  )
}

import type { Game } from '../types'
import { GameCard } from './GameCard'
import './GameGrid.css'

interface GameGridProps {
  games: Game[]
  /** Number of leading cards to load eagerly. */
  eagerCount?: number
  'aria-label'?: string
}

/** The library grid. Renders whatever it is given; empty states live outside. */
export function GameGrid({ games, eagerCount = 4, ...rest }: GameGridProps) {
  return (
    <ul className="grid" aria-label={rest['aria-label']}>
      {games.map((game, index) => (
        <li key={game.id}>
          <GameCard game={game} eager={index < eagerCount} />
        </li>
      ))}
    </ul>
  )
}

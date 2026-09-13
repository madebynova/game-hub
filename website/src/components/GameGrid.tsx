import type { Game } from '../types'
import { GameCard } from './GameCard'
import { NovaMark } from './icons'
import './GameGrid.css'

interface GameGridProps {
  games: Game[]
  /** Number of leading cards to load eagerly. */
  eagerCount?: number
  /**
   * End the grid with an open slot that says the library is still growing.
   * It names no game and implies no date — it is the shelf, not stock.
   */
  showOpenSlot?: boolean
  'aria-label'?: string
}

/** The library grid. Renders whatever it is given; empty states live outside. */
export function GameGrid({ games, eagerCount = 4, showOpenSlot = false, ...rest }: GameGridProps) {
  return (
    <ul className="grid" aria-label={rest['aria-label']}>
      {games.map((game, index) => (
        <li key={game.id}>
          <GameCard game={game} eager={index < eagerCount} index={index} />
        </li>
      ))}

      {showOpenSlot ? (
        <li className="grid__slot" style={{ ['--i' as string]: games.length }}>
          <NovaMark size={18} className="grid__slot-mark" />
          <p className="grid__slot-title">More games on the way</p>
          <p className="grid__slot-desc">New games join the library as they're built.</p>
        </li>
      ) : null}
    </ul>
  )
}

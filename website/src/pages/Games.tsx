import { libraryGames } from '../data/games'
import { GameGrid } from '../components/GameGrid'
import { EmptyPanel } from '../components/EmptyPanel'
import { isPlayable } from '../lib/gameAction'
import { countLabel } from '../lib/plural'
import { usePageTitle } from '../lib/usePageTitle'
import './Games.css'

export default function Games() {
  usePageTitle('Games', 'Every game on NOVA.')

  const count = libraryGames.length
  const playableCount = libraryGames.filter(isPlayable).length

  return (
    <div className="page">
      <header className="band">
        <div className="container library__head">
          <p className="eyebrow">Library</p>
          <h1 className="library__title">Games</h1>
          <p className="library__desc">
            Everything on NOVA, in one place. Play what's ready, and follow what's still being made.
          </p>

          {count > 0 ? (
            <ul className="library__stats">
              <li>{countLabel(count, 'game')}</li>
              {playableCount > 0 ? <li className="library__stat--live">{playableCount} playable now</li> : null}
            </ul>
          ) : null}
        </div>
      </header>

      <div className="container library__body">
        {count > 0 ? (
          <GameGrid games={libraryGames} aria-label="All games" showOpenSlot />
        ) : (
          <EmptyPanel
            motif="library"
            title="NOVA is getting started"
            description="Games are in development. Each one is listed here once it's real."
          />
        )}
      </div>
    </div>
  )
}

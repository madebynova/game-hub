import { libraryGames } from '../data/games'
import { GameGrid } from '../components/GameGrid'
import { EmptyPanel } from '../components/EmptyPanel'
import { SectionHeader } from '../components/SectionHeader'
import { Button } from '../components/Button'
import { countLabel } from '../lib/plural'
import { usePageTitle } from '../lib/usePageTitle'
import './Games.css'

export default function Games() {
  usePageTitle('Games', 'Every game on NOVA.')

  const count = libraryGames.length

  return (
    <div className="page container section">
      <SectionHeader
        level="page"
        eyebrow="Library"
        title="Games"
        description="Everything on NOVA, in one place."
        aside={countLabel(count, 'title')}
      />

      {count > 0 ? (
        <>
          <GameGrid games={libraryGames} aria-label="All games" />
          <p className="library__note">
            This is the whole library. New titles are listed here as they are built.
          </p>
        </>
      ) : (
        <EmptyPanel
          motif="library"
          title="NOVA is getting started"
          description="Games are in development. Each one is listed here once it's real."
          action={
            <Button to="/updates" variant="secondary">
              Follow the build
            </Button>
          }
        />
      )}
    </div>
  )
}

import { sortedUpdates } from '../data/updates'
import { UpdateCard } from '../components/UpdateCard'
import { EmptyPanel } from '../components/EmptyPanel'
import { SectionHeader } from '../components/SectionHeader'
import { Button } from '../components/Button'
import { countLabel } from '../lib/plural'
import { usePageTitle } from '../lib/usePageTitle'

export default function Updates() {
  usePageTitle('Updates', 'Release notes and news from NOVA.')

  const count = sortedUpdates.length

  return (
    <div className="page container section">
      <SectionHeader
        level="page"
        eyebrow="Changelog"
        title="Updates"
        description="Release notes and news, newest first."
        aside={countLabel(count, 'entry', 'entries')}
      />

      {count > 0 ? (
        <div className="update-list">
          {sortedUpdates.map((update) => (
            <UpdateCard key={update.id} update={update} />
          ))}
        </div>
      ) : (
        <EmptyPanel
          motif="log"
          title="Nothing posted yet"
          description="Notes land here as work ships. Nothing is written up before it is real."
          action={
            <Button to="/games" variant="secondary">
              Browse the library
            </Button>
          }
        />
      )}
    </div>
  )
}

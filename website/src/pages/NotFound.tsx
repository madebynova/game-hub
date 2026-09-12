import { EmptyPanel } from '../components/EmptyPanel'
import { Button } from '../components/Button'
import { usePageTitle } from '../lib/usePageTitle'

export default function NotFound() {
  usePageTitle('Not found')

  return (
    <div className="page container section">
      <EmptyPanel
        titleAs="h1"
        title="Page not found"
        description="That link doesn't point anywhere on NOVA. It may have moved, or never existed."
        action={
          <Button to="/" variant="secondary">
            Back to home
          </Button>
        }
      />
    </div>
  )
}

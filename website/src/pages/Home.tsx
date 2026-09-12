import { getFeaturedGame, libraryGames } from '../data/games'
import { sortedUpdates } from '../data/updates'
import { site } from '../data/site'
import { FeaturedGame } from '../components/FeaturedGame'
import { GameGrid } from '../components/GameGrid'
import { EmptyPanel } from '../components/EmptyPanel'
import { UpdateCard } from '../components/UpdateCard'
import { SectionHeader } from '../components/SectionHeader'
import { ArrowLink } from '../components/ArrowLink'
import { Button } from '../components/Button'
import { ArrowIcon, GitHubIcon, NovaMark } from '../components/icons'
import { countLabel } from '../lib/plural'
import { usePageTitle } from '../lib/usePageTitle'
import './Home.css'

export default function Home() {
  usePageTitle()

  const featured = getFeaturedGame()
  const rest = libraryGames.filter((game) => game.id !== featured?.id)
  const latestUpdates = sortedUpdates.slice(0, 2)
  const count = libraryGames.length

  return (
    <div className="page">
      {/* Identity first: what this is, in one screen, before anything else. */}
      <section className="hero">
        <div className="container hero__inner">
          <NovaMark size={34} className="hero__mark" />

          <h1 className="hero__title">{site.tagline}</h1>
          <p className="hero__lede">{site.description}</p>

          <div className="hero__actions">
            <Button to="/games" size="lg">
              Browse the library
              <ArrowIcon />
            </Button>
            {site.githubUrl ? (
              <Button href={site.githubUrl} variant="secondary" size="lg">
                <GitHubIcon />
                GitHub
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <div className="container">
        {featured ? (
          <section className="section home__featured">
            <FeaturedGame game={featured} />
          </section>
        ) : null}

        <section className="section" aria-labelledby="library-heading">
          <SectionHeader
            id="library-heading"
            title="Library"
            aside={
              <>
                <span>{countLabel(count, 'title')}</span>
                {count > 0 ? <ArrowLink to="/games">All games</ArrowLink> : null}
              </>
            }
          />

          {rest.length > 0 ? (
            <GameGrid games={rest} aria-label="Games" />
          ) : (
            <EmptyPanel
              motif="library"
              titleAs="h3"
              title={featured ? 'One title so far' : 'No games yet'}
              description={
                featured
                  ? 'This is the whole library right now. New titles appear the moment they exist.'
                  : "NOVA is up and running. Titles appear here as they're built."
              }
              action={
                featured ? null : (
                  <Button to="/updates" variant="secondary">
                    Follow the build
                  </Button>
                )
              }
            />
          )}
        </section>

        {latestUpdates.length > 0 ? (
          <section className="section" aria-labelledby="updates-heading">
            <SectionHeader
              id="updates-heading"
              title="Latest"
              aside={<ArrowLink to="/updates">All updates</ArrowLink>}
            />
            <div className="home__updates">
              {latestUpdates.map((update) => (
                <UpdateCard key={update.id} update={update} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}

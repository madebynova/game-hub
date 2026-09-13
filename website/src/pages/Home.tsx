import { getFeaturedGame, libraryGames } from '../data/games'
import { latestUpdatePerGame } from '../data/updates'
import { site } from '../data/site'
import { FeaturedGame } from '../components/FeaturedGame'
import { GameGrid } from '../components/GameGrid'
import { GameArt } from '../components/GameArt'
import { EmptyPanel } from '../components/EmptyPanel'
import { ActivityFeed } from '../components/ActivityFeed'
import { SectionHeader } from '../components/SectionHeader'
import { ArrowLink } from '../components/ArrowLink'
import { Button } from '../components/Button'
import { ArrowIcon, GitHubIcon, NovaMark, PlayIcon } from '../components/icons'
import { gameAction, isPlayable } from '../lib/gameAction'
import { countLabel } from '../lib/plural'
import { usePageTitle } from '../lib/usePageTitle'
import './Home.css'

/** Where each hero cover sits in the fan, by how many there are: [x %, tilt °]. */
const FAN: Record<number, [number, number][]> = {
  1: [[-50, -3]],
  2: [[-78, -7], [-24, 6]],
  3: [[-96, -10], [-50, 0], [-4, 10]],
}

export default function Home() {
  usePageTitle()

  const featured = getFeaturedGame()
  const count = libraryGames.length
  const playableCount = libraryGames.filter(isPlayable).length
  const firstPlayable = libraryGames.find(isPlayable)
  const heroPlay = firstPlayable ? gameAction(firstPlayable) : undefined
  const covers = libraryGames.slice(0, 3)
  const activity = latestUpdatePerGame().slice(0, 4)

  return (
    <div className="page">
      {/* Identity first: what this is, in one screen, before anything else. */}
      <section className="band hero" aria-labelledby="hero-title">
        {featured?.banner ? (
          <div
            className="hero__ambient"
            style={{ backgroundImage: `url("${featured.banner}")` }}
            aria-hidden="true"
          />
        ) : null}

        <div className="container hero__inner">
          <div className="hero__copy">
            <h1 id="hero-title" className="hero__heading">
              <span className="hero__brand">
                <NovaMark size={20} className="hero__mark" />
                {site.name}
              </span>
              <span className="hero__title">{site.tagline}</span>
            </h1>

            <p className="hero__lede">{site.description}</p>

            <div className="hero__actions">
              <Button to="/games" size="lg">
                Browse games
                <ArrowIcon className="btn__arrow" />
              </Button>
              {firstPlayable && heroPlay?.kind === 'play' ? (
                <Button href={heroPlay.href} variant="secondary" size="lg">
                  <PlayIcon />
                  Play {firstPlayable.title}
                  <span className="visually-hidden"> (opens in a new tab)</span>
                </Button>
              ) : null}
            </div>

            {count > 0 ? (
              <ul className="hero__stats">
                <li>{countLabel(count, 'game')} in the library</li>
                {playableCount > 0 ? (
                  <li className="hero__stat--live">{playableCount} playable now</li>
                ) : null}
              </ul>
            ) : null}
          </div>

          {covers.length > 0 ? (
            <div className="hero__covers" aria-hidden="true">
              {covers.map((game, index) => {
                const [x, tilt] = FAN[covers.length][index]
                return (
                  <div
                    key={game.id}
                    className="hero__cover"
                    style={{
                      translate: `${x}% -50%`,
                      rotate: `${tilt}deg`,
                      zIndex: index === 0 ? covers.length : index,
                      ['--i' as string]: index,
                    }}
                  >
                    <GameArt game={game} lazy={false} decorative />
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>
      </section>

      <div className="container home">
        {featured ? (
          <section aria-label="Featured game">
            <FeaturedGame game={featured} />
          </section>
        ) : null}

        <section aria-labelledby="browse-heading">
          <SectionHeader
            id="browse-heading"
            eyebrow="Library"
            title="Browse games"
            aside={count > 0 ? <ArrowLink to="/games">All games</ArrowLink> : null}
          />

          {count > 0 ? (
            <GameGrid games={libraryGames} aria-label="Games" showOpenSlot />
          ) : (
            <EmptyPanel
              motif="library"
              titleAs="h3"
              title="No games yet"
              description="NOVA is up and running. Games appear here as they're built."
            />
          )}
        </section>

        <div className={`home__split${activity.length > 0 ? '' : ' home__split--solo'}`}>
          {activity.length > 0 ? (
            <section aria-labelledby="activity-heading">
              <SectionHeader id="activity-heading" eyebrow="Latest activity" title="Recently updated" />
              <ActivityFeed updates={activity} />
            </section>
          ) : null}

          <section className="about" aria-labelledby="about-heading">
            <NovaMark size={22} className="about__mark" />
            <h2 id="about-heading" className="about__title">
              About {site.name}
            </h2>
            <p>
              {site.name} is a small, independent game hub. Each game is built as its own project
              and gets a page here once it's real — what it is, how it plays, and what changed in
              its latest updates.
            </p>
            <p>
              Playable games open straight in your browser. Games still being made are listed too,
              so you can follow them from the start.
            </p>
            <div className="about__links">
              <Button to="/games" variant="secondary">
                Explore the library
              </Button>
              {site.githubUrl ? (
                <Button href={site.githubUrl} variant="ghost">
                  <GitHubIcon />
                  GitHub
                  <span className="visually-hidden"> (opens in a new tab)</span>
                </Button>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

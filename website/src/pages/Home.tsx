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
  2: [[-80, -7], [-22, 6]],
  3: [[-98, -10], [-50, 0], [-2, 10]],
}

/** The NOVA mark's outline, reused as the hero's backdrop burst. */
const MARK_PATH =
  'M12 0c.5 6.2 1.9 8.9 5.3 10.3L24 12l-6.7 1.7C13.9 15.1 12.5 17.8 12 24c-.5-6.2-1.9-8.9-5.3-10.3L0 12l6.7-1.7C10.1 8.9 11.5 6.2 12 0Z'

export default function Home() {
  usePageTitle()

  const featured = getFeaturedGame()
  const count = libraryGames.length
  const playable = libraryGames.filter(isPlayable)
  const heroPlay = playable[0] ? gameAction(playable[0]) : undefined
  const covers = libraryGames.slice(0, 3)
  const activity = latestUpdatePerGame().slice(0, 3)

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
              {playable[0] && heroPlay?.kind === 'play' ? (
                <Button href={heroPlay.href} variant="secondary" size="lg">
                  <PlayIcon />
                  Play {playable[0].title}
                  <span className="visually-hidden"> (opens in a new tab)</span>
                </Button>
              ) : null}
            </div>

            {count > 0 ? (
              <ul className="hero__stats">
                <li>{countLabel(count, 'game')} in the library</li>
                {playable.length > 0 ? (
                  <li className="hero__stat--live">{playable.length} playable now</li>
                ) : null}
              </ul>
            ) : null}
          </div>

          {covers.length > 0 ? (
            <div className="hero__stage" aria-hidden="true">
              <svg className="hero__burst" viewBox="0 0 400 400">
                <circle className="hero__ring hero__ring--dashed" cx="200" cy="200" r="188" />
                <circle className="hero__ring" cx="200" cy="200" r="138" />
                <g transform="translate(116 116) scale(7)">
                  <path d={MARK_PATH} />
                </g>
              </svg>

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

        <section aria-labelledby="library-heading">
          <SectionHeader
            id="library-heading"
            eyebrow="Library"
            title="The games"
            description="Everything I'm making, playable or not."
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
          <section className="about" aria-labelledby="about-heading">
            <p className="eyebrow about__eyebrow">
              <NovaMark size={11} className="about__mark" />
              About {site.name}
            </p>
            <h2 id="about-heading" className="about__title">
              Where I build, test and share my games
            </h2>
            <div className="about__text">
              <p>
                {site.name} is my corner of the internet for the games I'm making. Some of them are
                ready to play, some are still rough, and all of them are still changing.
              </p>
              <p>
                Playable games open right in your browser — nothing to install. Games still in
                development get a page too, with their real update history, so you can follow along
                from the start.
              </p>
              {site.githubUrl ? (
                <p>The code for all of it is on GitHub, if you want to see how it's made.</p>
              ) : null}
            </div>
            <div className="about__links">
              <Button to="/games" variant="secondary">
                Browse the games
              </Button>
              {site.githubUrl ? (
                <Button href={site.githubUrl} variant="ghost">
                  <GitHubIcon />
                  View on GitHub
                  <span className="visually-hidden"> (opens in a new tab)</span>
                </Button>
              ) : null}
            </div>
          </section>

          {activity.length > 0 ? (
            <section className="home__activity" aria-labelledby="activity-heading">
              <SectionHeader id="activity-heading" eyebrow="Latest activity" title="Recently updated" />
              <ActivityFeed updates={activity} />
            </section>
          ) : null}
        </div>
      </div>
    </div>
  )
}

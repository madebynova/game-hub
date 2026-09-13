import { useEffect } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { getGame } from '../data/games'
import { updatesForGame } from '../data/updates'
import { GameArt } from '../components/GameArt'
import { StatusBadge } from '../components/StatusBadge'
import { GameActions } from '../components/GameActions'
import { Gallery } from '../components/Gallery'
import { UpdateLog } from '../components/UpdateLog'
import { EmptyPanel } from '../components/EmptyPanel'
import { ArrowIcon } from '../components/icons'
import { countLabel } from '../lib/plural'
import { formatDate } from '../lib/formatDate'
import { usePageTitle } from '../lib/usePageTitle'
import NotFound from './NotFound'
import './GameDetails.css'

export default function GameDetails() {
  const { slug } = useParams<{ slug: string }>()
  const { hash } = useLocation()
  const game = slug ? getGame(slug) : undefined

  usePageTitle(game ? game.title : 'Not found', game?.description)

  // Links like /games/runout#updates arrive before this lazily loaded page has
  // rendered, so the router's own scroll-to-hash finds nothing. Do it here.
  useEffect(() => {
    if (!hash) return
    document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView()
  }, [hash, slug])

  if (!game) return <NotFound />

  const body = game.body ?? []
  const features = game.features ?? []
  const controls = game.controls ?? []
  const screenshots = game.screenshots ?? []
  const tech = game.tech ?? []
  const updates = updatesForGame(game.slug)
  const latest = updates[0]

  // The in-page index lists only sections this game actually has.
  const contents = [
    { id: 'about', label: 'About', show: body.length > 0 },
    { id: 'features', label: 'Features', show: features.length > 0 },
    { id: 'controls', label: 'Controls', show: controls.length > 0 },
    { id: 'screenshots', label: 'Screenshots', show: screenshots.length > 0 },
    { id: 'updates', label: 'Updates', show: true },
  ].filter((item) => item.show)

  return (
    <div className="page game">
      <header className="game__hero">
        <div className="game__ambient" aria-hidden="true">
          <GameArt game={game} variant="banner" lazy={false} decorative />
        </div>

        <div className="container">
          <Link to="/games" className="game__back">
            <ArrowIcon size={13} className="game__back-icon" />
            All games
          </Link>

          <div className="game__banner">
            <div className="game__art">
              <GameArt game={game} variant="banner" lazy={false} />
            </div>

            <div className="game__intro">
              {game.subtitle ? <p className="game__subtitle">{game.subtitle}</p> : null}
              <h1 className="game__title">{game.title}</h1>

              <div className="game__badges">
                <StatusBadge status={game.status} size="md" />
                {game.platform ? <span className="game__chip">{game.platform}</span> : null}
              </div>

              {game.description ? <p className="game__desc">{game.description}</p> : null}

              <GameActions game={game} context="detail" />
            </div>
          </div>

          <nav className="game__contents" aria-label="On this page">
            {contents.map((item) => (
              <a key={item.id} href={`#${item.id}`} className="game__contents-link">
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <div className="container game__layout">
        <div className="game__main">
          {body.length > 0 ? (
            <section id="about" className="game__section" aria-labelledby="about-heading">
              <h2 id="about-heading" className="game__section-title">
                About
              </h2>
              <div className="game__prose">
                {body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ) : null}

          {features.length > 0 ? (
            <section id="features" className="game__section" aria-labelledby="features-heading">
              <h2 id="features-heading" className="game__section-title">
                Features
              </h2>
              <ul className="game__features">
                {features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {controls.length > 0 ? (
            <section id="controls" className="game__section" aria-labelledby="controls-heading">
              <h2 id="controls-heading" className="game__section-title">
                Controls
              </h2>
              <dl className="game__controls">
                {controls.map((control) => (
                  <div className="game__control" key={control.keys}>
                    <dt>
                      <kbd>{control.keys}</kbd>
                    </dt>
                    <dd>{control.action}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {screenshots.length > 0 ? (
            <section id="screenshots" className="game__section" aria-labelledby="shots-heading">
              <h2 id="shots-heading" className="game__section-title">
                Screenshots
              </h2>
              <Gallery shots={screenshots} />
            </section>
          ) : null}

          <section id="updates" className="game__section" aria-labelledby="updates-heading">
            <div className="game__section-head">
              <h2 id="updates-heading" className="game__section-title">
                Latest updates
              </h2>
              {updates.length > 0 ? (
                <span className="game__section-meta">{countLabel(updates.length, 'update')}</span>
              ) : null}
            </div>

            {updates.length > 0 ? (
              <UpdateLog updates={updates} />
            ) : (
              <EmptyPanel
                size="section"
                motif="log"
                titleAs="h3"
                title="No updates posted yet"
                description={`Release notes for ${game.title} will be listed here as updates ship.`}
              />
            )}
          </section>
        </div>

        <aside className="game__aside" aria-labelledby="info-heading">
          <div className="info">
            <h2 id="info-heading" className="info__title">
              Project information
            </h2>

            <dl className="info__list">
              <div className="info__row">
                <dt>Status</dt>
                <dd>
                  <StatusBadge status={game.status} />
                </dd>
              </div>
              {game.platform ? (
                <div className="info__row">
                  <dt>Platform</dt>
                  <dd>{game.platform}</dd>
                </div>
              ) : null}
              {tech.length > 0 ? (
                <div className="info__row">
                  <dt>Built with</dt>
                  <dd>
                    <ul className="info__tags">
                      {tech.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
              ) : null}
              {latest ? (
                <div className="info__row">
                  <dt>Last updated</dt>
                  <dd>
                    <time dateTime={latest.date}>{formatDate(latest.date)}</time>
                  </dd>
                </div>
              ) : null}
            </dl>

            <div className="info__actions">
              <GameActions game={game} context="detail" size="md" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

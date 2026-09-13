import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { getGame } from '../data/games'
import { updatesForGame } from '../data/updates'
import { GameArt } from '../components/GameArt'
import { StatusBadge } from '../components/StatusBadge'
import { GameActions } from '../components/GameActions'
import { Gallery } from '../components/Gallery'
import { UpdateLog } from '../components/UpdateLog'
import { EmptyPanel } from '../components/EmptyPanel'
import { Button } from '../components/Button'
import { ArrowIcon } from '../components/icons'
import { gameAction } from '../lib/gameAction'
import { countLabel } from '../lib/plural'
import { formatDate } from '../lib/formatDate'
import { usePageTitle } from '../lib/usePageTitle'
import NotFound from './NotFound'
import './GameDetails.css'

interface SectionProps {
  id: string
  title: string
  meta?: ReactNode
  children: ReactNode
}

/** One titled section of a game page. */
function Section({ id, title, meta, children }: SectionProps) {
  return (
    <section id={id} className="game__section" aria-labelledby={`${id}-heading`}>
      <div className="game__section-head">
        <h2 id={`${id}-heading`} className="game__section-title">
          {title}
        </h2>
        {meta ? <span className="game__section-meta">{meta}</span> : null}
      </div>
      {children}
    </section>
  )
}

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

  const action = gameAction(game)
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
    { id: 'info', label: 'Project info', show: true },
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
              <div className="game__heading">
                <h1 className="game__title">{game.title}</h1>
                {game.subtitle ? <p className="game__subtitle">{game.subtitle}</p> : null}
              </div>

              <div className="game__badges">
                <StatusBadge status={game.status} size="md" />
                {game.platform ? <span className="game__chip">{game.platform}</span> : null}
                {latest ? (
                  <span className="game__chip">
                    Updated <time dateTime={latest.date}>{formatDate(latest.date, 'short')}</time>
                  </span>
                ) : null}
              </div>

              {game.description ? <p className="game__desc">{game.description}</p> : null}

              <GameActions game={game} context="detail" />

              {action.kind === 'view' ? (
                <p className="game__note">
                  Still in development.{' '}
                  <a href="#updates" className="game__note-link">
                    Follow along in the latest updates
                  </a>
                </p>
              ) : null}
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
            <Section id="about" title="About">
              <div className="game__prose">
                {body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </Section>
          ) : null}

          {features.length > 0 ? (
            <Section id="features" title="Features">
              <ul className="game__features">
                {features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </Section>
          ) : null}

          {controls.length > 0 ? (
            <Section id="controls" title="Controls">
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
            </Section>
          ) : null}

          {screenshots.length > 0 ? (
            <Section id="screenshots" title="Screenshots">
              <Gallery shots={screenshots} />
            </Section>
          ) : null}

          <Section
            id="updates"
            title="Latest updates"
            meta={updates.length > 0 ? countLabel(updates.length, 'update') : undefined}
          >
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
          </Section>
        </div>

        <aside id="info" className="game__aside" aria-labelledby="info-heading">
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
              {updates.length > 0 ? (
                <div className="info__row">
                  <dt>Updates</dt>
                  <dd>{countLabel(updates.length, 'update')} posted</dd>
                </div>
              ) : null}
            </dl>

            <div className="info__actions">
              <GameActions game={game} context="detail" size="md" />
            </div>
          </div>
        </aside>
      </div>

      <div className="container game__end">
        <Button to="/games" variant="secondary">
          <ArrowIcon className="game__end-icon" />
          Back to all games
        </Button>
      </div>
    </div>
  )
}

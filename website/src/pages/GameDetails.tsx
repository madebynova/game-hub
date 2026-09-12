import { Link, useParams } from 'react-router-dom'
import { getGame } from '../data/games'
import { updatesForGame } from '../data/updates'
import { GameArt } from '../components/GameArt'
import { StatusBadge } from '../components/StatusBadge'
import { GameActions } from '../components/GameActions'
import { Gallery } from '../components/Gallery'
import { UpdateCard } from '../components/UpdateCard'
import { ArrowIcon } from '../components/icons'
import { usePageTitle } from '../lib/usePageTitle'
import NotFound from './NotFound'
import './GameDetails.css'

export default function GameDetails() {
  const { slug } = useParams<{ slug: string }>()
  const game = slug ? getGame(slug) : undefined

  usePageTitle(game ? game.title : 'Not found', game?.description)

  if (!game) return <NotFound />

  const screenshots = game.screenshots ?? []
  const features = game.features ?? []
  const controls = game.controls ?? []
  const body = game.body ?? []
  const updates = updatesForGame(game.slug)

  return (
    <div className="page game">
      <div className="container">
        <Link to="/games" className="game__back">
          <ArrowIcon size={13} className="game__back-icon" />
          All games
        </Link>
      </div>

      {/* Masthead: artwork plus the facts that always exist. */}
      <header className="container game__head">
        <div className="game__art">
          <GameArt game={game} variant="banner" lazy={false} />
        </div>

        <div className="game__intro">
          <h1 className="game__title">{game.title}</h1>
          {game.subtitle ? <p className="game__subtitle">{game.subtitle}</p> : null}

          <StatusBadge status={game.status} size="md" />

          {game.description ? <p className="game__desc">{game.description}</p> : null}

          <GameActions game={game} context="detail" />
        </div>
      </header>

      <div className="container game__sections">
        {body.length > 0 ? (
          <section className="game__section" aria-labelledby="about-heading">
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
          <section className="game__section" aria-labelledby="features-heading">
            <h2 id="features-heading" className="game__section-title">
              What's in it
            </h2>
            <ul className="game__features">
              {features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {controls.length > 0 ? (
          <section className="game__section" aria-labelledby="controls-heading">
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
          <section className="game__section" aria-labelledby="shots-heading">
            <h2 id="shots-heading" className="game__section-title">
              Screenshots
            </h2>
            <Gallery shots={screenshots} />
          </section>
        ) : null}

        {updates.length > 0 ? (
          <section className="game__section" aria-labelledby="game-updates-heading">
            <h2 id="game-updates-heading" className="game__section-title">
              What's new
            </h2>
            <div className="update-list">
              {updates.map((update) => (
                <UpdateCard key={update.id} update={update} showGame={false} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}

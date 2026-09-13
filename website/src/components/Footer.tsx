import { Link } from 'react-router-dom'
import { site } from '../data/site'
import { libraryGames } from '../data/games'
import { ArrowIcon, GitHubIcon, NovaMark } from './icons'
import './Footer.css'

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__top">
          <div className="footer__brand">
            <Link to="/" className="footer__logo" aria-label={`${site.name} home`}>
              <NovaMark size={18} className="footer__mark" />
              <span className="footer__wordmark">{site.name}</span>
            </Link>
            <p className="footer__tagline">{site.tagline}</p>
          </div>

          <nav className="footer__nav" aria-label="Footer">
            <div className="footer__col">
              <p className="footer__heading">Explore</p>
              <ul>
                <li>
                  <Link to="/">Home</Link>
                </li>
                <li>
                  <Link to="/games">All games</Link>
                </li>
              </ul>
            </div>

            {libraryGames.length > 0 ? (
              <div className="footer__col">
                <p className="footer__heading">Games</p>
                <ul>
                  {libraryGames.map((game) => (
                    <li key={game.id}>
                      <Link to={`/games/${game.slug}`}>{game.title}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {site.githubUrl || site.contactEmail ? (
              <div className="footer__col">
                <p className="footer__heading">Project</p>
                <ul>
                  {site.githubUrl ? (
                    <li>
                      <a href={site.githubUrl} target="_blank" rel="noreferrer noopener">
                        <GitHubIcon size={13} />
                        GitHub
                        <span className="visually-hidden"> (opens in a new tab)</span>
                      </a>
                    </li>
                  ) : null}
                  {site.contactEmail ? (
                    <li>
                      <a href={`mailto:${site.contactEmail}`}>Contact</a>
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}
          </nav>
        </div>

        <div className="footer__bottom">
          <p>
            © {year} {site.name}. Independent games, made one at a time.
          </p>
          <a href="#main" className="footer__top-link">
            Back to top
            <ArrowIcon size={12} className="footer__top-icon" />
          </a>
        </div>
      </div>
    </footer>
  )
}

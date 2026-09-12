import { Link } from 'react-router-dom'
import { site } from '../data/site'
import { GitHubIcon, NovaMark } from './icons'
import './Footer.css'

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__brand">
          <NovaMark size={16} className="footer__mark" />
          <span className="footer__wordmark">{site.name}</span>
          <span className="footer__tagline">{site.tagline}</span>
        </div>

        <nav className="footer__links" aria-label="Footer">
          <Link to="/games">Games</Link>
          <Link to="/updates">Updates</Link>
          {site.githubUrl ? (
            <a href={site.githubUrl} target="_blank" rel="noreferrer noopener">
              <GitHubIcon size={14} />
              GitHub
            </a>
          ) : null}
          {site.contactEmail ? <a href={`mailto:${site.contactEmail}`}>Contact</a> : null}
        </nav>

        <p className="footer__legal">© {year} {site.name}</p>
      </div>
    </footer>
  )
}

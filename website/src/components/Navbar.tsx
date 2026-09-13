import { Link, NavLink } from 'react-router-dom'
import { site } from '../data/site'
import { GitHubIcon, NovaMark } from './icons'
import './Navbar.css'

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/games', label: 'Games', end: false },
]

/**
 * The top bar. Two destinations fit on the smallest phone, so there is no
 * menu to open — the links are always right there.
 */
export function Navbar() {
  return (
    <header className="nav">
      <div className="nav__inner container">
        <Link to="/" className="nav__brand" aria-label={`${site.name} home`}>
          <NovaMark size={18} className="nav__mark" />
          <span className="nav__wordmark">{site.name}</span>
        </Link>

        <nav className="nav__links" aria-label="Primary">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => `nav__link${isActive ? ' is-active' : ''}`}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        {site.githubUrl ? (
          <a className="nav__github" href={site.githubUrl} target="_blank" rel="noreferrer noopener">
            <GitHubIcon size={15} />
            <span className="nav__github-text">GitHub</span>
            <span className="visually-hidden"> (opens in a new tab)</span>
          </a>
        ) : null}
      </div>
    </header>
  )
}

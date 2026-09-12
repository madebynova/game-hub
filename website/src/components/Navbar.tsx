import { useEffect, useId, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { site } from '../data/site'
import { CloseIcon, GitHubIcon, MenuIcon, NovaMark } from './icons'
import './Navbar.css'

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/games', label: 'Games', end: false },
  { to: '/updates', label: 'Updates', end: false },
]

export function Navbar() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const toggleRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  // Route change closes the menu.
  useEffect(() => setOpen(false), [location.pathname])

  // Escape closes it and returns focus to the button that opened it.
  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        toggleRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

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

        <div className="nav__actions">
          {site.githubUrl ? (
            <a
              className="nav__github"
              href={site.githubUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              <GitHubIcon size={15} />
              <span className="nav__github-text">GitHub</span>
            </a>
          ) : null}

          <button
            ref={toggleRef}
            className="nav__toggle"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      <div className="nav__drawer" id={menuId} hidden={!open}>
        <nav className="container nav__drawer-links" aria-label="Primary, mobile">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => `nav__drawer-link${isActive ? ' is-active' : ''}`}
            >
              {link.label}
            </NavLink>
          ))}
          {site.githubUrl ? (
            <a
              className="nav__drawer-link"
              href={site.githubUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              GitHub
            </a>
          ) : null}
        </nav>
      </div>
    </header>
  )
}

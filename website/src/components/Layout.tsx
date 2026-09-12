import { Outlet, ScrollRestoration } from 'react-router-dom'
import { Navbar } from './Navbar'
import { Footer } from './Footer'
import './Layout.css'

export function Layout() {
  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Navbar />
      <main id="main" className="shell__main" tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
      <ScrollRestoration />
    </div>
  )
}

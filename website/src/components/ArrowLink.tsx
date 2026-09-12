import { Link } from 'react-router-dom'
import { ArrowIcon } from './icons'
import './ArrowLink.css'

interface ArrowLinkProps {
  to: string
  children: string
}

/** The small "go to the full thing" link used in section header asides. */
export function ArrowLink({ to, children }: ArrowLinkProps) {
  return (
    <Link to={to} className="arrow-link">
      {children}
      <ArrowIcon size={13} />
    </Link>
  )
}

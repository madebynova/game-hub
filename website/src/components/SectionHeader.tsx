import type { ReactNode } from 'react'
import './SectionHeader.css'

interface SectionHeaderProps {
  title: string
  id?: string
  /** Small label above the title. */
  eyebrow?: string
  /** One line under the title. Keep it short. */
  description?: string
  /** Right-hand slot: a count, a link, an action. Aligns with the title. */
  aside?: ReactNode
}

/**
 * Every in-page section title: same eyebrow, same baseline, same right-hand
 * slot.
 *
 * The aside shares a row with the title rather than the whole block, so a
 * description underneath cannot drag it out of alignment.
 */
export function SectionHeader({ title, id, eyebrow, description, aside }: SectionHeaderProps) {
  return (
    <header className="sh">
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}

      <div className="sh__row">
        <h2 id={id} className="sh__title">
          {title}
        </h2>
        {aside ? <div className="sh__aside">{aside}</div> : null}
      </div>

      {description ? <p className="sh__desc">{description}</p> : null}
    </header>
  )
}

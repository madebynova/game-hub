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
  /** 'page' is the h1 block at the top of a route; 'section' is an h2 inside one. */
  level?: 'page' | 'section'
}

/**
 * Every heading rule on the site: same baseline, same divider, same right-hand
 * slot. Page titles and in-page section titles differ only in scale and tag.
 *
 * The aside shares a row with the title rather than the whole block, so a
 * description underneath cannot drag it out of alignment.
 */
export function SectionHeader({
  title,
  id,
  eyebrow,
  description,
  aside,
  level = 'section',
}: SectionHeaderProps) {
  const Heading = level === 'page' ? 'h1' : 'h2'

  return (
    <header className={`sh sh--${level}`}>
      {eyebrow ? <p className="eyebrow sh__eyebrow">{eyebrow}</p> : null}

      <div className="sh__row">
        <Heading id={id} className="sh__title">
          {title}
        </Heading>
        {aside ? <div className="sh__aside">{aside}</div> : null}
      </div>

      {description ? <p className="sh__desc">{description}</p> : null}
    </header>
  )
}

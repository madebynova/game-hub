import type { ReactNode } from 'react'
import './EmptyPanel.css'

/**
 * Which shape to preview behind the message.
 *
 * 'library' draws cover frames, 'log' draws changelog rows — each the outline
 * of the content that will fill that section. 'none' is for pages with no
 * content shape to promise, like a 404.
 */
export type EmptyMotif = 'library' | 'log' | 'none'

interface EmptyPanelProps {
  title: string
  description: string
  action?: ReactNode
  motif?: EmptyMotif
  /** Use 'h2' when this sits directly under the page's h1, to keep levels in order. */
  titleAs?: 'h1' | 'h2' | 'h3'
}

const MOTIF_COUNT: Record<Exclude<EmptyMotif, 'none'>, number> = {
  library: 6,
  log: 3,
}

/**
 * The panel a section shows when it has nothing in it — and the site's one
 * recurring visual idea.
 *
 * Instead of an apology or a spinner, it draws the outline of the content that
 * belongs here: cover frames in the library, changelog rows on updates. That
 * makes "nothing yet" read as a shelf awaiting stock rather than a failed
 * load, and it is honest — the frames carry no titles, art, dates or counts,
 * so nothing on the page implies content that does not exist.
 */
export function EmptyPanel({
  title,
  description,
  action,
  motif = 'none',
  titleAs: Title = 'h2',
}: EmptyPanelProps) {
  return (
    <div className="empty">
      {motif !== 'none' ? (
        <div className={`empty__motif empty__motif--${motif}`} aria-hidden="true">
          {Array.from({ length: MOTIF_COUNT[motif] }, (_, index) => (
            <div className="empty__slot" key={index} />
          ))}
        </div>
      ) : null}

      <div className="empty__body">
        <Title className="empty__title">{title}</Title>
        <p className="empty__desc">{description}</p>
        {action ? <div className="empty__action">{action}</div> : null}
      </div>
    </div>
  )
}

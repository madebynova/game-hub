import { useEffect, useState } from 'react'
import { CloseIcon } from './icons'
import './Gallery.css'

interface Shot {
  src: string
  alt: string
}

interface GalleryProps {
  shots: Shot[]
}

/**
 * Screenshot gallery with a lightbox. Renders nothing at all when there are no
 * screenshots, so a game page never shows an empty "Screenshots" heading.
 */
export function Gallery({ shots }: GalleryProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  useEffect(() => {
    if (openIndex === null) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenIndex(null)
      if (event.key === 'ArrowRight') {
        setOpenIndex((index) => (index === null ? null : (index + 1) % shots.length))
      }
      if (event.key === 'ArrowLeft') {
        setOpenIndex((index) =>
          index === null ? null : (index - 1 + shots.length) % shots.length,
        )
      }
    }

    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [openIndex, shots.length])

  if (shots.length === 0) return null

  const active = openIndex === null ? null : shots[openIndex]

  return (
    <>
      <ul className="gallery">
        {shots.map((shot, index) => (
          <li key={shot.src}>
            <button
              className="gallery__item"
              onClick={() => setOpenIndex(index)}
              aria-label={`View screenshot: ${shot.alt}`}
            >
              <img src={shot.src} alt={shot.alt} loading="lazy" decoding="async" />
            </button>
          </li>
        ))}
      </ul>

      {active ? (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Screenshot viewer"
          onClick={() => setOpenIndex(null)}
        >
          <button className="lightbox__close" onClick={() => setOpenIndex(null)} autoFocus>
            <CloseIcon size={20} />
            <span className="visually-hidden">Close</span>
          </button>
          <img
            className="lightbox__img"
            src={active.src}
            alt={active.alt}
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  )
}

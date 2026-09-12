import { useEffect } from 'react'
import { site } from '../data/site'

/**
 * Sets document.title for a route. Called with no argument it restores the
 * site default, so every page can use the same hook.
 */
export function usePageTitle(title?: string, description?: string) {
  useEffect(() => {
    document.title = title ? `${title} — ${site.name}` : `${site.name} — ${site.tagline}`
  }, [title])

  useEffect(() => {
    if (!description) return
    const meta = document.querySelector('meta[name="description"]')
    if (!meta) return
    const previous = meta.getAttribute('content')
    meta.setAttribute('content', description)
    return () => {
      if (previous !== null) meta.setAttribute('content', previous)
    }
  }, [description])
}

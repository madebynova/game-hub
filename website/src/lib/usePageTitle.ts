import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { site } from '../data/site'

function setMeta(attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.append(element)
  }
  element.setAttribute('content', content)
}

function setCanonical(href: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!element) {
    element = document.createElement('link')
    element.rel = 'canonical'
    document.head.append(element)
  }
  element.href = href
}

/**
 * Per-route <title>, description and share tags.
 *
 * Called with no arguments it uses the site defaults, so every page can use the
 * same hook: "RUNOUT — NOVA" on a game page, "NOVA — A home for my games." at
 * home. The canonical URL is only written once the site has a real address.
 */
export function usePageTitle(title?: string, description?: string) {
  const { pathname } = useLocation()

  useEffect(() => {
    const fullTitle = title ? `${title} — ${site.name}` : `${site.name} — ${site.tagline}`
    const summary = description ?? site.description

    document.title = fullTitle
    setMeta('name', 'description', summary)
    setMeta('property', 'og:title', fullTitle)
    setMeta('property', 'og:description', summary)
    setMeta('name', 'twitter:title', fullTitle)
    setMeta('name', 'twitter:description', summary)

    if (site.url) {
      const href = `${site.url}${pathname === '/' ? '/' : pathname}`
      setCanonical(href)
      setMeta('property', 'og:url', href)
    }
  }, [title, description, pathname])
}

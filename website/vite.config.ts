import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// The one piece of Node this config reads; declared here rather than pulling
// in @types/node for it.
declare const process: { env: Record<string, string | undefined> }

/**
 * The deployed address. Netlify sets `URL` during every build; `VITE_SITE_URL`
 * overrides it. Local builds have neither, and then no URL-based tags are
 * written — nothing is ever guessed.
 */
const siteUrl = (process.env.VITE_SITE_URL || process.env.URL || '').replace(/\/+$/, '')

/** Adds canonical, og:url and share-image tags to index.html when the URL is known. */
function siteUrlTags(): Plugin {
  return {
    name: 'nova-site-url-tags',
    transformIndexHtml(html) {
      const tags = siteUrl
        ? [
            `<link rel="canonical" href="${siteUrl}/" />`,
            `<meta property="og:url" content="${siteUrl}/" />`,
            `<meta property="og:image" content="${siteUrl}/og-image.png" />`,
            `<meta property="og:image:width" content="1200" />`,
            `<meta property="og:image:height" content="630" />`,
            `<meta property="og:image:alt" content="NOVA — A home for my games. Cover art for RUNOUT and Tides of Fortune." />`,
            `<meta name="twitter:image" content="${siteUrl}/og-image.png" />`,
          ].join('\n    ')
        : ''
      return html.replace(/<!-- site-url-tags:[^>]*-->/, tags)
    },
  }
}

export default defineConfig({
  plugins: [react(), siteUrlTags()],
  define: {
    __SITE_URL__: JSON.stringify(siteUrl),
  },
  build: {
    target: 'es2022',
    // Small site: one vendor chunk keeps the app chunk cacheable across deploys.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) return 'vendor'
        },
      },
    },
  },
})

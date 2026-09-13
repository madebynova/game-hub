/**
 * Site-wide configuration.
 *
 * Public values only — never put keys, tokens or anything secret in here. This
 * file is bundled into the client and shipped to every visitor.
 */
export const site = {
  name: 'NOVA',
  tagline: 'A home for my games.',
  description:
    'NOVA is where I build, test and share my games. Play the ones that are ready, and follow the ones still being made.',

  /**
   * The deployed address, without a trailing slash — used for canonical URLs
   * and share tags. It is filled in at build time from Netlify's `URL`
   * environment variable (see vite.config.ts), so it is empty in local dev and
   * never has to be typed by hand.
   */
  url: __SITE_URL__,

  /** The public game-hub repository. Leave empty to hide the GitHub links. */
  githubUrl: 'https://github.com/madebynova/game-hub',

  /** Contact address, or empty to hide the footer contact link. */
  contactEmail: '',
} as const

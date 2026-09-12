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
    'NOVA is a small independent game platform. Games are added here as they are built.',

  /**
   * Where the GitHub button in the nav and the footer link point. Leave it
   * empty to hide both.
   *
   * Note this repo is currently private, so the link 404s for anyone who is
   * not signed in with access. Make it public, or point this at
   * https://github.com/madebynova instead, before sharing the site.
   */
  githubUrl: 'https://github.com/madebynova/game-hub',

  /** Contact address, or empty to hide the footer contact link. */
  contactEmail: '',
} as const


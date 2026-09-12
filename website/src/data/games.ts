import type { Game } from '../types'

/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ RUNOUT'S LIVE URL GOES HERE.                                             │
 * │                                                                          │
 * │ RUNOUT is deployed as its own separate Netlify site, from its own repo.  │
 * │ NOVA only links to it. Once that site is live, paste its URL below and   │
 * │ nothing else needs changing:                                             │
 * │                                                                          │
 * │   RUNOUT_PLAY_URL = 'https://your-runout-site.netlify.app'               │
 * │                                                                          │
 * │ That one edit flips the card from "In development" to "Playable" and     │
 * │ turns every VIEW PROJECT button into PLAY NOW — on the library card, the │
 * │ homepage spotlight and the game page at once.                            │
 * │                                                                          │
 * │ Leave it empty until the site actually exists. An empty string means     │
 * │ NOVA advertises no play link at all, which is the honest state.          │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
const RUNOUT_PLAY_URL = ''

/**
 * RUNOUT's source. It lives in the same monorepo as this website:
 *
 *   madebynova/game-hub
 *     games/runout/   the game  — its own Vite project, its own Netlify site
 *     website/        this site — its own Vite project, its own Netlify site
 *
 * Note the repo is currently private, so this link 404s for anyone without
 * access. Set it to '' to hide the Source buttons until the repo is public.
 */
const RUNOUT_SOURCE_URL = 'https://github.com/madebynova/game-hub/tree/main/games/runout'

/**
 * The NOVA library.
 *
 * Adding a game means adding an object to this array — no component needs
 * touching. It then appears in the library grid and gets its own page at
 * `/games/<slug>`.
 *
 * Only `id`, `title`, `slug` and `status` are required. Every other field is
 * optional and the UI renders only what exists, so a game can be listed the
 * moment it has a name and grow from there. Never fill a field to make the
 * page look fuller — an absent section is the designed state.
 *
 * A fully populated entry looks like this:
 *
 *   {
 *     id: 'my-game',
 *     title: 'My Game',
 *     subtitle: 'Subtitle',            // optional second line
 *     slug: 'my-game',
 *     status: 'playable',              // 'playable' | 'in-development' | 'coming-soon'
 *     playable: true,                  // with playUrl, turns on PLAY NOW
 *     playUrl: 'https://…',            // the game's own site — opens in a new tab
 *     githubUrl: 'https://github.com/…',
 *     artwork: '/games/my-game/cover.png',     // 3:4, in public/
 *     banner: '/games/my-game/banner.png',     // 16:9, in public/
 *     artworkAlt: 'What the art shows',
 *     description: 'One or two sentences.',
 *     body: ['A paragraph.', 'Another.'],
 *     features: ['Something the game actually does'],
 *     controls: [{ keys: 'WASD', action: 'Move' }],
 *     screenshots: [{ src: '/games/my-game/1.png', alt: '…' }],
 *     featured: true,                  // homepage spotlight; at most one
 *     order: 100,                      // library sort, higher first
 *   }
 *
 * See `src/types.ts` for the authoritative shape.
 */
export const games: Game[] = [
  {
    id: 'runout',
    title: 'RUNOUT',
    subtitle: 'Ding Dong',
    slug: 'runout',
    featured: true,
    order: 100,

    // Derived from the URL above so the two can never disagree: NOVA will not
    // claim a game is playable while pointing at nothing.
    status: RUNOUT_PLAY_URL ? 'playable' : 'in-development',
    playable: Boolean(RUNOUT_PLAY_URL),
    playUrl: RUNOUT_PLAY_URL || undefined,
    githubUrl: RUNOUT_SOURCE_URL || undefined,

    artwork: '/games/runout/cover.svg',
    banner: '/games/runout/banner.svg',
    artworkAlt:
      'A suburban street at night: a porch light on, someone at the door with a torch, and a figure sprinting along the pavement towards a parked van.',

    // Everything below is taken from RUNOUT's own README — no invented copy.
    description:
      'A solo ding-dong-and-run extraction game. Ring the bell, get seen legging it, lose them, and decide whether to risk one more house before you run for the van.',

    body: [
      'The van is the only safe place and the only way to cash out. Everything between you and it is a decision about how greedy to be.',
      'Cash and upgrades are permanent, and a bust only costs the stash you were carrying. So the pressure is always "one more house", never "start over".',
    ],

    features: [
      'Houses are graded by risk — better payouts answer the door faster and send worse things after you',
      'Getting seen is the job: leg it unnoticed and there is no payout, only Heat',
      'Half of every bell’s Heat is permanent for the night, so the street only ever gets harder',
      'The house tells you what is coming — a lit porch, a floodlit garden, a kennel by the gate',
      'Darkness and hedges break line of sight, so escaping is about cover rather than speed',
      'Permanent upgrades that change the route through a night, not just the numbers',
    ],

    controls: [
      { keys: 'WASD / Arrows', action: 'Move' },
      { keys: 'Shift', action: 'Sprint — burns stamina' },
      { keys: 'E', action: 'Ring the doorbell / extract at the van' },
      { keys: 'Q', action: 'Throw a firecracker, once you own some' },
      { keys: 'M', action: 'Mute' },
    ],

    // Real screenshots only — add them to public/ and list them here when they
    // exist. The gallery section hides itself until then.
  },
]

/** Library order: featured and newer entries first, then alphabetical. */
export const libraryGames: Game[] = [...games].sort(
  (a, b) => (b.order ?? 0) - (a.order ?? 0) || a.title.localeCompare(b.title),
)

export function getGame(slug: string): Game | undefined {
  return games.find((game) => game.slug === slug)
}

/** The hero game, if one is marked featured. */
export function getFeaturedGame(): Game | undefined {
  return libraryGames.find((game) => game.featured)
}

export { isPlayable } from '../lib/gameAction'




import type { Game } from '../types'

/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ RUNOUT'S LIVE URL GOES HERE.                                             │
 * │                                                                          │
 * │ RUNOUT is deployed as its own separate Netlify site, from games/runout.  │
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
const RUNOUT_PLAY_URL = 'https://runout-game.netlify.app'

/**
 * RUNOUT's source, in the public game-hub monorepo alongside this website:
 *
 *   madebynova/game-hub
 *     games/runout/   the game  — its own Vite project, its own Netlify site
 *     website/        this site — its own Vite project, its own Netlify site
 *
 * Set it to '' to hide the Source buttons.
 */
const RUNOUT_SOURCE_URL = 'https://github.com/madebynova/game-hub/tree/main/games/runout'

/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ TIDES OF FORTUNE'S LIVE URL GOES HERE.                                   │
 * │                                                                          │
 * │ The game lives in this same monorepo (games/salt-and-sovereigns/ — the   │
 * │ folder keeps the game's earlier name) as a static HTML/CSS/JS site with  │
 * │ no build step. Deploy that folder as its own Netlify site, then paste    │
 * │ the URL below and nothing else needs changing:                           │
 * │                                                                          │
 * │   TIDES_OF_FORTUNE_PLAY_URL = 'https://your-site.netlify.app'            │
 * │                                                                          │
 * │ That one edit flips the card from "In development" to "Playable" and     │
 * │ turns every VIEW PROJECT button into PLAY NOW — on the library card, the │
 * │ homepage spotlight and the game page at once.                            │
 * │                                                                          │
 * │ Leave it empty until the site actually exists. An empty string means     │
 * │ NOVA advertises no play link at all, which is the honest state.          │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
const TIDES_OF_FORTUNE_PLAY_URL = ''

/** Tides of Fortune's source, in the public game-hub monorepo. '' hides Source. */
const TIDES_OF_FORTUNE_SOURCE_URL =
  'https://github.com/madebynova/game-hub/tree/main/games/salt-and-sovereigns'

/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ DEEP DIVE'S LIVE URL GOES HERE.                                          │
 * │                                                                          │
 * │ Deep Dive lives in this same monorepo (games/deep-dive/) as its own Vite │
 * │ project. Import the repo into Netlify with the base directory set to     │
 * │ games/deep-dive — its netlify.toml supplies the build command and the    │
 * │ dist publish directory — then paste the site's URL below:                │
 * │                                                                          │
 * │   DEEP_DIVE_PLAY_URL = 'https://your-deep-dive-site.netlify.app'         │
 * │                                                                          │
 * │ That one edit flips the card from "In development" to "Playable" and     │
 * │ turns every VIEW PROJECT button into PLAY NOW — on the library card and  │
 * │ the game page at once.                                                   │
 * │                                                                          │
 * │ Leave it empty until the site actually exists. An empty string means     │
 * │ NOVA advertises no play link at all, which is the honest state.          │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
const DEEP_DIVE_PLAY_URL = ''

/** Deep Dive's source, in the public game-hub monorepo. '' hides Source. */
const DEEP_DIVE_SOURCE_URL = 'https://github.com/madebynova/game-hub/tree/main/games/deep-dive'

/**
 * The NOVA library.
 *
 * Adding a game means adding an object to this array — no component needs
 * touching. It then appears in the library grid and gets its own page at
 * `/games/<slug>`. Its changelog lives in `updates.ts`.
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
 *     artwork: '/games/my-game/cover.svg',     // 3:4, in public/
 *     banner: '/games/my-game/banner.svg',     // 16:9, in public/
 *     artworkAlt: 'What the art shows',
 *     tagline: 'One short line for the library card.',
 *     description: 'One or two sentences.',
 *     body: ['A paragraph.', 'Another.'],
 *     features: ['Something the game actually does'],
 *     controls: [{ keys: 'WASD', action: 'Move' }],
 *     screenshots: [{ src: '/games/my-game/1.png', alt: '…' }],
 *     platform: 'Browser',
 *     tech: ['TypeScript', 'Vite'],
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
    tagline: 'Ring the bell, get seen, lose them — then risk one more house, or run for the van.',

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

    platform: 'Browser',
    tech: ['TypeScript', 'Vite', 'HTML5 Canvas'],

    // Real screenshots only — add them to public/ and list them here when they
    // exist. The gallery section hides itself until then.
  },
  {
    id: 'salt-and-sovereigns',
    // The slug, folder and asset paths keep the game's earlier name, Salt &
    // Sovereigns, so links and files stay put. Players only ever see the title.
    title: 'Tides of Fortune',
    subtitle: 'Open Waters',
    slug: 'salt-and-sovereigns',
    order: 90,

    // Derived from the URL above so the two can never disagree: NOVA will not
    // claim a game is playable while pointing at nothing.
    status: TIDES_OF_FORTUNE_PLAY_URL ? 'playable' : 'in-development',
    playable: Boolean(TIDES_OF_FORTUNE_PLAY_URL),
    playUrl: TIDES_OF_FORTUNE_PLAY_URL || undefined,
    githubUrl: TIDES_OF_FORTUNE_SOURCE_URL || undefined,

    artwork: '/games/salt-and-sovereigns/cover.svg',
    banner: '/games/salt-and-sovereigns/banner.svg',
    artworkAlt:
      'A pirate ship under full sail at sunset, crossing open water with islands on the horizon.',

    // Everything below is taken from the game's own README and in-game manual.
    tagline: 'Sail, trade and smuggle your way to a fortune across the open waters.',

    description:
      'A pirate trading adventure where you sail, trade, take contracts, evade the Navy, build businesses, collect ships, and grow your fortune across the open waters.',

    body: [
      'Prices are frozen while you sail and only move when you rest at a port, so every voyage is a real bet on where to be next.',
      'Trade honestly or run contraband for far better margins — the Navy notices either way, and a high Wanted level turns the open water against you.',
    ],

    features: [
      'Buy low, sell high across eight ports with their own drifting, live prices',
      'Take on contracts — courier runs, passenger jobs and timed supply deliveries',
      'Smuggle contraband for far bigger margins, at the cost of Navy inspections and open-water chases',
      'Build a business empire — own and upgrade properties in every port for passive income',
      'Collect and command Legendary Ships, each trading one real strength for a real weakness',
      'Bid against rival captains in rare Black Market Auctions',
      'Compare your fortune on a leaderboard against rival captains and friends via shareable codes',
    ],

    controls: [
      { keys: 'WASD / Arrows', action: 'Steer — momentum-based sailing' },
      { keys: 'E', action: 'Dock at a port' },
      { keys: 'Space', action: 'Sell your whole hold, once docked' },
      { keys: 'Enter', action: 'Set sail — leave the port' },
      { keys: 'M', action: 'Open the charts — Map / Market / Ports' },
      { keys: 'H', action: 'Hide the HUD' },
      { keys: 'Esc', action: 'Pause, or close the current menu' },
    ],

    platform: 'Browser',
    tech: ['JavaScript', 'HTML5 Canvas', 'No build step'],

    // Real screenshots only — add them to public/ and list them here when they
    // exist. The gallery section hides itself until then.
  },
  {
    id: 'deep-dive',
    title: 'Deep Dive',
    subtitle: 'The Deep Opens',
    slug: 'deep-dive',
    order: 80,

    // Derived from the URL above so the two can never disagree: NOVA will not
    // claim a game is playable while pointing at nothing.
    status: DEEP_DIVE_PLAY_URL ? 'playable' : 'in-development',
    playable: Boolean(DEEP_DIVE_PLAY_URL),
    playUrl: DEEP_DIVE_PLAY_URL || undefined,
    githubUrl: DEEP_DIVE_SOURCE_URL || undefined,

    artwork: '/games/deep-dive/cover.svg',
    banner: '/games/deep-dive/banner.svg',
    artworkAlt:
      'A dive boat on a sunset sea above a diver sweeping a flashlight towards a sunken shipwreck, with a relic glowing in the dark water far below.',

    // Everything below is taken from the game's own README — no invented copy.
    tagline: 'Dive for sunken treasure, watch your air, and decide how deep you dare to go.',

    description:
      'A risk-vs-reward treasure diving game. Dive from the boat, collect treasure while your oxygen drains, and decide whether to surface with what you have or push deeper for something better.',

    body: [
      'Treasure in your bag is at risk until you sell it on the boat. Run out of air and you black out — the crew hauls you aboard, but your haul sinks in a glowing satchel you can dive back to recover.',
      'Sell, upgrade your gear and push through three zones that get darker, harder on your air and richer the deeper you go.',
    ],

    features: [
      'Three zones: the Shallow Reef, a shipwreck you can swim inside, and the crushing dark of the Abyss',
      'Oxygen drains faster the deeper you go, and a marker on the air gauge shows the air you need to swim straight up',
      '20 treasures across five rarity tiers, with heavy finds that take two bag slots',
      'Hazards without enemies: strong currents, collapsing wreckage, tight passages and limited air pockets',
      'Optional dive objectives that only pay out once you make it back aboard',
      'Oxygen Tank, Dive Bag, Flashlight and Power Fins upgrades, saved in your browser',
    ],

    controls: [
      { keys: 'WASD / Arrows', action: 'Swim, or walk the deck' },
      { keys: 'E (hold)', action: 'Collect treasure / recover a lost satchel' },
      { keys: 'E', action: 'Climb aboard / open the trading deck' },
      { keys: 'Space', action: 'Dive in from the boat' },
      { keys: 'Esc', action: 'Close the trading deck' },
      { keys: 'M', action: 'Mute' },
    ],

    platform: 'Browser',
    tech: ['TypeScript', 'Vite', 'HTML5 Canvas'],

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

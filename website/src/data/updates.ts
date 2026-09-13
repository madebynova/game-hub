import type { UpdateEntry } from '../types'

/**
 * Every game's changelog.
 *
 * Updates belong to a game: each one appears in the Latest updates section of
 * that game's page, and the newest per game shows under Recently updated on the
 * homepage. There is no separate updates page.
 *
 * Only write up what actually shipped. The entries below come from each game's
 * own history — RUNOUT's commit log in games/runout, and the in-game change log
 * in games/salt-and-sovereigns/src/game.js.
 *
 * Newest first is handled by `sortedUpdates` below. Entries on the same date
 * keep the order they have here, so list same-day entries newest first.
 *
 *   {
 *     id: 'my-game-0-4',
 *     gameSlug: 'my-game',
 *     version: 'v0.4',             // optional, if the game has version labels
 *     title: 'Update title',
 *     date: '2026-01-20',          // ISO
 *     summary: 'One line, optional.',
 *     changes: [
 *       { label: 'Added', items: ['...'] },
 *       { label: 'Fixed', items: ['...'] },
 *     ],
 *   }
 */
export const updates: UpdateEntry[] = [
  // RUNOUT ---------------------------------------------------------------

  {
    id: 'runout-live',
    gameSlug: 'runout',
    title: 'Playable in the browser',
    date: '2026-09-12',
    summary:
      'RUNOUT is live on its own site. Play now opens it in a new tab — a modern browser is the only requirement.',
  },
  {
    id: 'runout-job-board',
    gameSlug: 'runout',
    title: 'Job board, sharper upgrades and a dog fix',
    date: '2026-09-12',
    summary:
      'Every night now starts with a choice of job, three upgrades have clearer roles, and dogs only come from houses that actually keep one.',
    changes: [
      {
        label: 'Added',
        items: [
          'A job board before each night: pick one of three offers from seven job types, each carrying a different kind of risk',
          'The fence takes its cut up front, so the biggest payout is not automatically the right pick',
        ],
      },
      {
        label: 'Changed',
        items: [
          'Socks is now Stealth — a hot street sends fewer extra people to each door',
          'Cardio is now Endurance — faster stamina recovery between houses',
          'Scout is now Info — shows which houses keep a dog or a floodlight from scouting range',
          'The Good End costs less up front and pays more',
        ],
      },
      {
        label: 'Fixed',
        items: [
          'Dogs no longer chase from houses without a kennel, and one house can no longer send two',
          'The Round and Full Driveways could never be offered',
        ],
      },
    ],
  },
  {
    id: 'runout-chase-balance',
    gameSlug: 'runout',
    title: 'Chase balance and patrol pressure',
    date: '2026-09-12',
    summary:
      'Three rounds of playtest feedback: running away can now open real distance, and escaping a patrol is worth something.',
    changes: [
      {
        label: 'Changed',
        items: [
          'Dogs tire after their opening burst, so a proper sprint breaks the chase',
          'Furious homeowners give up a little sooner',
          'Chasers turn with momentum, so cutting a corner costs them more than you',
          'Patrols are capped, with a quiet spell after one leaves',
          'Neighbourhood Watch now wears hi-vis green, and the player has a pale outline, so the two no longer blur mid-chase',
        ],
      },
      {
        label: 'Fixed',
        items: [
          'A patrol walking its beat no longer blocks extraction or stops Heat cooling',
          'Kennel dogs now actually give chase instead of giving up before they start',
        ],
      },
    ],
  },

  // Salt & Sovereigns ----------------------------------------------------

  {
    id: 'salt-and-sovereigns-v2-7',
    gameSlug: 'salt-and-sovereigns',
    version: 'v2.7',
    title: 'Black Market Auctions',
    date: '2026-09-11',
    summary:
      'Rare, time-limited auctions open at pirate havens, with rival captains bidding against you for genuinely rare prizes.',
    changes: [
      {
        label: 'Added',
        items: [
          'Secret auctions that open at a random pirate haven, with a deadline to get there',
          '2–3 rival bidders per auction, drawn from five archetypes with their own budgets',
          'Rare, Epic and Legendary prizes — from gold caches to the Legendary Vessel Blueprint',
        ],
      },
    ],
  },
  {
    id: 'salt-and-sovereigns-v2-6',
    gameSlug: 'salt-and-sovereigns',
    version: 'v2.6',
    title: 'Trade Monopolies',
    date: '2026-09-11',
    summary:
      'Owning production now builds Trade Influence, worth small capped price advantages and a reputation of your own.',
    changes: [
      {
        label: 'Added',
        items: [
          'Trade Influence for each produced commodity, from No Influence up to Monopoly',
          'Small buy discounts and sell bonuses at higher tiers, capped at ±10%',
          'Reputation titles such as Sugar King or Smuggling Tycoon, earned from how you play',
        ],
      },
    ],
  },
  {
    id: 'salt-and-sovereigns-v2-5',
    gameSlug: 'salt-and-sovereigns',
    version: 'v2.5',
    title: 'Port Real Estate',
    date: '2026-09-11',
    summary: 'Every port now has a business to buy, upgrade and collect from.',
    changes: [
      {
        label: 'Added',
        items: [
          'One business per port — five that produce goods and three that improve the port itself',
          'A new Empire tab to buy in, upgrade from Level 1 to 3, and collect stockpiled goods',
        ],
      },
      {
        label: 'Balance',
        items: [
          'Fully developing one property costs up to ~96,000 gold, so specialising is a real choice',
        ],
      },
    ],
  },
  {
    id: 'salt-and-sovereigns-v2-4',
    gameSlug: 'salt-and-sovereigns',
    version: 'v2.4',
    title: 'Dashboard help tooltip',
    date: '2026-09-11',
    summary: "A small \"?\" beside Ship's Dashboard explains every stat in plain language.",
    changes: [
      {
        label: 'Fixed',
        items: ['The Holdings row could stay visible with no ventures owned'],
      },
    ],
  },
  {
    id: 'salt-and-sovereigns-v2-3',
    gameSlug: 'salt-and-sovereigns',
    version: 'v2.3',
    title: 'Business Holdings',
    date: '2026-09-11',
    summary: 'Buy stakes in business ventures that pay a slow, steady income while you sail.',
    changes: [
      {
        label: 'Added',
        items: [
          'Business ventures from 2,500 gold, up to 12, each paying 45 gold per in-game day',
          'A Holdings line on the dashboard once you own a venture',
        ],
      },
    ],
  },
  {
    id: 'salt-and-sovereigns-v2-2',
    gameSlug: 'salt-and-sovereigns',
    version: 'v2.2',
    title: 'Reef visibility and service quantities',
    date: '2026-09-11',
    changes: [
      {
        label: 'Changed',
        items: ['One shared ×1 / ×5 / Max selector for every repeatable Port Service purchase'],
      },
      {
        label: 'Fixed',
        items: [
          'Reefs carried over from older voyages could sit half-buried inside an island — they now move to clear water on load',
        ],
      },
    ],
  },
  {
    id: 'salt-and-sovereigns-v2-1',
    gameSlug: 'salt-and-sovereigns',
    version: 'v2.1',
    title: "Hide HUD and the Captain's Manual",
    date: '2026-09-11',
    changes: [
      {
        label: 'Added',
        items: [
          'A Hide HUD button and the H key, for a clean view of the sea',
          "A tabbed in-game Captain's Manual covering trading, ships, navigation, combat and more",
        ],
      },
    ],
  },
  {
    id: 'salt-and-sovereigns-v2-0',
    gameSlug: 'salt-and-sovereigns',
    version: 'v2.0',
    title: 'Reef-aware Navy',
    date: '2026-09-10',
    summary: 'Navy cutters steer around reefs, so cutting close past rocks is now a real escape.',
    changes: [
      {
        label: 'Changed',
        items: [
          'Cutters slip around reefs in their path and slow down in dense clusters',
          'Their reef-reading gets sharper as your Wanted level rises',
        ],
      },
    ],
  },
  {
    id: 'salt-and-sovereigns-v1-9',
    gameSlug: 'salt-and-sovereigns',
    version: 'v1.9',
    title: 'The Fortune goal',
    date: '2026-09-10',
    summary:
      'The long-term goal is now a Fortune of 1,000,000 Sovereigns, with a ladder of milestones on the way.',
    changes: [
      {
        label: 'Added',
        items: [
          'A live Fortune progress bar on the dashboard',
          "Grand Fittings: Ironbound Hull, Master's Charter, Bluewater Clipper Rig and Galleon Conversion",
        ],
      },
      {
        label: 'Changed',
        items: [
          'Shipwright upgrades now go to Level 8, and the Gunfoundry to 6 cannons',
          'Older saves keep all their progress and are re-aimed at the Fortune',
        ],
      },
    ],
  },
  {
    id: 'salt-and-sovereigns-v1-8',
    gameSlug: 'salt-and-sovereigns',
    version: 'v1.8',
    title: 'Friends',
    date: '2026-09-10',
    changes: [
      {
        label: 'Added',
        items: [
          'Friend codes, friend requests and a Friends list',
          'Full captain profiles for any friend or leaderboard entry',
        ],
      },
    ],
  },
  {
    id: 'salt-and-sovereigns-v1-7',
    gameSlug: 'salt-and-sovereigns',
    version: 'v1.7',
    title: 'Contracts, crew and naval combat',
    date: '2026-09-10',
    changes: [
      {
        label: 'Added',
        items: [
          'Contracts at every port — cargo, passenger, supply and courier jobs',
          'A Fight option in Navy encounters, with the win chance shown',
          'Crew to sign on, a Gunfoundry, and a Shipyard to repaint your ship',
        ],
      },
      {
        label: 'Changed',
        items: [
          'Slightly faster top speed with sharper acceleration and turning',
          'Hiding contraband is now partial, and you can still run after a bad search',
        ],
      },
    ],
  },
  {
    id: 'salt-and-sovereigns-v1-6',
    gameSlug: 'salt-and-sovereigns',
    version: 'v1.6',
    title: 'A wider world',
    date: '2026-09-10',
    changes: [
      {
        label: 'Added',
        items: [
          'A bigger sea with 8 ports — Saltmarsh and Ironcliff join, with Salt Fish and Iron Ore',
          'Island identities with their own buildings and landmarks',
          'Tabbed charts: Map, Market and Ports',
        ],
      },
    ],
  },
  {
    id: 'salt-and-sovereigns-v1-5',
    gameSlug: 'salt-and-sovereigns',
    version: 'v1.5',
    title: 'Earnings, stats and save slots',
    date: '2026-09-10',
    changes: [
      {
        label: 'Added',
        items: [
          'Lifetime Earnings and Net Worth on the dashboard',
          'A Statistics screen and three save slots',
          'Shipwright upgrades and Hull Insurance',
        ],
      },
      {
        label: 'Changed',
        items: ['The leaderboard ranks by Lifetime Earnings rather than playtime'],
      },
    ],
  },
  {
    id: 'salt-and-sovereigns-v1-4',
    gameSlug: 'salt-and-sovereigns',
    version: 'v1.4',
    title: 'Market clarity and naval fixes',
    date: '2026-09-10',
    changes: [
      {
        label: 'Changed',
        items: [
          'Every commodity shows a clear buy or sell verdict against its normal price',
          'Buying or selling in bulk now moves the local price',
        ],
      },
      {
        label: 'Fixed',
        items: [
          'Reefs are much easier to see on the water, the minimap and the chart',
          'Cutters give a 3-second boarding countdown instead of capturing on contact',
          'Clean ships at 1★ are no longer inspected at the dock',
        ],
      },
    ],
  },
  {
    id: 'salt-and-sovereigns-v1-3',
    gameSlug: 'salt-and-sovereigns',
    version: 'v1.3',
    title: 'Change log, leaderboard and captain names',
    date: '2026-09-09',
    changes: [
      {
        label: 'Added',
        items: [
          'An in-game change log',
          'Custom captain names that travel with your saves',
          'A live playtime timer and a captains’ leaderboard',
        ],
      },
    ],
  },
  {
    id: 'salt-and-sovereigns-v1-2',
    gameSlug: 'salt-and-sovereigns',
    version: 'v1.2',
    title: 'Smuggling and the Navy',
    date: '2026-09-09',
    changes: [
      {
        label: 'Added',
        items: [
          'Contraband that buys cheap in pirate havens and sells for 3×–5× at Crown ports',
          'A 1–5 star Wanted level with Navy patrols that give chase',
          'Bribe, slip or flee at inspections, plus False Cargo Holds to hide goods',
        ],
      },
      {
        label: 'Changed',
        items: ['A parchment-and-wood redesign of the whole interface'],
      },
    ],
  },
]

/** Newest first. Array.sort is stable, so same-day entries keep their order. */
export const sortedUpdates: UpdateEntry[] = [...updates].sort((a, b) =>
  b.date.localeCompare(a.date),
)

export function updatesForGame(slug: string): UpdateEntry[] {
  return sortedUpdates.filter((update) => update.gameSlug === slug)
}

/** The newest update from each game, newest first — the homepage activity list. */
export function latestUpdatePerGame(): UpdateEntry[] {
  const seen = new Set<string>()
  return sortedUpdates.filter((update) => {
    if (seen.has(update.gameSlug)) return false
    seen.add(update.gameSlug)
    return true
  })
}

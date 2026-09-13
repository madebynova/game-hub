# NOVA

The website for NOVA, a small indie game hub. Dark, fast, and data-driven: games
and their changelogs are plain TypeScript files, so adding a title means adding
an object — not building another page.

Vite + React + TypeScript. No UI framework, no CSS framework, no state library.

## Running it

```bash
npm install
npm run dev
```

Opens `http://localhost:5173`.

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Typecheck, then build to `dist/` |
| `npm run preview` | Serve the built `dist/` locally |
| `npm run typecheck` | Types only, no build |

## What's on the site

| Route | Page |
| --- | --- |
| `/` | Hero, featured game, the library, About NOVA, recently updated games |
| `/games` | The whole library |
| `/games/<slug>` | A game's page: banner, title, status, description, actions, About, Features, Controls, Screenshots, Latest updates, Project information, back to games |
| `/updates` | Redirects to `/games` — updates live on each game's page |

The main navigation is Home and Games, plus the GitHub button. Every page sets
its own title (`RUNOUT — NOVA`), description and share tags through
`lib/usePageTitle.ts`.

## Adding a game

Everything about the library comes from [`src/data/games.ts`](src/data/games.ts).
Add an object and the game appears in the grid, gets its own page at
`/games/<slug>`, and can be featured on the homepage:

```ts
{
  id: 'my-game',
  title: 'My Game',
  slug: 'my-game',
  status: 'in-development',   // 'playable' | 'in-development' | 'coming-soon'
}
```

Only `id`, `title`, `slug` and `status` are required. Every other field is
optional and **the UI renders only what exists** — no empty sections, no
placeholder copy. Fill in a field when the information is real:

| Field | Effect |
| --- | --- |
| `playable` + `playUrl` | PLAY NOW appears on the card, spotlight and game page |
| `githubUrl` | Source buttons appear |
| `artwork` / `banner` | Real art replaces the generated plate (see below) |
| `tagline` | The one line on the library card (falls back to `description`) |
| `description`, `body` | Intro text and the About section |
| `features` | The Features section |
| `controls` | The controls table |
| `screenshots` | The gallery, with a lightbox |
| `platform`, `tech` | Rows in the game page's Project information panel |
| `featured` | Puts the game in the homepage spotlight |
| `order` | Sorts the library; higher first |

`title` is what players see; `slug` is only the URL and asset folder. Tides of
Fortune keeps the slug `salt-and-sovereigns` from its earlier name so its links
and files stay put.

The full list with comments is in [`src/types.ts`](src/types.ts).

### Linking a separately deployed game

Games are hosted on their own sites — NOVA only links to them. RUNOUT lives in
`games/runout/` in this monorepo and is deployed as its own Netlify site; the
website never embeds or bundles it.

`src/data/games.ts` opens with the URL constants for each game:

```ts
const RUNOUT_PLAY_URL = 'https://runout-game.netlify.app'
const TIDES_OF_FORTUNE_PLAY_URL = ''   // empty until the game is deployed
```

Each entry derives `status`, `playable` and `playUrl` from its play URL, so NOVA
will never claim a game is playable while pointing at nothing. Filling a URL in
flips the card to "Playable" and every VIEW PROJECT into PLAY NOW, across the
library card, the homepage spotlight and the game page at once.

### Status drives the primary action

`src/lib/gameAction.ts` is the only place that branches on status. Everything
that shows a button asks it what to render, so nothing can disagree:

| Status | Primary action | Goes to |
| --- | --- | --- |
| `playable` | **Play now** | `playUrl` (needs `playable: true` too) |
| `in-development` | **View project** | the game's page |
| `coming-soon` | **Coming soon** | nothing — rendered as a marker, not a button |

On a game's own page "View project" would link to itself, so it becomes a
"Not playable yet" marker with a pointer to the latest updates.

### Artwork

Put image files in `public/games/<slug>/` and reference them by path. Covers
are 3:4 and banners 16:9. Library cards show the cover, and swap to the banner
on phones where the card turns wide. Game pages and the homepage spotlight show
the banner with text over its left side, so keep its subject right of centre.
Set `artworkAlt` whenever you set artwork.

Real gameplay screenshots belong in `screenshots`, not in `artwork`.

Without artwork a game gets a generated typographic plate — its title on a
tinted ground. It is deliberately abstract rather than a fake screenshot.

### Empty states

An empty section is a designed state rather than a fallback. `EmptyPanel` draws
the outline of the content that belongs there — `motif="library"` shows cover
frames, `motif="log"` shows changelog rows — and the library grid ends with an
open slot saying more games are on the way. None of them carry titles, art,
dates or counts.

## Adding an update

[`src/data/updates.ts`](src/data/updates.ts) holds every game's changelog.
Each entry belongs to a game through `gameSlug`:

```ts
{
  id: 'my-game-0-4',
  gameSlug: 'my-game',
  version: 'v0.4',             // optional
  title: 'Update title',
  date: '2026-01-20',
  summary: 'Optional one-liner.',
  changes: [
    { label: 'Added', items: ['...'] },
    { label: 'Fixed', items: ['...'] },
  ],
}
```

Entries sort newest first (same-day entries keep their order in the file) and
appear in the Latest updates timeline on that game's page. The newest from each
game also shows under Recently updated on the homepage.

Only write up what actually shipped. The current entries come from RUNOUT's
commit history, Tides of Fortune's in-game change log, and ABYSSBOUND's commit
history and README.

## Site configuration

[`src/data/site.ts`](src/data/site.ts) holds the name, tagline, description,
GitHub URL and contact address.

The site's own address is not typed anywhere. At build time `vite.config.ts`
reads Netlify's `URL` environment variable (or `VITE_SITE_URL`, if set) and uses
it for the canonical link, `og:url` and the `og-image.png` share image. Local
builds have no address, so those tags are simply left out.

**`site.ts` is bundled and shipped to every visitor. Public values only — no
keys, tokens or credentials.** The site has no backend by design.

## Deploying to Netlify

`netlify.toml` declares everything Netlify needs:

- build command: `npm run build`
- publish directory: `dist`
- Node 22
- SPA fallback so `/games/<slug>` works on a hard refresh
- long cache headers for hashed assets

Import the `madebynova/game-hub` repository into Netlify and set the **base
directory to `website`**. Every push to `main` then rebuilds and redeploys the
site.

## A note on the dev server

Vite occasionally caches an empty transform for a file that was replaced
wholesale rather than edited, which shows up as a component losing all its
styles. Appending a newline to the file (or restarting `npm run dev`) clears
it. It never affects `npm run build`.

## Layout

```
index.html            Vite entry point and static meta tags
netlify.toml          Netlify build + publish + redirect config
vite.config.ts        Build config; injects the site URL
public/               Static files served as-is (favicon, share image, game art)
src/
  main.tsx            Bootstrap
  App.tsx             Routes; every page but Home is code-split
  types.ts            Game and UpdateEntry shapes
  env.d.ts            Build-time constants
  data/
    games.ts          The library
    updates.ts        Every game's changelog
    site.ts           Name, tagline, links
  lib/
    gameAction.ts     Status -> primary action. The only place status branches
    formatDate.ts     ISO date -> readable date
    plural.ts         "1 game" / "2 games" count labels
    usePageTitle.ts   Per-route title, description, share tags, canonical URL
  components/
    Layout            Shell: skip link, nav, main, footer
    Navbar            Top bar: brand, Home, Games, GitHub
    Footer
    Button            One component: <button>, <Link> or <a> by prop
    GameArt           Real artwork, or the generated plate
    GameCard          Library card
    GameGrid          The responsive grid, with its open slot
    FeaturedGame      Homepage centrepiece
    GameActions       A game's buttons, driven by lib/gameAction
    UpdateLog         A game's changelog timeline
    UpdateCard        One changelog entry
    ActivityFeed      Homepage "Recently updated" rows
    EmptyPanel        Empty sections; previews the shape of its own content
    Gallery           Screenshots + lightbox
    SectionHeader     Section title block
    ArrowLink         The small "see all" link
    StatusBadge       Playable / In development / Coming soon
    icons.tsx         The inline SVGs the site uses
  pages/
    Home, Games, GameDetails, NotFound
  styles/
    tokens.css        Colours, space, type, radius, elevation, motion
    global.css        Reset, layout primitives, focus ring, reduced motion
```

## Conventions worth keeping

- **Never invent game content.** Empty is a designed state; filler is not.
- **Tokens, not values.** New colours, spacing and radii belong in `tokens.css`.
- **One accent.** Amber is for the primary action, the active nav item, the
  focus ring and small brand marks. Everything else is neutral.
- **Motion is subtle and optional.** Every animation is disabled under
  `prefers-reduced-motion: reduce`.
- **Links are links.** `Button` renders a real `<a>` or `<Link>` when given a
  destination. States with nowhere to go render a marker, never a disabled
  button.
- **Status branches in one file.** If you find yourself writing
  `status === '…'` in a component, put it in `lib/gameAction.ts` instead.
- **Empty states preview their own content.** A new empty section should add a
  motif to `EmptyPanel`, not a new panel component.
- **No dead tokens.** If nothing in `src/` references a token or utility,
  delete it rather than keeping it around for later.

# NOVA

A small indie game hub. Dark, fast, and data-driven: games and their changelogs
are plain TypeScript files, so adding a title means adding an object — not
building another page.

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
| `/` | Hero, featured game, the library grid, recently updated games, about NOVA |
| `/games` | The whole library |
| `/games/<slug>` | A game's page: banner, Play / Source, About, Features, Controls, Screenshots, Latest updates, Project information |
| `/updates` | Redirects to `/games` — updates now live on each game's page |

The main navigation is Home and Games, plus the GitHub button.

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
| `description`, `body` | Intro text and the About section |
| `features` | The Features section |
| `controls` | The controls table |
| `screenshots` | The gallery, with a lightbox |
| `platform`, `tech` | Rows in the game page's Project information panel |
| `featured` | Puts the game in the homepage spotlight |
| `order` | Sorts the library; higher first |

The full list with comments is in [`src/types.ts`](src/types.ts).

### Linking a separately deployed game

Games are hosted wherever they like — NOVA only links to them. RUNOUT, for
example, lives in `games/runout/` in this monorepo and is deployed as its own
Netlify site; the website never embeds or bundles it.

`src/data/games.ts` opens with the URL constants for each game:

```ts
const RUNOUT_PLAY_URL = 'https://runout-game.netlify.app'
const RUNOUT_SOURCE_URL = 'https://github.com/madebynova/game-hub/tree/main/games/runout'
```

Each entry derives `status`, `playable` and `playUrl` from its play URL, so the
two can never disagree — NOVA will not claim a game is playable while pointing
at nothing. Salt & Sovereigns' play URL is empty until its site is deployed, so
it is listed as In development. Filling a URL in flips the card to "Playable"
and every VIEW PROJECT into PLAY NOW, across the library card, the homepage
spotlight and the game page at once.

PLAY NOW is a plain external link (`target="_blank"`, `rel="noreferrer
noopener"`), so the game opens on its own site.

### Status drives the primary action

`src/lib/gameAction.ts` is the only place that branches on status. Everything
that shows a button — the card, the homepage spotlight, the game page — asks it
what to render, so they can never disagree:

| Status | Primary action | Goes to |
| --- | --- | --- |
| `playable` | **Play now** | `playUrl` (needs `playable: true` too) |
| `in-development` | **View project** | the game's page |
| `coming-soon` | **Coming soon** | nothing — rendered as a marker, not a button |

On a game's own page "View project" would link to itself, so it is replaced by
a quiet "Not playable yet" marker. Adding a status means editing that one file.

### Artwork

Drop image files in `public/` (e.g. `public/games/my-game/cover.svg`) and
reference them by path: `artwork: '/games/my-game/cover.svg'`. Covers are 3:4
and banners 16:9; the banner is shown cropped wider on game pages and the
homepage spotlight, with text over its left side, so keep the subject right of
centre. Set `artworkAlt` whenever you set artwork.

RUNOUT's and Salt & Sovereigns' covers and banners are original hand-written
SVGs. Real gameplay screenshots belong in `screenshots`, not in `artwork`.

Without artwork a game gets a generated typographic plate — its title on a
tinted ground, tinted from its slug. It is deliberately abstract rather than a
fake screenshot, so an unillustrated game looks unillustrated, not broken.

### Empty states

An empty section is a designed state rather than a fallback. `EmptyPanel` draws
the outline of the content that belongs there — `motif="library"` shows cover
frames, `motif="log"` shows changelog rows — and the library grid ends with an
open slot saying more games are on the way. None of them carry titles, art,
dates or counts, so nothing on the page implies content that does not exist.

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

Entries sort themselves newest first (same-day entries keep their order in the
file) and appear in the Latest updates timeline on that game's page. The newest
entry is open, the next two are collapsed, and older ones sit behind a "Show
earlier updates" button, so the section scales however long the history gets.
The newest update from each game also shows under Recently updated on the
homepage.

Only write up what actually shipped. The current entries come from RUNOUT's
commit history and Salt & Sovereigns' in-game change log.

## Site configuration

[`src/data/site.ts`](src/data/site.ts) holds the name, tagline, description,
GitHub URL and contact address. The GitHub button and footer contact link hide
themselves when their value is empty.

**This file is bundled and shipped to every visitor. Public values only — no
keys, tokens or credentials.** The site has no backend and no environment
variables by design.

## A note on the dev server

Vite occasionally caches an empty transform for a file that was replaced
wholesale rather than edited, which shows up as a component losing all its
styles or a module "not providing" an export it clearly has. Appending a
newline to the file (or restarting `npm run dev`) clears it. It never affects
`npm run build`.

## Deploying to Netlify

`netlify.toml` declares everything Netlify needs, so nothing has to be
configured in its UI:

- build command: `npm run build`
- publish directory: `dist`
- SPA fallback so `/games/<slug>` works on a hard refresh
- long cache headers for hashed assets

Connect the repo to Netlify with `website/` as the base directory and every
push builds and deploys. Drag-and-drop works too: run `npm run build` and drop
`dist/` onto Netlify.

## Layout

```
index.html            Vite entry point
netlify.toml          Netlify build + publish + redirect config
public/               Static files served as-is (favicon, game artwork)
src/
  main.tsx            Bootstrap
  App.tsx             Routes; every page but Home is code-split
  types.ts            Game and UpdateEntry shapes
  data/
    games.ts          The library
    updates.ts        Every game's changelog
    site.ts           Name, tagline, links
  lib/
    gameAction.ts     Status -> primary action. The only place status branches
    formatDate.ts     ISO date -> readable date
    plural.ts         "1 game" / "2 games" count labels
    usePageTitle.ts   Per-route <title> and meta description
  components/
    Layout            Shell: skip link, nav, main, footer
    Navbar            Top bar: brand, Home, Games, GitHub
    Footer
    Button            One component: <button>, <Link> or <a> by prop
    GameArt           Real artwork, or the generated plate
    GameCard          Library tile
    GameGrid          The responsive grid, with its open slot
    FeaturedGame      Homepage spotlight
    GameActions       A game's buttons, driven by lib/gameAction
    UpdateLog         A game's changelog timeline
    UpdateCard        One changelog entry
    ActivityFeed      Homepage "Recently updated" rows
    EmptyPanel        Empty sections; previews the shape of its own content
    Gallery           Screenshots + lightbox
    SectionHeader     In-page section title block
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
  destination, so middle-click and keyboard behaviour are never faked. States
  with nowhere to go render a marker, never a disabled button.
- **Status branches in one file.** If you find yourself writing
  `status === '…'` in a component, put it in `lib/gameAction.ts` instead.
- **Empty states preview their own content.** A new empty section should add a
  motif to `EmptyPanel`, not a new panel component.
- **No dead tokens.** If nothing in `src/` references a token or utility,
  delete it rather than keeping it around for later.

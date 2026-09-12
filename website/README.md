# NOVA

A small indie game hub. Dark, fast, and data-driven: games and updates are
plain TypeScript files, so adding a title means adding an object — not building
another page.

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
| `githubUrl` | Source-code links appear |
| `artwork` / `banner` | Real art replaces the generated plate (see below) |
| `description`, `body` | Intro text and the About section |
| `features` | The "What's in it" section |
| `controls` | The controls table |
| `screenshots` | The gallery, with a lightbox |
| `featured` | Puts the game in the homepage spotlight |
| `order` | Sorts the library; higher first |

The full list with comments is in [`src/types.ts`](src/types.ts).

### Linking a separately hosted game

Games are hosted wherever they like — NOVA only links to them. RUNOUT, for
example, is its own Vite project in its own repo, deployed to its own Netlify
site; nothing about it lives here.

`src/data/games.ts` opens with the URL constants for that:

```ts
const RUNOUT_PLAY_URL = ''     // paste the live Netlify URL here
const RUNOUT_SOURCE_URL = ''   // paste the public repo URL here
```

The entry derives `status`, `playable` and `playUrl` from the first of those,
so the two can never disagree — NOVA will not claim a game is playable while
pointing at nothing. Filling it in flips the card from "In development" to
"Playable" and every VIEW PROJECT into PLAY NOW, across the library card, the
homepage spotlight and the game page at once.

PLAY NOW is a plain external link (`target="_blank"`, `rel="noreferrer
noopener"`), so the game opens on its own site. Nothing is ever embedded in
NOVA.

### Status drives the primary action

`src/lib/gameAction.ts` is the only place that branches on status. Everything
that shows a button — the card, the homepage spotlight, the game page — asks it
what to render, so they can never disagree:

| Status | Primary action | Goes to |
| --- | --- | --- |
| `playable` | **Play now** | `playUrl` (needs `playable: true` too) |
| `in-development` | **View project** | the game's page |
| `coming-soon` | **Coming soon** | nothing — rendered as a marker, not a button |

On a game's own page the "View project" action is dropped, since it would link
to the page you are already on. Adding a status means editing that one file.

### Artwork

Drop image files in `public/` (e.g. `public/games/my-game/cover.png`) and
reference them by path: `artwork: '/games/my-game/cover.png'`. Set
`artworkAlt` whenever you set artwork.

Without artwork a game gets a generated typographic plate — its title on a
tinted ground, tinted from its slug. It is deliberately abstract rather than a
fake screenshot, so an unillustrated game looks unillustrated, not broken.

### The empty library

`games.ts` ships empty, and that is the designed state rather than a fallback.

Every empty section draws the outline of the content that belongs there:
`EmptyPanel` with `motif="library"` shows cover frames, `motif="log"` shows
changelog rows. "Nothing yet" reads as a shelf awaiting stock rather than a
failed load, and it stays honest — the frames carry no titles, art, dates or
counts, so nothing on the page implies content that does not exist.

Adding the first entry to `games.ts` swaps the motif for the real grid with no
other change.

## Adding an update

[`src/data/updates.ts`](src/data/updates.ts) holds the changelog. Entries sort
themselves newest-first, appear on `/updates`, show the two most recent on the
homepage, and — if `gameSlug` is set — also appear on that game's page.

```ts
{
  id: 'my-game-0-4',
  gameSlug: 'my-game',
  title: 'Update 0.4',
  date: '2026-01-20',
  summary: 'Optional one-liner.',
  changes: [
    { label: 'Added', items: ['...'] },
    { label: 'Fixed', items: ['...'] },
  ],
}
```

Groups with no items are skipped, so there is no way to render an empty
"Fixed" heading.

## Site configuration

[`src/data/site.ts`](src/data/site.ts) holds the name, tagline, GitHub URL and
contact address. The GitHub button and footer contact link hide themselves when
their value is empty.

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

Connect the GitHub repo to Netlify and every push builds and deploys.
Drag-and-drop works too: run `npm run build` and drop `dist/` onto Netlify.

The only thing worth changing before a first deploy is `site.githubUrl` in
`src/data/site.ts`.

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
    updates.ts        The changelog
    site.ts           Name, tagline, links
  lib/
    gameAction.ts     Status -> primary action. The only place status branches
    plural.ts         "0 titles" / "1 title" count labels
    usePageTitle.ts   Per-route <title> and meta description
  components/
    Layout            Shell: skip link, nav, main, footer
    Navbar            Top bar; collapses to a drawer under 760px
    Footer
    Button            One component: <button>, <Link> or <a> by prop
    GameArt           Real artwork, or the generated plate
    GameCard          Library tile
    GameGrid          The responsive grid
    FeaturedGame      Homepage spotlight
    GameActions       A game's buttons, driven by lib/gameAction
    EmptyPanel        Empty sections; previews the shape of its own content
    UpdateCard        One changelog entry
    Gallery           Screenshots + lightbox
    SectionHeader     Every page and section title block
    ArrowLink         The small "see all" link
    StatusBadge       Playable / In development / Coming soon
    icons.tsx         The inline SVGs the site uses
  pages/
    Home, Games, GameDetails, Updates, NotFound
  styles/
    tokens.css        Colours, space, type, motion — the whole design system
    global.css        Reset, layout primitives, focus ring, reduced motion
```

## Conventions worth keeping

- **Never invent game content.** Empty is a designed state; filler is not.
- **Tokens, not values.** New colours and spacing belong in `tokens.css`.
- **One accent.** Amber is for the primary action, the active nav item and the
  focus ring. Everything else is neutral.
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

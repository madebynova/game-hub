# NOVA — Game Hub

**A home for my games.** NOVA is where I build, test and share the browser games
I make. This repository holds the NOVA website and every game on it, each kept
as its own project.

## Games

| Game | What it is | Status |
| --- | --- | --- |
| **RUNOUT** — *Ding Dong* | A solo ding-dong-and-run extraction game. Ring the bell, get seen legging it, lose them, and decide whether to risk one more house before you run for the van. | **Playable** at [runout-game.netlify.app](https://runout-game.netlify.app) · source in [`games/runout`](games/runout) |
| **Tides of Fortune** — *Open Waters* | A pirate trading adventure: sail, trade, take contracts, evade the Navy, build businesses, collect ships and grow your fortune across the open waters. | **In development** — not deployed yet · source in [`games/salt-and-sovereigns`](games/salt-and-sovereigns) |

Tides of Fortune's folder and in-game files still use its earlier name, Salt &
Sovereigns.

## Why this exists

I make games, and I wanted one place for all of them — somewhere a game can be
listed the day it becomes real, playable or not, with an honest record of what
has changed. NOVA is that place. Each game stays a separate project, so it can
be built, tested and deployed without touching the others or the website.

## Technology

- **NOVA website** — React 19, React Router, TypeScript and Vite. Plain CSS with
  design tokens; no UI or CSS framework, no backend.
- **RUNOUT** — TypeScript and Vite, drawn on an HTML5 canvas. The production
  build is a single self-contained `index.html`.
- **Tides of Fortune** — JavaScript, CSS and an HTML5 canvas, with no build step.
- **Hosting** — Netlify, one site per project, each configured by its own
  `netlify.toml`.

## Project structure

```text
game-hub/
├── website/                  NOVA, the hub site
│   ├── src/data/             the game library and every game's changelog
│   ├── src/                  pages, components, styles
│   └── public/games/         cover and banner art for each game
├── games/
│   ├── runout/               RUNOUT
│   └── salt-and-sovereigns/  Tides of Fortune
├── assets/                   shared assets (empty for now)
├── docs/                     documentation (empty for now)
└── LICENSE
```

Games never live inside `website/`. NOVA links out to each game's own
deployment rather than embedding it. See [`website/README.md`](website/README.md)
for how the library, changelogs and artwork are organised.

## Running it locally

NOVA and RUNOUT need [Node.js](https://nodejs.org/) 22 or newer.

**NOVA**

```bash
cd website
npm install
npm run dev
```

**RUNOUT**

```bash
cd games/runout
npm install
npm run dev
```

**Tides of Fortune** has no build step — serve its folder with any static file
server, for example:

```bash
cd games/salt-and-sovereigns
python -m http.server 8000
```

## Deployment

Each project is set up to deploy to Netlify as its own site from this
repository. With the repo connected, every push to `main` rebuilds the site:

| Site | Base directory | Build command | Publish directory |
| --- | --- | --- | --- |
| NOVA | `website` | `npm run build` | `website/dist` |
| RUNOUT | `games/runout` | `npm run build` | `games/runout/dist` |
| Tides of Fortune | `games/salt-and-sovereigns` | *(none)* | `games/salt-and-sovereigns` |

The settings are also declared in each folder's `netlify.toml`, so only the base
directory has to be chosen when importing the repo.

## Status

Early and actively developed. RUNOUT is playable; Tides of Fortune is in early
development and not deployed yet. New games are added to the library as they
are built.

## Organisation rules

- Keep NOVA website files inside `website/`.
- Keep each game's files inside its own folder under `games/`.
- Don't mix files between games, or between a game and the website.
- Use clear, lowercase folder names with hyphens.

## Maintainer

Built and maintained by [madebynova](https://github.com/madebynova).

## License

The code in this repository is released under the [MIT License](LICENSE).

The license covers the source code. It does not automatically extend to game
artwork, audio or other creative assets, or to any third-party material. Where a
game carries its own license file (for example
[`games/salt-and-sovereigns/LICENSE`](games/salt-and-sovereigns/LICENSE)), that
file applies to that game.

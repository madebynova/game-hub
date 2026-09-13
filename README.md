# 🎮 Game Hub

A clean home for browser games, prototypes, experiments, and future projects.

The repository keeps the NOVA website separate from each individual game so projects can be developed, tested, and deployed without mixing their files together.

## 📁 Structure

```text
game-hub/
├── README.md
├── website/
│   ├── src/
│   └── public/
└── games/
    ├── runout/
    └── salt-and-sovereigns/
```

### `website/`
The NOVA game-hub website lives here.

- `src/` — NOVA's React/TypeScript source code.
- `public/` — static website assets.

### `games/`
Each game gets its own folder. If a game has 2 files or 200 files, they stay together inside that game's folder.

- `games/runout/` — the RUNOUT game project (Vite + TypeScript, its own build).
- `games/salt-and-sovereigns/` — the Salt & Sovereigns game project (static HTML/CSS/JS, no build step).

## 🎮 Current Games

- **RUNOUT** — a solo ding-dong-and-run extraction game.
- **Salt & Sovereigns** — a pirate trading adventure: sail, trade, take contracts, evade the Navy, build businesses, and grow your fortune across the open waters.

More games can be added later without mixing their files together.

## 🌐 Deployment

The website and games are kept as separate projects so they can be built and deployed independently with Netlify. NOVA can act as the central hub that links players to each playable game.

## 🧭 Organization Rules

- Keep NOVA website files inside `website/`.
- Keep each game's files inside its own folder under `games/`.
- Do not mix files from different games or the website.
- Keep game-specific assets with that game whenever possible.
- Use clear, lowercase folder names with hyphens.
- Keep the root of the repository clean.
- Update this README when major games or important folders are added.

## 🚧 Status

This is an evolving game collection and development space. The structure can grow as new projects are created.

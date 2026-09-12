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
    └── runout/
```

### `website/`
The NOVA game-hub website lives here.

- `src/` — NOVA's React/TypeScript source code.
- `public/` — static website assets.

### `games/`
Each game gets its own folder. If a game has 2 files or 200 files, they stay together inside that game's folder.

- `games/runout/` — the RUNOUT game project.

## 🎮 Current Games

RUNOUT is the first game being prepared for the hub. More games can be added later without mixing their files together.

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

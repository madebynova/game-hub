# Deep Dive — Phase 1

A browser treasure-diving game about one question: **go back up with what you have, or risk going deeper?**

Built with Vite + TypeScript + Canvas 2D. No backend. Progress is saved in `localStorage`.

## Run it

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # type-check + production build into dist/
npm run preview   # serve the production build at http://localhost:4173
npm test          # unit tests (Vitest)
```

## Controls

| Key | Action |
| --- | --- |
| `W A S D` / arrows | Swim / walk the deck |
| `E` (hold) | Collect treasure, recover a lost satchel |
| `E` | Climb aboard at the boat, open the trading deck |
| `Space` | Dive in from the boat |
| `Esc` | Close the trading deck |
| `M` | Mute |

## The loop

1. **Dive** off the boat. Your oxygen drains while underwater, and **faster the deeper you go**.
2. **Collect treasure.** Rarer items take longer to pry loose. Deeper areas, the shipwreck and the abyssal shrine roll better loot.
3. **Surface anywhere** to breathe. The white marker on the air gauge shows how much air you need to swim straight up.
4. **Return to the boat** to secure your haul, then **sell** it for permanent cash. Treasure in your bag is *at risk* until it's sold.
5. **Run out of air** and you get a few seconds to reach the surface. Miss that and you black out: the crew rescues you, but your haul sinks in a glowing satchel you can dive back to recover.
6. **Upgrade** your Oxygen Tank, Dive Bag and Flashlight, then dive deeper.

## Project structure

```
src/
  config.ts            tuning constants (speeds, oxygen, boat, zones)
  game.ts              game state machine: title → boat → dive → blackout
  core/                input, audio (WebAudio synth), save/load, math helpers
  data/                treasure + upgrade definitions, loot tables
  systems/             pure game logic: haul, economy, oxygen
  entities/            player physics, treasure spawns
  world/               seafloor, rocks, flora, spawn points
  render/              canvas renderer, diver/treasure art, particles
  ui/                  DOM HUD, trading deck (shop), title/blackout overlays
tests/                 Vitest unit tests for systems, data, world and movement
```

## Deploy to Netlify

`netlify.toml` is included (build `npm run build`, publish `dist`). Connect the GitHub repo in Netlify, or drag the `dist/` folder into Netlify Drop.

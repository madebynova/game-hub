# Deep Dive

A browser treasure-diving game about one question: **go back up with what you have, or risk going deeper?**

Built with Vite + TypeScript + Canvas 2D. No backend. Progress is saved in `localStorage`.

- **Phase 1:** the core loop — dive, collect, manage oxygen, sell, upgrade.
- **Phase 2 — The Deep Opens:** three distinct zones, a shipwreck you can explore, hazards, 20 treasures, dive objectives and a longer progression curve.

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

1. **Dive** off the boat. Oxygen drains underwater, and **faster the deeper you go**.
2. **Collect treasure.** Rarer items take longer to pry loose. Heavy finds take two bag slots.
3. **Surface anywhere** to breathe. The white marker on the air gauge shows the air needed to swim straight up.
4. **Return to the boat** to secure your haul and **sell** it. Treasure in your bag is *at risk* until it's sold.
5. **Run out of air** and you get a few seconds to reach the surface. Miss it and you black out: the crew rescues you, but your haul sinks in a glowing satchel you can dive back to recover.
6. **Upgrade** your gear and push into the next zone.

## Zones (Phase 2)

| Zone | Depth | What's different |
| --- | --- | --- |
| **Shallow Reef** | 0–72m | Bright water, coral, kelp and fish. Common salvage, gentle air use (1.0–1.25×). The *Reef Rip* current at the reef edge pulls you toward deeper water. |
| **The Wreck** | 72–131m | A greener, murkier wreck field around a sunken ship you can swim inside. Tight gaps (a stern window, deck hatch, ladder hole and a crawlspace under a bulkhead), two sections of **collapsing wreckage**, a **trapped air pocket** in the captain's cabin, and the *Wreck Crosscurrent* over the deck. Air use 1.25–1.7×, flashlight reach −12%, darker still inside the hull. |
| **The Abyss** | 131–250m | Nearly black, lit only by glowing plants and plankton. Crushing pressure (1.7–3.0× air use), flashlight reach −30%, pressure groans and a closing violet vignette. The *Abyssal Pull* downdraft makes descending fast and climbing out slow. A **hydrothermal vent** near the bottom gives back a little air, and the ruined **shrine** at the very bottom holds the best loot in the game. |

Entering a zone shows a banner (bigger the first time), and the HUD shows the zone name, air use, a depth gauge with zone bands and your deepest dive, plus chips when you're in a current or an air pocket.

## Treasure (Phase 2)

20 treasures across five rarity tiers. Values are fixed per treasure with ±15% variation, so every tier is recognisable. Lit treasure of uncommon rarity and above shows its name before you pick it up.

| Rarity | Treasures | Base value |
| --- | --- | --- |
| Common | Tarnished Coins, Message Bottle, Brass Tools, Gold Doubloon | $14–32 |
| Uncommon | Clay Amphora *(heavy)*, Brass Compass, Silver Candlestick, Gold Signet Ring, Ship's Bell *(heavy)* | $75–170 |
| Rare | Sapphire Brooch, Pearl Necklace, Uncut Emerald, Jeweled Chalice, Bronze Astrolabe, Marble Bust *(heavy)* | $185–460 |
| Very Rare | Jade Idol, Abyssal Mask, Drowned Crown | $620–950 |
| Legendary | Heart of the Deep, Leviathan Pearl | $1,800–2,600 |

Each area rolls from its own loot table: shallows → reef edge → wreck field → wreck interior → abyss → shrine, and each step is worth noticeably more per bag slot. Collected spots restock with a fresh roll on your next dive; uncollected treasure stays where it is.

**Discovery moments:** rare and better finds freeze the action for a beat, burst with light (visible even in the abyss), shake the camera, play a rarity-specific sting and show a card with the item, rarity and value. The first find of each treasure type is marked **New find** and added to your **treasure log** (shown on the trading deck).

## Hazards (Phase 2)

No enemies or combat — the danger is still oxygen, navigation and depth.

- **Currents** push you along their flow (visible as streaks). Power Fins cancel part of the push.
- **Collapsing wreckage** groans and drops dust for 1.3 seconds when you swim under it, then falls. If you're still underneath you lose air (10 + 8% of your tank) and get knocked down. Each section falls once per dive.
- **Narrow passages** inside the wreck take careful steering, and every second costs air.
- **Darkness and pressure** get worse with depth: less flashlight reach, faster air use.
- **Air pockets** are a reward for exploring: stay inside to refill up to a fixed amount per dive.

## Dive objectives (Phase 2)

Three optional objectives are always active (top-left of the HUD, and on the trading deck). They complete underwater but **only pay out when you climb back aboard** — black out and the progress is lost. Completed objectives are replaced with new ones matched to how far you've explored:

- **Reef tier** (until you reach the wreck): collect 3 treasures, reach 40m, find an uncommon treasure, bring back a $150 haul, recover a Message Bottle, explore the Wreck — $30–120.
- **Wreck tier**: collect 6, reach 110m, find a rare, get inside the wreck, bring back $900, recover a Ship's Bell, explore the Abyss — $120–300.
- **Abyss tier**: collect 10, reach 200m, find a very rare, reach the shrine, bring back $3,000, recover a Drowned Crown or Abyssal Mask — $350–650.

Rewards are a bonus of roughly 10–20% on top of a good haul, not a replacement for it.

## Progression (Phase 2)

The stats of the original gear's levels 0–3 are unchanged, so a Phase 1 save keeps exactly the gear it paid for. Early upgrade prices were raised slightly for new players, since Phase 1 could be maxed in a handful of dives. Phase 2 adds two **deep-rated** tiers and a new piece of gear, priced against wreck and abyss income rather than reef income:

| Gear | Stats by level | Upgrade costs |
| --- | --- | --- |
| Oxygen Tank | 60 → 85 → 115 → 150 → **190 → 240**s air | $200, $550, $1,300, **$4,800, $10,500** |
| Dive Bag | 5 → 8 → 12 → 16 → **20 → 24** slots | $150, $450, $1,100, **$3,900, $8,500** |
| Flashlight | 11 → 16 → 22 → 29 → **35 → 43**m beam | $120, $400, $1,000, **$3,600, $8,000** |
| **Power Fins** *(new)* | +0 → +8 → +16 → +25% speed; resist 0 → 20 → 35 → 50% of currents | $350, $1,400, $3,800 |

Maxing everything costs about $50,000 — more than 10× Phase 1's $4,420. The zones are what make the gear matter:

- A starting tank can explore the reef and the outside of the wreck, but can't make the round trip to the shrine at all.
- Maxed Phase 1 air (150s) *can* reach the shrine, but the round trip alone uses about half the tank, leaving a short, tense window at the bottom.
- A bigger bag matters more once the loot is valuable and heavy.
- The wreck interior is dark and the abyss swallows light, so the flashlight decides how much you can actually see.

## Saves

Saves live under `deepdive.save.v1` in `localStorage`. Phase 1 saves load without losing anything: cash, upgrades, stats, hints and any lost satchel are kept, and new fields (fins, objectives, zones visited, treasure log) start fresh. A Phase 1 satchel that would now be buried inside the new terrain is moved to the nearest open water above it.

## Project structure

```
src/
  config.ts            tuning constants (speeds, pressure curve, boat)
  game.ts              game state machine: title → boat → dive → blackout
  core/                input, audio (WebAudio synth), save/load + migration, math helpers
  data/                treasures + loot tables, upgrades, objective pool
  systems/             pure game logic: haul (slots), economy, oxygen/pressure,
                       hazards (currents, collapses, air pockets), objectives, progression log
  entities/            player physics (terrain, rocks, wreck walls, currents), treasure spawns
  world/               seafloor layout, zones, wreck geometry, spawn points
  render/              renderer (camera, lighting), scenery, wreck, hazards, zone ambience,
                       diver/treasure art, particles and discovery bursts
  ui/                  HUD (objectives, depth gauge), trading deck, zone banner + discovery card, overlays
tests/                 Vitest: systems, data & balance, save compatibility, world reachability,
                       hazards, objectives, progression
```

The world test flood-fills every position the diver can reach from the boat and checks that every treasure, air pocket and collapse zone is reachable, including everything inside the wreck.

## Deploy to Netlify

`netlify.toml` is included (build `npm run build`, publish `dist`). Connect the GitHub repo in Netlify (base directory `games/deep-dive`), or drag the `dist/` folder into Netlify Drop.

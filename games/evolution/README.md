# EVOLUTION — Phase 1: The Cradle

*Start as something small. Wander. Become something the wandering made.*

You are a hatchling in a single lush biome called **the Cradle**. You cannot
swim, you cannot jump, and there are things growing here your jaws will not
open. Everything you do — wading, walking new ground, pulling food out of the
world — develops a different part of you, and each part you develop takes one of
those sentences away.

This is the first playable slice of a larger creature-progression game. It is
deliberately one biome, three adaptations and nineteen discoveries: enough to
prove the loop is worth building on, and no filler.

## The loop

Explore → find something → interact with it → the interaction feeds an
adaptation → the adaptation unlocks a capability → the capability opens ground
you could not reach → that ground holds things you have not discovered.

## The three adaptations

Each one is a change to a rule about the world, not a percentage on a stat.

| Track | Adaptation | Develops through | What changes |
| --- | --- | --- | --- |
| **Aquatic** | **Tidelung** | Wading, swimming, picking Dewbeads | Deep water stops turning you back. You can cross the Lumen Pool to **Mirror Isle** and gather the Glimmer Pearls on its floor. |
| **Mobility** | **Springcoil** | Covering ground you have not walked before | <kbd>Space</kbd> becomes a long bound. You can clear the **Windfall Gap** onto the **Sunstone Shelf**, and you move faster everywhere. |
| **Gathering** | **Rendmaw** | Harvesting plants and resources | Your jaws split into mandibles. You can crack **Ironcaps** off the stone and tear through the Bramblethorn wall into **Thornhollow**. |

Each track needs 100 points. Progress comes from playing the way that track is
about, so the creature grows into how it has actually been used.

### The gauntlet

**The Cradle Heart** sits behind deep water, a cliff and a wall of thorn, in
that order. It cannot be reached without all three adaptations. Reaching it is
the end of Phase 1.

## The Cradle

- **The Hollow** — the sunlit clearing you wake in, ringed by boulders
- **The Elderbough** — the oldest tree here, wide enough to shade half the Hollow
- **The Lumen Pool** — pale shallows around a dark, deep middle
- **Mirror Isle** — an island in the pool with a black standing stone
- **The Windfall Gap** — a split in the northern cliff, with cold air rising
- **Sunstone Shelf** — the stony terrace above the cliff
- **Thornhollow** — a shaded grove sealed behind brambles
- **The Cradle Heart** — a pale shore behind all three locks

Five resources (Sporecap, Dewbead, Glimmer Pearl, Ironcap, Amberdrop), three
animals that live their own lives (Flits, Pond Skimmers, Hollow Burrowers), and
nineteen journal entries, all of them real things you can actually find.

## Controls

| Key | Action |
| --- | --- |
| <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrows | Move |
| <kbd>E</kbd> | Interact — hold to harvest |
| <kbd>Space</kbd> | Leap (once Springcoil is developed) |
| <kbd>J</kbd> | Discovery Journal |
| <kbd>C</kbd> | Your creature and its adaptations |
| <kbd>Esc</kbd> | Menu |

## Saving

One save slot in `localStorage`, under `evolution.cradle.v1`. It is written
automatically on every unlock, discovery and harvest, on a timer while you play,
and when you leave the page. It keeps adaptation progress, unlocked adaptations,
discoveries, biomass, position, ground you have explored, which nodes are
harvested and which brambles you have torn.

The creature belongs to the browser it was grown in — there is no account and no
backend. Choosing **New creature** discards it.

## Running it

No build step and no dependencies. Open `index.html`, or serve the folder:

```bash
python -m http.server 8000
```

Deployment is by `netlify.toml`: import the repo, set the base directory to
`games/evolution`, and the file supplies the rest.

## How it is built

Plain JavaScript, HTML and CSS drawn on a 2D canvas. Everything is loaded with
ordinary `<script>` tags rather than ES modules, so the game runs from `file://`
as well as from a server. All audio is synthesised at runtime with WebAudio and
all art is drawn from paths, so there are no binary assets to load or host.

```
index.html
styles/main.css
src/
  core/      util, input, camera, audio
  world/     world layout, baked terrain, ambient critters, renderer
  entities/  the creature
  systems/   adaptations, discovery, player, interaction, save
  ui/        effects, HUD, panels
  main.js
```

A few things worth knowing before changing them:

- **The water is the gate.** `World.depthAt` is a union of circles with islands
  carved back out, and the renderer bakes the deep region from those same
  circles — so the dark water a player can see is exactly the water they cannot
  enter. If you move a circle, check the spacing: where two circles overlap, the
  midpoint between them is the shallowest part of the run, and if it rises above
  `SHALLOW_MAX` the barrier quietly springs a leak.
- **The leap cannot cross water.** Deep water stops a leap the same way it stops
  a step. Without that rule, Springcoil alone opens Mirror Isle and the Cradle
  Heart, and Tidelung has nothing left to be for.
- **The Sable Channel is above the cliff on purpose.** It is only reachable from
  the Sunstone Shelf, which is what makes the Cradle Heart need all three
  adaptations rather than two.
- **Bramble walls must overlap.** Neighbouring clumps are spaced well inside the
  sum of their solid radii, jitter included. A seam wide enough for the creature
  makes the whole gate pointless.

## Phase 1 scope

Deliberately absent: other biomes, a full evolution tree, combat, crafting,
quests, multiplayer, procedural generation. Phase 1 is one place, done properly.

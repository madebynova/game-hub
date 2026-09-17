# UNTITLED GARAGE — Phase 1 (beta)

A browser exploration/mystery game set in a Rick and Morty-flavoured multiverse.

You wake up on the floor of a garage that is not yours. The last thing you
remember is walking home on the Citadel and somebody putting a syringe in your
neck. There is a green portal in the corner. Nobody tells you what to do.

**Phase 1 is a prototype.** The story, mechanics, UI, dimensions and art are all
provisional and are meant to be replaced or expanded in later phases.

---

## Running it

No build step, no dependencies, no install. It is plain HTML + CSS + ES modules.

- **Deployed:** open the link and play.
- **Locally:** ES modules need a web server (opening `index.html` from the file
  system will fail on CORS). Any static server works:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Deploying to Netlify

Import the `game-hub` repo as a new Netlify site and set the **base directory**
to `games/rick-and-morty`. `netlify.toml` supplies the rest (no build command,
publish the folder as-is, SPA fallback, no-cache headers on the modules so
players are not stranded on an old build).

## Controls

| Input | Action |
| --- | --- |
| `W A S D` / arrows | walk |
| `Shift` | walk faster |
| `E` / `Space` | interact with the highlighted thing |
| Mouse click | interact with the thing you clicked |
| `I` | pockets |
| `J` | journal (clues, grouped into threads) |
| `H` | help, stats, volume, erase save |
| `Esc` | close a panel |

## The Phase 1 loop

Garage → portal → The Glass Flats → find things → carry them home → research
them → the research unlocks the memory rig → recover the first memory fragment →
notice that someone has been in the garage while you were out.

There is no quest log and no objective marker. Poking at things is the game.

---

## Architecture

Everything is deliberately split so later phases add content rather than rewrite
systems. Nothing in `data/` imports a system; content receives an `api` bundle.

```
index.html              markup + DOM overlay
styles/main.css         all UI chrome
src/
  main.js               constructs systems, owns the frame loop and boot flow
  core/
    events.js           pub/sub bus — how systems talk without importing each other
    state.js            the single state object (this IS the save file)
    input.js            intent-level input (moveVector, pressed('interact'))
    loop.js             fixed 960x540 logical canvas, letterboxed, rAF loop
    rng.js              seeded RNG — groundwork for procedural/repeatable content
    util.js             small shared helpers
  systems/
    save.js             versioned localStorage + forward migration
    audio.js            Web Audio synthesis; id-addressed sfx + ambience beds
    inventory.js        itemId -> count
    research.js         timed analysis jobs driven entirely by data
    memory.js           MEMORY RECOVERY % and the fragment collection
    portal.js           the travel sequence
    story.js            declarative story "beats" (condition + scripted moment)
  world/
    world.js            current area, player, camera, interaction query
    area.js             area model, collision resolution
    render.js           layered renderer, cached static backgrounds, depth sort
    player.js           movement + walk animation
    draw.js             palette + shared canvas primitives (incl. the portal)
    props.js            reusable prop factories: pickup(), examine(), scenery()
  ui/
    ui.js               all DOM overlays: hints, toasts, narration, panels
    panels.js           each screen's builder function
    playback.js         the full-screen memory fragment playback
    fx.js               fades, flashes, glitches
  data/                 ← content lives here; this is what Phase 2 grows
    dimensions.js       the dimension registry the portal reads
    items.js            item catalogue
    research.js         research entries (requirements + report + rewards)
    memories.js         memory fragments (incl. their own canvas painters)
    clues.js            story clues, grouped into threads
    areas/garage.js     the home base
    areas/glassflats.js the first dimension
```

### Adding things in a later phase

- **A dimension:** write `data/areas/<name>.js` exporting a builder, add one
  entry to `data/dimensions.js`. Nothing else changes. (Two locked destinations
  are already listed there as examples.)
- **An item:** one entry in `data/items.js`; place it with `pickup()`.
- **Research:** one entry in `data/research.js`. It can require flags, prior
  research or garage upgrades, and can reward clues, flags, dimensions and
  memory fragments.
- **A memory fragment:** one entry in `data/memories.js`, including its own
  `paint()`. Gating is declared on the fragment.
- **A story moment:** one beat in `systems/story.js` — a condition and a
  function. Beats fire once and the fact that they fired is saved.
- **A sound:** add an entry to `SFX` in `systems/audio.js`, or call
  `audio.registerSample(id, url)` and a real audio file takes over that id with
  no call-site changes.

### Saves

One versioned object in `localStorage` under `untitled-garage:save:v1`. Loading
merges the stored save over a fresh default, so fields added later appear
automatically with sane values; breaking changes get a numbered migration in
`systems/save.js`. If storage is unavailable (locked-down school profile,
private window) the game says so and runs without persistence instead of
crashing.

### Performance

Aimed at low-powered school Chromebooks:

- fixed 960x540 logical canvas, scaled by CSS — the GPU does the scaling
- each area's static background is baked once into an offscreen canvas
- off-screen props are culled; glow gradients are used sparingly
- no images, no fonts, no libraries, no build output — the whole game is ~290 KB
  of source and downloads in one go

Measured render cost on a desktop: ~0.2 ms/frame. There is a lot of headroom.

### Audio

All sound is synthesised at runtime with the Web Audio API (no asset files).
It starts on the first click, because browsers require a user gesture. Real
recorded audio can replace any sound later via `registerSample()`.

## Known limitations (Phase 1)

- One dimension, one memory fragment, eight items, seven research entries.
- The workbench, the sealed hatch, the house door and the tarped machine are
  interactable but intentionally have no mechanics yet.
- No gamepad or touch controls; keyboard and mouse only.
- Research progresses only while the tab is open and running.
- The portal's locked destinations are placeholders and cannot be unlocked yet.

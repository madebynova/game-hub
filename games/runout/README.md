# RUNOUT — DING DONG

A solo ding-dong-and-run extraction game. Ring the bell, get seen legging it,
lose them, and decide whether to risk one more house before you run for the van.

```
VAN → NEIGHBOURHOOD → HOUSE → RING → RUN → REACT → ESCAPE → ONE MORE? → VAN → CASH → UPGRADES → AGAIN
```

Vite + TypeScript for development; the production build is a single
self-contained `index.html` that runs anywhere a browser does.

## Playing it

Open the game URL in a modern browser. That's the whole requirement — no Node,
no npm, no PowerShell, no dev server, no source code.

| Key | Does |
| --- | --- |
| `WASD` / arrows | Move |
| `Shift` | Sprint (burns stamina — this is your escape button) |
| `E` | Ring the doorbell / extract at the van |
| `Q` | Throw a firecracker (once you own some) |
| `M` | Mute |

### How a run works

1. **You start at the van.** It is the only safe place and the only way to cash out.
2. **Walk up to a door.** Each house is graded EASY / ALERT / RISKY / VALUABLE —
   better payouts answer the door faster and send worse things after you.
3. **Press E.** DING DONG. A timer starts.
4. **Run.** But not too far: if nobody sees you leg it, there is no clip and no
   payout — only the Heat. Getting seen is the job.
5. **Lose them.** A house pays out the moment everyone it sent gives up. If one
   of them got close, that is a CLOSE CALL and pays 50% more.
6. **Watch the Heat.** Every bell raises it, and **half of every bell's Heat is
   permanent for the rest of the night** — the pale section of the Heat bar is
   the floor it can never fall below again. Higher Heat means doors open faster,
   more people come out of each one, patrols walk the street, events come
   quicker, and the neighbourhood turns its lights on.
7. **Decide.** Your stash is only yours once you are in the van. Get caught and
   every clip you are carrying is gone. Extracting is always available — you just
   have to lose your tail first.

Cash is permanent, upgrades are permanent, and a bust only costs the stash you
were carrying. So the pressure is always "one more house", never "start over".

### Reading a house before you ring it

The colour-coded tier tells you the payout. The house itself tells you the rest:

- **A lit porch** means somebody in there is already awake — that door opens sooner.
- **A floodlit front garden** is a VALUABLE house. You cannot approach one in the
  dark, so the escape has to be planned before you press the bell.
- **A kennel in the garden** is a RISKY house. The dog is outside already; it
  does not have to come through a door, it only has to wake up.

Once you ring, the shrinking ring around the door is your fuse. When it turns
red the latch is already going.

### The garage

Upgrades are permanent, and each one is a different way through a night rather
than a bigger number:

| Upgrade | What it changes |
| --- | --- |
| **HOPPERS** | Vault hedges. Nobody chasing you can, so the gardens become your route — at the cost of stamina for every hop. |
| **SECOND WIND** | Run the tank dry once per chase and get a chunk straight back, so you can commit to a long escape. |
| **NINJA SOCKS** | Quieter feet and almost no scent, so searchers can't hear you and dogs have nothing to follow. Also the lowest-Heat way to play. |
| **DRAINPIPE STASH** | Post clips as you run and keep some of your stash when busted. Buys you the nerve to push further. |
| **SCOUT APP** | Read the whole street, then see everyone's sight range, then see chasers through walls. |
| **FIRECRACKERS** | The answer to private security and patrols, whose patience you cannot outlast. A few per run — spend them on the big doors. |

### Things that matter that the game doesn't spell out

- **The dark is cover** — until it isn't. Outside the lamplight people see you at
  roughly half the range, but once Heat is high enough the whole street has its
  lights on and that cover is gone. That is what CRITICAL really costs you.
- **Different chasers need different escapes.** Homeowners run straight at you,
  so break their line of sight. Security aims at where you are *going*, so run
  straight and they will cut you off. Dogs follow your trail rather than their
  eyes — hiding does nothing, and the only answers are distance, a firecracker,
  or outlasting them.
- **Sprinting is loud.** Someone searching for you can hear it from a fair way
  off. Breaking line of sight and *then* going quiet is the real escape; sprinting
  past a searcher hands them your position. NINJA SOCKS make you quieter.
- **A dog will always catch up at first, then run out of breath.** Keep sprinting
  and the gap closes, then reverses. Stopping, or running dry, is what gets you bitten.
- **Sprinting is also a resource.** A full tank is about five and a half seconds —
  roughly long enough to outlast a dog, and not much more.
- **Hedges break line of sight.** Every hedge divider has exactly one gap in it.
- **Rain is a gift.** It cuts everyone's sight range for half a minute. Go then.

## Developing it

```bash
npm install
npm run dev
```

Opens `http://localhost:5173` with hot reload. A dev server is required here
(ES modules over `file://` are blocked by the browser); this applies to
development only.

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Typecheck, then build to `dist/` as one self-contained file |
| `npm run preview` | Serve the built `dist/` locally to sanity-check it |
| `npm run typecheck` | Types only, no build |
| `npm run build:multi` | Normal Vite build (separate JS/CSS/asset files) |

## Deploying to Netlify

`netlify.toml` already declares everything Netlify needs, so there is nothing to
configure in its UI:

- build command: `npm run build`
- publish directory: `dist`
- served entry point: `dist/index.html`

Connect the GitHub repo to Netlify and every push builds and deploys:

```
Claude Code → GitHub → Netlify → game URL → Chrome → play
```

Drag-and-drop deploys work too: run `npm run build` and drop the `dist` folder
onto Netlify.

## Why the build is a single file

`npm run build` inlines all JS and CSS into `dist/index.html`, emitted as a
classic script rather than an ES module. Two consequences worth knowing:

1. **Netlify serves one file.** No asset requests, nothing to misconfigure.
2. **`dist/index.html` also plays by double-clicking it,** or from a USB stick,
   or anywhere offline — useful on a locked-down school computer with no network
   access to the deployed site.

All sound is synthesised with WebAudio at runtime, so there are no audio files to
load and the whole game stays well under 100 KB.

The tradeoff: every asset is embedded, so the file grows with any art you add. If
that ever becomes a problem, switch to `npm run build:multi` (and point
`netlify.toml`'s build command at it). Netlify is happy either way; only the
double-click-to-play property is lost.

## Layout

```
index.html          Dev entry point; Vite builds it into dist/index.html
netlify.toml        Netlify build + publish config
vite.config.ts      Build config, including the single-file inliner
src/
  main.ts           Bootstrap: wire stage + input + game into the loop
  engine/           Game-agnostic: loop, input, canvas, camera, maths, audio
  game/
    config.ts       Every tuning number in the game
    world.ts        Neighbourhood generation (lots, houses, hedges, lamps)
    run.ts          One night: ringing, Heat, chases, payouts, extraction
    chasers.ts      Reaction AI — chase, search, give up, get lured
    events.ts       Neighbourhood events (cars, dogs, patrols, rain, packages)
    player.ts       Movement, sprint, stamina
    render.ts       Drawing the street, plus the night lighting pass
    hud.ts          In-run overlay
    screens.ts      Title, run summary, garage
    upgrades.ts     Permanent upgrades and the loadout they build
    save.ts         localStorage persistence
    game.ts         Top-level state machine tying the meta loop together
```

### Tuning it

`src/game/config.ts` holds every number that decides how the game feels — player
speed, how long each tier of house takes to answer, what comes out of the door,
how fast Heat builds and what it does. Nothing else hardcodes balance, so it can
be retuned without touching a system.

### A note on input

RUNOUT is a keyboard game. There are no touch controls, so it needs a real
keyboard — fine for a laptop or a school desktop, not playable on a phone.

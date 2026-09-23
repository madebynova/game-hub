# PORTAL HOP

A 2D side-view browser game. Walk out of a small garage/lab through a
hand-animated dimensional portal embedded in the wall, into a placeholder
"other side," and back again through a return portal.

Built with Vite + vanilla JS, rendered on an HTML5 canvas (no WebGL/3D
library). No backend, no save data.

This is an early foundation: garage, portal, movement, and the
enter/return portal loop. No dimensions, collectibles, progression, or
UI beyond the start screen yet.

## Run it

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production build into dist/
npm run preview   # serve the production build locally
```

## Controls

| Key | Action |
| --- | --- |
| `A` / `D` or arrow keys | Walk left / right |
| `W`, `Space`, or `↑` | Jump |
| `Esc` | Pause |

Mouse is only used to click "Click to enter the garage" — it never
controls the player.

## Structure

```
src/
  core/       input handling, camera
  entities/   the player
  world/      the garage, the portal, the temporary destination zone
  systems/    collision, zone switching, the portal transition effect, sound
```

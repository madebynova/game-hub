import './style.css';
import { GameLoop } from './engine/loop';
import { Input } from './engine/input';
import { Stage } from './engine/stage';
import { Game } from './game/game';

const canvas = document.querySelector<HTMLCanvasElement>('#stage');
if (!canvas) throw new Error('Missing #stage canvas.');

const stage = new Stage(canvas);
stage.watch();

const input = new Input();
input.attach(canvas);

// Focusable so keyboard input keeps landing after a click on browser chrome.
canvas.tabIndex = 0;
canvas.focus();

const game = new Game(stage, input);

const loop = new GameLoop(
  (step) => {
    game.update(step);
    input.endFrame();
  },
  () => game.render(),
);

// Don't burn CPU (or pile up simulation time) while the tab is hidden.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    loop.stop();
    input.clear();
  } else {
    loop.start();
  }
});

loop.start();

if (import.meta.env.DEV) {
  // Dev-only handle so the game can be stepped and inspected without rAF — some
  // embedded preview panes report the document as hidden and never tick.
  // Vite drops this whole branch from the production build.
  (window as unknown as Record<string, unknown>).__runout = {
    game,
    stage,
    input,
    loop,
    /** Advance the simulation `times` fixed steps, then draw one frame. */
    step(times = 1): void {
      for (let i = 0; i < times; i++) {
        game.update(1 / 60);
        input.endFrame();
      }
      game.render();
    },
  };
}

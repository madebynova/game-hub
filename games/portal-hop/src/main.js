import "./style.css";
import { Input } from "./core/Input.js";
import { Camera2D } from "./core/Camera2D.js";
import { Player } from "./entities/Player.js";
import { createGarageZone } from "./world/GarageZone2D.js";
import { createTestZone } from "./world/TestZone2D.js";
import { ZoneManager } from "./systems/ZoneManager.js";
import { TransitionEffect } from "./systems/TransitionEffect.js";
import { unlockAudio, playPortalWhoosh } from "./systems/AudioFX.js";

const canvas = document.getElementById("scene-canvas");
const ctx = canvas.getContext("2d");
const blocker = document.getElementById("blocker");
const hud = document.getElementById("hud");
const transitionOverlay = document.getElementById("transition-overlay");

// --- Canvas sizing -----------------------------------------------------------
let dpr = 1;
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
}
resize();
window.addEventListener("resize", resize);

// --- Input, camera, player -----------------------------------------------------
// Input only ever reads the keyboard — the mouse is reserved for
// menus/buttons/UI later and never touches movement.
const input = new Input();
const camera = new Camera2D({ pixelsPerUnit: 56 });
const player = new Player();

// --- Zones ---------------------------------------------------------------------
// The garage is the real starting area; the test zone is a throwaway
// stand-in for wherever the portal will actually lead once the first
// dimension is built. Swapping which one is "active" is all ZoneManager
// does — nothing else needs to know a swap happened.
const zoneManager = new ZoneManager();
const garage = createGarageZone();
const testZone = createTestZone();
zoneManager.register("garage", garage);
zoneManager.register("test", testZone);
zoneManager.activate("garage");

player.teleportTo(garage.spawn);
player.facingDir = garage.spawnFacing;

// --- Start / pause -------------------------------------------------------------
let gameActive = false;
function engage() {
  if (gameActive) return;
  gameActive = true;
  blocker.classList.add("hidden");
  hud.classList.add("visible");
  unlockAudio();
}
blocker.addEventListener("click", engage);

document.addEventListener("keydown", (event) => {
  if (event.code === "Escape" && gameActive) {
    gameActive = false;
    blocker.classList.remove("hidden");
    hud.classList.remove("visible");
  }
});

// --- Portal transition --------------------------------------------------------
const transition = new TransitionEffect(transitionOverlay);
let isTransitioning = false;

async function enterPortal() {
  if (isTransitioning) return;
  isTransitioning = true;
  playPortalWhoosh();

  await transition.play(() => {
    zoneManager.activate("test");
    player.teleportTo(testZone.spawn);
    player.facingDir = testZone.spawnFacing;
  });

  isTransitioning = false;
}

async function returnToGarage() {
  if (isTransitioning) return;
  isTransitioning = true;
  playPortalWhoosh();

  await transition.play(() => {
    zoneManager.activate("garage");
    player.teleportTo(garage.spawn);
    player.facingDir = garage.spawnFacing;
  });

  isTransitioning = false;
}

// --- Main loop ---------------------------------------------------------------
let lastTime = performance.now();

function animate(now) {
  requestAnimationFrame(animate);
  const delta = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  const zone = zoneManager.active;
  const canAct = gameActive && !isTransitioning;

  if (canAct) {
    player.update(delta, input, zone);
  }
  input.endFrame();

  zone.update(delta);

  if (canAct) {
    if (zoneManager.activeKey === "garage" && garage.isPlayerEnteringPortal(player.position, player.halfWidth)) {
      enterPortal();
    } else if (zoneManager.activeKey === "test" && testZone.isPlayerEnteringPortal(player.position, player.halfWidth)) {
      returnToGarage();
    }
  }

  // clear (identity transform first — canvas.width/height are device pixels)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  camera.update(player.position, zone.bounds, window.innerWidth, window.innerHeight);
  camera.applyTransform(ctx, canvas.width, canvas.height, dpr);

  zone.draw(ctx);
  zone.portal.draw(ctx);
  player.draw(ctx);
}

requestAnimationFrame(animate);

// Dev-only inspection hook (stripped from production builds) so the
// scene can be poked at from the console while iterating.
if (import.meta.env.DEV) {
  window.__portalHopDebug = { canvas, ctx, camera, player, zoneManager, garage, testZone, input };
}

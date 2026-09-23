import { createPortal2D } from "./Portal2D.js";

// A deliberately bare, easy-to-spot "you made it" space. This entire
// zone is a placeholder standing in for wherever the portal will
// actually lead once a real first dimension is built — same side-view
// physics as the garage, just a different look and a portal back home.
export const TEST_ZONE_BOUNDS = { minX: -6, maxX: 6, minY: -2.5, maxY: 2.5 };

const WALL_THICKNESS = 0.3;
const PORTAL_RADIUS = 1.1;
const PORTAL_ASPECT = { x: 0.8, y: 1.25 };
const PORTAL_GAP_HALF_HEIGHT = PORTAL_RADIUS * PORTAL_ASPECT.y * 1.3;
const PORTAL_TRIGGER_HALF_HEIGHT = PORTAL_RADIUS * PORTAL_ASPECT.y * 0.7;

export function createTestZone() {
  const bounds = TEST_ZONE_BOUNDS;
  const floorY = bounds.maxY;

  // Return portal on the left wall this time, just so the two zones
  // don't feel like mirror images of each other.
  const portalPosition = { x: bounds.minX, y: floorY - PORTAL_RADIUS * PORTAL_ASPECT.y };
  const portal = createPortal2D({
    position: portalPosition,
    normal: { x: 1, y: 0 }, // points right, into the room
    radius: PORTAL_RADIUS,
    aspect: PORTAL_ASPECT,
  });

  const colliders = []; // bare platform, nothing to bump into

  const spawn = { x: bounds.maxX - 2, y: floorY - 0.55 };
  const spawnFacing = -1; // facing left, toward the return portal

  function clampToBounds(x, y, halfW, halfH) {
    const minXBound = bounds.minX + halfW;
    const maxXBound = bounds.maxX - halfW;
    const floorBound = bounds.maxY - halfH;
    const ceilBound = bounds.minY + halfH;

    let cx = x;
    let cy = y;
    let hitWall = false;
    let hitFloor = false;
    let hitCeiling = false;

    if (x < minXBound) {
      cx = minXBound;
      hitWall = true;
    } else if (x > maxXBound) {
      cx = maxXBound;
      hitWall = true;
    }

    if (y > floorBound) {
      cy = floorBound;
      hitFloor = true;
    } else if (y < ceilBound) {
      cy = ceilBound;
      hitCeiling = true;
    }

    return { x: cx, y: cy, hitWall, hitFloor, hitCeiling };
  }

  function isPlayerEnteringPortal(position, halfW) {
    const atWall = position.x - halfW <= bounds.minX + 0.02;
    const withinHeight = Math.abs(position.y - portalPosition.y) < PORTAL_TRIGGER_HALF_HEIGHT;
    return atWall && withinHeight;
  }

  function drawBackground(ctx) {
    // A simple, distinct backdrop so this obviously isn't the garage —
    // a flat two-tone sky, nothing fancy.
    const sky = ctx.createLinearGradient(0, bounds.minY - 2, 0, bounds.maxY);
    sky.addColorStop(0, "#241a33");
    sky.addColorStop(1, "#40325a");
    ctx.fillStyle = sky;
    ctx.fillRect(bounds.minX - 4, bounds.minY - 4, bounds.maxX - bounds.minX + 8, bounds.maxY - bounds.minY + 8);
  }

  function drawFloor(ctx) {
    ctx.fillStyle = "#584a72";
    ctx.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
    ctx.fillStyle = "#4a3d63";
    ctx.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, 0.12);
  }

  function drawWalls(ctx) {
    ctx.fillStyle = "#3a2f4f";

    // Ceiling
    ctx.fillRect(bounds.minX - WALL_THICKNESS, bounds.minY - WALL_THICKNESS, bounds.maxX - bounds.minX + WALL_THICKNESS * 2, WALL_THICKNESS);
    // Right wall
    ctx.fillRect(bounds.maxX, bounds.minY, WALL_THICKNESS, bounds.maxY - bounds.minY);

    // Left wall, split around the return portal's opening.
    const gapMin = portalPosition.y - PORTAL_GAP_HALF_HEIGHT;
    const gapMax = portalPosition.y + PORTAL_GAP_HALF_HEIGHT;
    ctx.fillRect(bounds.minX - WALL_THICKNESS, bounds.minY, WALL_THICKNESS, gapMin - bounds.minY);
    ctx.fillRect(bounds.minX - WALL_THICKNESS, gapMax, WALL_THICKNESS, bounds.maxY - gapMax);
  }

  function draw(ctx) {
    drawBackground(ctx);
    drawFloor(ctx);
    drawWalls(ctx);
  }

  function update(delta) {
    portal.update(delta);
  }

  return {
    bounds,
    colliders,
    spawn,
    spawnFacing,
    portal,
    clampToBounds,
    isPlayerEnteringPortal,
    draw,
    update,
  };
}

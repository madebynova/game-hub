import { createPortal2D } from "./Portal2D.js";

// Side-view room: x is left/right, y is up/down (canvas convention —
// larger y is lower on screen). minY is the ceiling, maxY is the floor.
export const GARAGE_BOUNDS = { minX: -7, maxX: 7, minY: -2.5, maxY: 2.5 };

const WALL_THICKNESS = 0.3;
const PORTAL_RADIUS = 1.1;
const PORTAL_ASPECT = { x: 0.8, y: 1.25 }; // taller than wide — a tear you could eventually walk into
// Visual gap left in the wall drawing so the portal reads as an actual
// opening rather than a decal painted over a solid wall.
const PORTAL_GAP_HALF_HEIGHT = PORTAL_RADIUS * PORTAL_ASPECT.y * 1.3;
// Narrower than the visual gap — only the true opening (not just being
// near the wall next to it) will register as "entering the portal"
// once teleportation is wired up in a future pass.
const PORTAL_TRIGGER_HALF_HEIGHT = PORTAL_RADIUS * PORTAL_ASPECT.y * 0.7;

function createFloorPattern() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#3a3d3f";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const shade = 40 + Math.random() * 40;
    ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade}, 0.18)`;
    ctx.fillRect(x, y, 1.2, 1.2);
  }
  ctx.strokeStyle = "rgba(15,15,17,0.55)";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, size, size);

  return canvas;
}

export function createGarageZone() {
  const bounds = GARAGE_BOUNDS;
  const floorY = bounds.maxY;

  const portalPosition = { x: bounds.maxX, y: floorY - PORTAL_RADIUS * PORTAL_ASPECT.y };
  const portal = createPortal2D({
    position: portalPosition,
    normal: { x: -1, y: 0 }, // points left, into the room
    radius: PORTAL_RADIUS,
    aspect: PORTAL_ASPECT,
  });

  // Kept deliberately empty: just the floor/walls/ceiling and the
  // portal for now. Re-add prop rects here later once there's a real
  // reason to (obstacles, interactables, etc) — Player/collision code
  // already supports any number of them.
  const colliders = [];

  const spawn = { x: bounds.minX + 2, y: floorY - 0.55 };
  const spawnFacing = 1; // facing right, toward the portal

  const floorPattern = createFloorPattern();
  const floorPatternRef = { pattern: null };

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
    const atWall = position.x + halfW >= bounds.maxX - 0.02;
    const withinHeight = Math.abs(position.y - portalPosition.y) < PORTAL_TRIGGER_HALF_HEIGHT;
    return atWall && withinHeight;
  }

  function drawFloor(ctx) {
    if (!floorPatternRef.pattern) floorPatternRef.pattern = ctx.createPattern(floorPattern, "repeat");
    ctx.save();
    ctx.fillStyle = floorPatternRef.pattern;
    ctx.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
    ctx.restore();
  }

  function drawWalls(ctx) {
    ctx.fillStyle = "#8d8f8a";

    // Ceiling
    ctx.fillRect(bounds.minX - WALL_THICKNESS, bounds.minY - WALL_THICKNESS, bounds.maxX - bounds.minX + WALL_THICKNESS * 2, WALL_THICKNESS);
    // Left wall
    ctx.fillRect(bounds.minX - WALL_THICKNESS, bounds.minY, WALL_THICKNESS, bounds.maxY - bounds.minY);

    // Right wall, split around the portal opening.
    const gapMin = portalPosition.y - PORTAL_GAP_HALF_HEIGHT;
    const gapMax = portalPosition.y + PORTAL_GAP_HALF_HEIGHT;
    ctx.fillRect(bounds.maxX, bounds.minY, WALL_THICKNESS, gapMin - bounds.minY);
    ctx.fillRect(bounds.maxX, gapMax, WALL_THICKNESS, bounds.maxY - gapMax);
  }

  function draw(ctx) {
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

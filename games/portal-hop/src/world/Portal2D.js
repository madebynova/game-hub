// Cheap deterministic wobble used in place of real simplex noise — a
// small sum of out-of-phase sine waves is enough to make the portal's
// silhouette read as an irregular oval rather than a perfect ellipse,
// without pulling in a noise library.
function edgeWobble(angle, time) {
  return 0.19 * Math.sin(angle * 3 + time * 0.5) + 0.1 * Math.sin(angle * 5 - time * 0.8 + 1.7);
}

function buildBlobPath(radiusX, radiusY, time, segments = 28) {
  const path = new Path2D();
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const wob = 1 + edgeWobble(angle, time);
    const px = Math.cos(angle) * radiusX * wob;
    const py = Math.sin(angle) * radiusY * wob;
    if (i === 0) path.moveTo(px, py);
    else path.lineTo(px, py);
  }
  path.closePath();
  return path;
}

/**
 * A simple Rick-and-Morty-style portal: a bright green irregular oval
 * with a two-tone swirl inside, a darker center, a few small sparkle
 * particles, and a modest glow — deliberately plain, matching a hand-
 * painted reference rather than a modern VFX look. No bloom, no
 * additive layers, no pulsing — just a flat swirl that slowly turns.
 *
 * @param position {{x:number,y:number}} world-space center, on the wall
 * @param normal {{x:number,y:number}} unit vector pointing INTO the room (kept for future use)
 * @param radius {number} base size reference
 * @param aspect {{x:number,y:number}} per-axis stretch for the vertical-oval shape
 */
export function createPortal2D({ position, normal, radius = 1.3, aspect = { x: 1, y: 1 } }) {
  const radiusX = radius * aspect.x;
  const radiusY = radius * aspect.y;

  const particleCount = 14;
  const particles = Array.from({ length: particleCount }, () => ({
    angle: Math.random() * Math.PI * 2,
    dist: 0.15 + Math.random() * 0.8,
    speed: 0.15 + Math.random() * 0.3,
  }));

  let time = 0;

  function update(delta) {
    time += delta;
    for (const p of particles) {
      p.angle += p.speed * delta;
    }
  }

  function draw(ctx) {
    ctx.save();
    ctx.translate(position.x, position.y);

    // A thin halo hugging the edge — just enough to read as "glowing",
    // not a light source illuminating the room. The garage around it
    // should stay dark; the green comes from the portal, not from it
    // acting like a lamp.
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(radiusX, radiusY) * 1.12);
    glow.addColorStop(0, "rgba(140, 230, 90, 0)");
    glow.addColorStop(0.75, "rgba(140, 230, 90, 0.1)");
    glow.addColorStop(1, "rgba(140, 230, 90, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(0, 0, radiusX * 1.12, radiusY * 1.12, 0, 0, Math.PI * 2);
    ctx.fill();

    const blob = buildBlobPath(radiusX, radiusY, time);

    // Base fill: dark green center to bright green edge — simple depth
    // cue, no near-black void.
    const fill = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(radiusX, radiusY));
    fill.addColorStop(0, "#1b4a16");
    fill.addColorStop(0.55, "#2f7a1e");
    fill.addColorStop(1, "#8fd63c");
    ctx.save();
    ctx.clip(blob);
    ctx.fillStyle = fill;
    ctx.fillRect(-radiusX, -radiusY, radiusX * 2, radiusY * 2);

    // Two-tone swirl bands — plain filled strokes, no glow/blend tricks.
    drawSpiralBand(ctx, radiusX, radiusY, time * 0.5, "rgba(201, 232, 90, 0.8)", 0.4);
    drawSpiralBand(ctx, radiusX, radiusY, time * 0.5 + Math.PI, "rgba(31, 74, 20, 0.55)", 0.32);

    // A few small bright sparkles drifting inside.
    ctx.fillStyle = "rgba(235, 255, 210, 0.9)";
    for (const p of particles) {
      const px = Math.cos(p.angle) * radiusX * p.dist;
      const py = Math.sin(p.angle) * radiusY * p.dist;
      ctx.beginPath();
      ctx.arc(px, py, 0.025, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore(); // end clip

    // Bright green rim right at the edge.
    ctx.lineWidth = 0.06;
    ctx.strokeStyle = "rgba(200, 240, 110, 0.9)";
    ctx.stroke(blob);

    ctx.restore();
  }

  return { position, radius, update, draw };
}

/** One simple swirl band: a thick spiral stroke from center to edge. */
function drawSpiralBand(ctx, radiusX, radiusY, phase, color, lineWidthFraction) {
  const steps = 26;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = phase + t * Math.PI * 2.2;
    const px = Math.cos(angle) * radiusX * t;
    const py = Math.sin(angle) * radiusY * t;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(radiusX, radiusY) * lineWidthFraction;
  ctx.strokeStyle = color;
  ctx.stroke();
}

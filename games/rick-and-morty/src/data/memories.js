/**
 * Memory fragments.
 *
 * Each fragment is a self-contained record with everything the memory device
 * needs to display it, including its own little painter so fragments can look
 * different from one another without shipping image assets.
 *
 * Fields (the full shape is here even though Phase 1 only ships one fragment —
 * later fragments just fill in more of it):
 *   id, index          ordering
 *   title              display name
 *   recovery           percentage points added to MEMORY RECOVERY
 *   requires           { research: [], flags: [], fragments: [] }
 *   transcript         array of lines (what the player "remembers")
 *   note               the device's own cold analysis line
 *   clues              clue ids granted on first playback
 *   locations          place tags (feeds future map/mystery cross-referencing)
 *   characters         character tags (ditto)
 *   paint(ctx, w, h, t) canvas painter, t = seconds since playback started
 */

export const FRAGMENTS = {
  frag_01_corridor: {
    id: 'frag_01_corridor',
    index: 1,
    title: 'FRAGMENT 01 — "the corridor"',
    recovery: 8,
    requires: { research: ['res_cortex_shard'], flags: [], fragments: [] },
    transcript: [
      'Wet floor. Green light, but not portal green — the sick green of a corridor lamp that nobody has replaced in a decade.',
      'You are walking, and then you are being walked. Two hands under your arms. Your shoes are dragging and you can hear them.',
      'Someone ahead of you is talking. Not to you. About you.',
      '"— no, it took. It took clean. Look at him, he\'s still trying to file a complaint."',
      'A laugh. Yours? Not yours.',
      'A coat. You can see the bottom of a lab coat, and something wrong with the hem — it is stained a colour that lab coats do not come in.',
      'Then the voice, closer, bored, patient, already knowing the answer:',
      '"Hey. Hey. What\'s my name?"',
      'You know the answer. You knew it thirty seconds ago.',
      'It is gone before you can say it.',
    ],
    note: 'RECONSTRUCTION CONFIDENCE: 11%. Audio layer is partially synthetic — the rig guessed at what it could not recover. Do not treat the voice as verbatim.',
    clues: ['clue_fragment1', 'clue_neck_mark'],
    locations: ['citadel_lower_rings', 'unknown_corridor'],
    characters: ['the_voice'],

    /** Canvas painter: a smeared corridor in perspective, scan-lined and unstable. */
    paint(ctx, w, h, t) {
      ctx.save();
      // Base dark
      ctx.fillStyle = '#05070c';
      ctx.fillRect(0, 0, w, h);

      const cx = w * 0.5 + Math.sin(t * 0.7) * 6;
      const cy = h * 0.52;

      // Corridor vanishing-point wedges
      const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, w * 0.6);
      grad.addColorStop(0, 'rgba(120, 200, 110, 0.55)');
      grad.addColorStop(0.35, 'rgba(40, 80, 50, 0.35)');
      grad.addColorStop(1, 'rgba(6, 10, 14, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Floor + ceiling perspective lines
      ctx.strokeStyle = 'rgba(150, 220, 140, 0.22)';
      ctx.lineWidth = 1;
      for (let i = -4; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + i * w * 0.35, h + 40);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + i * w * 0.35, -40);
        ctx.stroke();
      }

      // Receding floor bands (the dragged-shoe rhythm)
      for (let i = 1; i < 9; i++) {
        const k = i / 9;
        const y = cy + Math.pow(k, 2.1) * (h - cy) * 1.15;
        ctx.strokeStyle = `rgba(160, 230, 150, ${0.18 * (1 - k) + 0.04})`;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // The figure: a silhouette in a coat, always slightly too far away.
      // Drawn big enough to read as a person, vague enough to stay a question.
      const fh = h * 0.60;
      const fw = fh * 0.34;
      const fy = cy - fh * 0.34 + Math.sin(t * 1.1) * 3;   // top of the head
      const headR = fw * 0.40;
      const headY = fy + headR * 1.25;

      ctx.fillStyle = 'rgba(3, 5, 8, 0.94)';
      // coat body, flaring at the bottom
      ctx.beginPath();
      ctx.moveTo(cx - fw * 0.62, fy + fh);
      ctx.lineTo(cx - fw * 0.34, headY + headR * 1.5);
      ctx.quadraticCurveTo(cx, headY + headR * 0.95, cx + fw * 0.34, headY + headR * 1.5);
      ctx.lineTo(cx + fw * 0.62, fy + fh);
      ctx.closePath();
      ctx.fill();
      // neck + head, clearly separated from the shoulders
      ctx.fillRect(cx - headR * 0.35, headY, headR * 0.7, headR * 1.6);
      ctx.beginPath();
      ctx.arc(cx, headY, headR, 0, Math.PI * 2);
      ctx.fill();
      // the suggestion of hair — spiked, unmistakable, unconfirmed
      ctx.beginPath();
      ctx.moveTo(cx - headR * 1.45, headY - headR * 0.30);
      ctx.lineTo(cx - headR * 1.05, headY - headR * 1.55);
      ctx.lineTo(cx - headR * 0.45, headY - headR * 0.85);
      ctx.lineTo(cx - headR * 0.05, headY - headR * 1.75);
      ctx.lineTo(cx + headR * 0.45, headY - headR * 0.85);
      ctx.lineTo(cx + headR * 1.00, headY - headR * 1.50);
      ctx.lineTo(cx + headR * 1.45, headY - headR * 0.30);
      ctx.closePath();
      ctx.fill();
      // the wrong-coloured hem
      ctx.fillStyle = 'rgba(196, 107, 255, 0.55)';
      ctx.fillRect(cx - fw * 0.62, fy + fh - 6, fw * 1.24, 6);
      // two dim points where eyes would be, if this were a face
      ctx.fillStyle = 'rgba(151, 206, 76, 0.35)';
      ctx.fillRect(cx - headR * 0.45, headY - headR * 0.1, 2.5, 2.5);
      ctx.fillRect(cx + headR * 0.2, headY - headR * 0.1, 2.5, 2.5);

      // Scanlines
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);

      // Tear line that wanders — the reconstruction failing in real time
      const tearY = ((t * 40) % (h + 60)) - 30;
      ctx.fillStyle = 'rgba(196, 107, 255, 0.16)';
      ctx.fillRect(0, tearY, w, 9);

      // Vignette
      const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.78);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.85)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    },
  },
};

export function getFragment(id) { return FRAGMENTS[id]; }

/** Fragments whose requirements are satisfied but which the player lacks. */
export function availableFragments(state) {
  return Object.values(FRAGMENTS)
    .filter((f) => !state.memory.fragments.includes(f.id))
    .filter((f) => {
      const req = f.requires ?? {};
      return (req.research ?? []).every((r) => state.research.completed.includes(r))
        && (req.flags ?? []).every((fl) => state.flags[fl])
        && (req.fragments ?? []).every((fr) => state.memory.fragments.includes(fr));
    })
    .sort((a, b) => a.index - b.index);
}

/** Total recovery percentage the player could ever have (for UI context). */
export const TOTAL_FRAGMENTS = Object.keys(FRAGMENTS).length;

// Tiny self-contained sound effects synthesized with the Web Audio API —
// no audio files to load or manage. AudioContext creation is deferred
// until the first call after a user gesture (browsers block autoplay
// otherwise), and a failure to create/play is swallowed silently since
// sound here is a nice-to-have, not something correctness depends on.

let ctx = null;

function getContext() {
  if (ctx) return ctx;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    ctx = new AudioContextClass();
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Call once on a real user gesture (e.g. the click to lock the pointer). */
export function unlockAudio() {
  const audioCtx = getContext();
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
}

/** Short rising energy "whoosh" for stepping through the portal. */
export function playPortalWhoosh() {
  const audioCtx = getContext();
  if (!audioCtx) return;

  try {
    const now = audioCtx.currentTime;
    const duration = 0.45;

    // Rising sweep gives the "sucked through" feeling.
    const osc = audioCtx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(720, now + duration);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.35, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    const filter = audioCtx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.exponentialRampToValueAtTime(2200, now + duration);
    filter.Q.value = 0.8;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.05);

    // Short noise burst layered in for a bit of energy "crackle".
    const bufferSize = Math.floor(audioCtx.sampleRate * duration);
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.12, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    noise.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);
    noise.start(now);
  } catch {
    // Sound is a nice-to-have; never let it break the transition.
  }
}

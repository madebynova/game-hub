import { DEPTH_ZONES } from '../config';
import type { OxygenStatus } from '../systems/oxygen';
import { clamp, lerp, smoothstep } from './math';

/**
 * Pure mixing decisions for the soundscape — no Web Audio here, so it can be tested.
 * `audio.ts` and `ambience.ts` turn these numbers into sound.
 */

export type AudioBus = 'warning' | 'discovery' | 'sfx' | 'ambience' | 'ui';

/** Loudest first: warnings always cut through, discoveries feel special, ambience and UI sit underneath. */
export const BUS_PRIORITY: AudioBus[] = ['warning', 'discovery', 'sfx', 'ambience', 'ui'];

export const BUS_LEVELS: Record<AudioBus, number> = {
  warning: 1,
  discovery: 0.85,
  sfx: 0.65,
  ambience: 0.42,
  ui: 0.3,
};

export const MASTER_LEVEL = 0.6;

/** What the soundscape needs to know about the diver each frame. */
export interface AudioEnv {
  /** 1 while underwater, 0 on the boat or at the surface. */
  submerged: number;
  /** World units below the surface. */
  depth: number;
  insideWreck: boolean;
  /** 0..1 how hard the diver is swimming. */
  swim: number;
  oxygenStatus: OxygenStatus;
  oxygenFrac: number;
  /** 0..1 through the out-of-air grace period. */
  drowning: number;
  /** 0..1 fade to black on blackout. */
  fade: number;
}

export const SURFACE_ENV: AudioEnv = {
  submerged: 0,
  depth: 0,
  insideWreck: false,
  swim: 0,
  oxygenStatus: 'ok',
  oxygenFrac: 1,
  drowning: 0,
  fade: 0,
};

export interface AmbienceMix {
  /** Waves lapping at the hull (above water). */
  waves: number;
  /** Muffled water bed (underwater). */
  bed: number;
  bedCutoff: number;
  /** Low drone that grows with depth. */
  drone: number;
  droneFreq: number;
  /** Hollow resonance around and inside the wreck. */
  enclosure: number;
  /** Low-pass cutoff applied to gameplay sounds — the "heard through water" effect. */
  sfxCutoff: number;
  master: number;
}

/** 0 in the sunlit reef, rising smoothly to 1 at the bottom of the abyss. */
export const depthTension = (depth: number) => smoothstep(0, 4000, depth);

/** 0..1 presence in the wreck's depth band, fading in above it and out into the abyss. */
const wreckBand = (depth: number) =>
  smoothstep(DEPTH_ZONES.wreck - 350, DEPTH_ZONES.wreck + 150, depth) *
  (1 - smoothstep(DEPTH_ZONES.abyss, DEPTH_ZONES.abyss + 700, depth));

/** Every layer is a smooth function of depth, so zones blend instead of switching tracks. */
export function ambienceMix(env: AudioEnv): AmbienceMix {
  const s = clamp(env.submerged, 0, 1);
  const t = depthTension(env.depth);
  const drown = clamp(env.drowning, 0, 1);
  const hush = 1 - 0.5 * drown; // hearing tunnels in as the air runs out
  const underwaterCutoff = Math.max(320, lerp(2600, 1300, t) * (1 - 0.7 * drown));
  return {
    waves: (1 - s) * 0.9,
    bed: s * (1.2 + 0.6 * t) * hush,
    bedCutoff: lerp(900, 240, t),
    drone: s * (0.03 + 0.32 * t * t) * hush,
    droneFreq: lerp(64, 38, t),
    enclosure: s * (env.insideWreck ? 1.4 : 0.45 * wreckBand(env.depth)) * hush,
    // Log-interpolated so the muffle closes quickly as you go under.
    sfxCutoff: 18000 * Math.pow(underwaterCutoff / 18000, s),
    master: 1 - 0.85 * clamp(env.fade, 0, 1),
  };
}

export interface AmbientEventRates {
  bubbles: number;
  creaks: number;
  /** Distant, low, whale-like calls. */
  calls: number;
}

/** Average sparse environmental sounds per second at the diver's position. */
export function ambientEventRates(env: AudioEnv): AmbientEventRates {
  if (env.submerged < 0.5) return { bubbles: 0, creaks: 0, calls: 0 };
  const t = depthTension(env.depth);
  return {
    bubbles: lerp(0.22, 0.04, t),
    creaks: env.insideWreck ? 0.12 : 0.07 * wreckBand(env.depth),
    calls: 0.045 * smoothstep(DEPTH_ZONES.abyss - 200, DEPTH_ZONES.abyss + 1200, env.depth),
  };
}

/** Seconds between oxygen warnings, or null for silence. Escalates, but never a constant beep. */
export function warningInterval(status: OxygenStatus, oxygenFrac: number): number | null {
  if (status === 'low') return 4.5;
  if (status === 'critical') return lerp(1.1, 2, clamp(oxygenFrac / 0.3, 0, 1));
  return null; // 'ok' is silent; 'empty' hands over to the heartbeat
}

/** Seconds between fin strokes: slow when drifting, quicker when kicking hard. */
export const strokeInterval = (swim: number) => lerp(0.8, 0.45, clamp(swim, 0, 1));

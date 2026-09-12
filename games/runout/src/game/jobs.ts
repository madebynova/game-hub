import { pick } from '../engine/math';
import { RUN, type HouseTierName } from './config';

/**
 * A job is one night with a particular situation attached.
 *
 * Everything here drives systems the game already has — Heat, the night clock,
 * house tier weights, patrols, weather, the payout multiplier. No job invents a
 * new mechanic; it just dials the existing ones into a shape worth choosing
 * between.
 *
 * The point is that the jobs differ in the *kind* of risk they carry, not just
 * the size of the number. A short night and a noisy block are both dangerous,
 * but they punish completely different mistakes, and different upgrades answer
 * them. If two jobs only differed by payout there would be nothing to decide.
 */
export interface Job {
  id: string;
  name: string;
  /** One line saying, in the fiction, why it pays what it pays. */
  blurb: string;
  /** The fence's cut, paid up front out of banked cash. */
  entryCost: number;
  payMultiplier: number;
  /** Heat you arrive with. */
  startHeat: number;
  /** Multiplies the Heat each doorbell adds. */
  heatMultiplier: number;
  nightLength: number;
  /** Multiplies each house tier's base spawn weight. */
  tierBias: Partial<Record<HouseTierName, number>>;
  /** Patrols already walking the street when you arrive. */
  patrolsAtStart: number;
  /** Seconds of rain to open with — real cover, but it runs out. */
  rainSeconds: number;
  /** Paid on extraction if you land this many clips. */
  quota: { clips: number; bonus: number } | null;
  /** The upgrade that most answers this job's particular danger. */
  suits: string;
  risk: 1 | 2 | 3 | 4;
}

const TEMPLATES: readonly Job[] = [
  {
    id: 'quiet-row',
    name: 'QUIET ROW',
    blurb: 'Nothing worth much on this street, and nobody awake to defend it.',
    entryCost: 0,
    payMultiplier: 0.85,
    startHeat: 0,
    heatMultiplier: 1,
    nightLength: RUN.nightLength,
    tierBias: { EASY: 2.2, ALERT: 1.2, RISKY: 0.35, VALUABLE: 0.1 },
    patrolsAtStart: 0,
    rainSeconds: 0,
    quota: null,
    suits: 'nothing in particular — this is the one you take to rebuild',
    risk: 1,
  },
  {
    id: 'full-driveways',
    name: 'FULL DRIVEWAYS',
    blurb: 'Everybody is home. Wet night, though — they will see you late.',
    entryCost: 60,
    payMultiplier: 1.15,
    startHeat: 0,
    heatMultiplier: 1,
    nightLength: RUN.nightLength,
    tierBias: { EASY: 0.7, ALERT: 1.4, RISKY: 1.3, VALUABLE: 0.8 },
    patrolsAtStart: 0,
    rainSeconds: 55,
    quota: null,
    suits: 'HOPPERS — the gardens are the way through',
    risk: 2,
  },
  {
    id: 'the-round',
    name: 'THE ROUND',
    blurb: 'Paid by the doorbell, not by the door. Volume job.',
    entryCost: 80,
    payMultiplier: 1.05,
    startHeat: 0,
    heatMultiplier: 0.85,
    nightLength: RUN.nightLength,
    tierBias: { EASY: 1.5, ALERT: 1.3, RISKY: 0.7, VALUABLE: 0.3 },
    patrolsAtStart: 0,
    rainSeconds: 0,
    quota: { clips: 5, bonus: 700 },
    suits: 'SECOND WIND — you are going to be out there a while',
    risk: 2,
  },
  {
    id: 'noisy-block',
    name: 'NOISY BLOCK',
    blurb: 'Thin walls and twitchy neighbours. Every bell carries down the street.',
    entryCost: 150,
    payMultiplier: 1.5,
    startHeat: 0,
    heatMultiplier: 1.6,
    nightLength: RUN.nightLength,
    tierBias: { ALERT: 1.3, RISKY: 1.2 },
    patrolsAtStart: 0,
    rainSeconds: 0,
    quota: null,
    suits: 'NINJA SOCKS — they cut the Heat this job punishes you with',
    risk: 3,
  },
  {
    id: 'already-awake',
    name: 'ALREADY AWAKE',
    blurb: 'Somebody called it in before you arrived. Pays for the head start they got.',
    entryCost: 140,
    payMultiplier: 1.35,
    startHeat: 42,
    heatMultiplier: 1,
    nightLength: RUN.nightLength,
    tierBias: { ALERT: 1.2, RISKY: 1.1 },
    patrolsAtStart: 1,
    rainSeconds: 0,
    quota: null,
    suits: 'FIRECRACKERS — the answer to a patrol you cannot outlast',
    risk: 3,
  },
  {
    id: 'short-night',
    name: 'SHORT NIGHT',
    blurb: 'Dawn comes early here. Half the time, nearly double the money.',
    entryCost: 110,
    payMultiplier: 1.85,
    startHeat: 0,
    heatMultiplier: 1,
    nightLength: 130,
    tierBias: { ALERT: 1.2, RISKY: 1.2, VALUABLE: 1.2 },
    patrolsAtStart: 0,
    rainSeconds: 0,
    quota: null,
    suits: 'SCOUT APP — no time to walk up and squint at doors',
    risk: 3,
  },
  {
    id: 'the-good-end',
    name: 'THE GOOD END',
    blurb: 'Big houses. Big floodlights. Big dogs. You already know.',
    entryCost: 130,
    payMultiplier: 2.1,
    startHeat: 12,
    heatMultiplier: 1.15,
    nightLength: RUN.nightLength,
    tierBias: { EASY: 0.15, ALERT: 0.5, RISKY: 1.3, VALUABLE: 6.5 },
    patrolsAtStart: 0,
    rainSeconds: 0,
    quota: null,
    suits: 'HOPPERS or FIRECRACKERS — you will need a way out, not a way in',
    risk: 4,
  },
];

/** The one that is always on the board, and always affordable. */
const FALLBACK = TEMPLATES[0] as Job;

/**
 * Three offers: something safe, something middling, something that might hurt.
 *
 * The safe option is always present and always free to take, so being broke
 * never locks the player out of playing — it just means the good jobs are out
 * of reach until they have rebuilt, which is the point of the entry cost.
 */
export function offerJobs(cash: number): Job[] {
  const low = TEMPLATES.filter((job) => job.risk <= 2 && job.id !== FALLBACK.id);
  const mid = TEMPLATES.filter((job) => job.risk === 3);
  const high = TEMPLATES.filter((job) => job.risk >= 4);

  const offers: Job[] = [low.length > 0 && Math.random() < 0.55 ? pick(low) : FALLBACK];
  offers.push(pick(mid.length > 0 ? mid : TEMPLATES));
  offers.push(pick(high.length > 0 ? high : mid));

  // The guarantee is that the player can always afford *something*, not that a
  // free job is always listed — an earlier version forced the free fallback onto
  // the board whenever nothing else was free, which meant the two paid low-risk
  // jobs could never be offered at all.
  if (!offers.some((job) => cash >= job.entryCost)) offers[0] = FALLBACK;

  return offers;
}

/** Short, concrete lines explaining exactly what this job does to the night. */
export function jobEffects(job: Job): string[] {
  const lines: string[] = [];

  if (job.nightLength !== RUN.nightLength) {
    const m = Math.floor(job.nightLength / 60);
    const s = Math.round(job.nightLength % 60);
    lines.push(`Night is only ${m}:${s.toString().padStart(2, '0')}`);
  }
  if (job.startHeat > 0) lines.push(`Starts at ${job.startHeat} Heat`);
  if (job.patrolsAtStart > 0) {
    lines.push(`${job.patrolsAtStart} patrol already out there`);
  }
  if (job.heatMultiplier > 1) lines.push(`Heat per bell x${job.heatMultiplier}`);
  if (job.heatMultiplier < 1) lines.push(`Heat per bell x${job.heatMultiplier}`);
  if (job.rainSeconds > 0) lines.push(`Rain for the first ${job.rainSeconds}s`);
  if (job.quota) lines.push(`+$${job.quota.bonus} if you land ${job.quota.clips} clips`);

  const rich = (job.tierBias.VALUABLE ?? 1) + (job.tierBias.RISKY ?? 1);
  if (rich > 3) lines.push('Street is mostly the dangerous houses');
  else if ((job.tierBias.EASY ?? 1) > 1.6) lines.push('Mostly easy doors');

  return lines;
}

import { PLAYER, RUN } from './config';

/**
 * The player's stats and capabilities for a run, after upgrades are folded in.
 *
 * Each upgrade is meant to unlock a different way of getting through a night —
 * a route, a tool, a piece of information, a risk policy — rather than nudging
 * a number. If two upgrades only differ by how big their percentage is, one of
 * them is not pulling its weight.
 */
/** One-word identity, shown on the shop card so the role reads at a glance. */
export type UpgradeRole = 'MOBILITY' | 'ENDURANCE' | 'STEALTH' | 'INSURANCE' | 'INFO' | 'TOOLS';

export interface Loadout {
  walkSpeed: number;
  sprintSpeed: number;
  staminaMax: number;
  staminaRegen: number;
  sprintDrain: number;
  /** Multiplies Heat gained per ring. Lower is better. */
  heatMultiplier: number;
  /** Multiplies how far your footsteps carry to a searching chaser. */
  noiseMultiplier: number;
  payoutMultiplier: number;

  // --- capabilities, not numbers ---

  /** Hop garden hedges. They still stop everyone chasing you. */
  vaultHedges: boolean;
  /** Fraction of stamina handed back the first time you run dry in a chase. */
  secondWind: number;
  /** How many seconds of scent you leave behind for a dog to follow. */
  trailSeconds: number;
  /** How far away house tiers are readable. */
  scoutRange: number;
  /** Draws chaser sight radii. */
  showSight: boolean;
  /** Outlines chasers you cannot currently see. */
  seeThroughWalls: boolean;
  /** Marks which houses keep a dog or a floodlight, from scouting range. */
  showHouseTells: boolean;
  /**
   * Multiplies the chance that a hot street sends *extra* bodies to a door on
   * top of the tier's own roster. Quiet work draws a smaller crowd.
   */
  mobChance: number;
  /** Multiplies stamina recovery while nobody is hunting you. */
  restRegen: number;
  decoys: number;
}

export interface Upgrade {
  id: string;
  name: string;
  role: UpgradeRole;
  tagline: string;
  maxLevel: number;
  baseCost: number;
  costGrowth: number;
  /** What owning `level` of this gets you, in the player's own terms. */
  describe: (level: number) => string;
  apply: (loadout: Loadout, level: number) => void;
}

export const UPGRADES: readonly Upgrade[] = [
  {
    // Mobility. Turns the gardens into your route and the hedge maze into an
    // advantage only you have, which is a different game from running the road.
    id: 'shoes',
    role: 'MOBILITY',
    name: 'HOPPERS',
    tagline: 'Vault hedges. Nobody chasing you can.',
    maxLevel: 4,
    baseCost: 260,
    costGrowth: 1.8,
    describe: (level) => {
      if (level === 0) return 'Standard-issue flip flops.';
      if (level === 1) return '+8 walk / +6 sprint. Hedges still stop you.';
      return `Hop hedges at will, +${level * 8} walk / +${level * 6} sprint`;
    },
    apply: (loadout, level) => {
      // Deliberately small. Sprint must stay under a dog's 366 or the upgrade
      // stops being about routing and becomes "outrun everything".
      loadout.walkSpeed += level * 8;
      loadout.sprintSpeed += level * 6;
      if (level >= 2) loadout.vaultHedges = true;
    },
  },
  {
    // Endurance. Lets you commit to a long chase instead of having to break
    // line of sight before the tank runs out.
    id: 'cardio',
    role: 'ENDURANCE',
    name: 'SECOND WIND',
    tagline: 'Run dry once per chase and get back up.',
    maxLevel: 4,
    baseCost: 230,
    costGrowth: 1.8,
    describe: (level) => {
      if (level === 0) return 'You get winded on stairs.';
      if (level === 1) return '+26 stamina, 1.5x recovery between houses.';
      return `+${level * 26} stamina, ${1 + level * 0.5}x recovery between houses, ${Math.round(
        secondWindFor(level) * 100,
      )}% back when you run dry`;
    },
    apply: (loadout, level) => {
      loadout.staminaMax += level * 26;
      // Recovery between houses is the endurance identity: it decides how many
      // doors you can work in one night, which is a different thing from being
      // better at any single escape.
      loadout.restRegen += level * 0.5;
      if (level >= 2) loadout.secondWind = secondWindFor(level);
    },
  },
  {
    // Stealth. The direct answer to the scariest thing in the game: at full
    // level a dog has nothing left to follow.
    id: 'socks',
    role: 'STEALTH',
    name: 'NINJA SOCKS',
    tagline: 'Quiet feet, and barely any scent for a dog to follow.',
    maxLevel: 4,
    baseCost: 300,
    costGrowth: 1.85,
    describe: (level) => {
      if (level === 0) return 'Your shoes squeak. Loudly. Whole street hears the bell.';
      // Kept short: the card gives this three lines before it meets the price.
      const trail = trailSecondsFor(level).toFixed(1);
      const fewer = Math.round((1 - mobChanceFor(level)) * 100);
      return `-${level * 10}% Heat, -${level * 16}% footsteps, ${fewer}% smaller crowds, ${trail}s scent trail`;
    },
    apply: (loadout, level) => {
      loadout.heatMultiplier *= 1 - level * 0.1;
      loadout.noiseMultiplier *= 1 - level * 0.16;
      loadout.trailSeconds = trailSecondsFor(level);
      // A hot street piles extra bodies onto every door. Working quietly means
      // fewer of them turn out — the one part of Heat you can actually see.
      loadout.mobChance = mobChanceFor(level);
    },
  },
  {
    // Risk policy. Does nothing for your driving; changes how far you dare push
    // before heading for the van, which is the central decision of the game.
    id: 'charm',
    role: 'INSURANCE',
    name: 'DRAINPIPE STASH',
    tagline: 'Post clips as you run. Keep some of it when you get caught.',
    maxLevel: 4,
    baseCost: 340,
    costGrowth: 1.95,
    describe: (level) =>
      level
        ? `Keep ${Math.round(retentionFor(level) * 100)}% of your stash when busted`
        : 'Get caught and every clip on you is gone.',
    apply: (loadout, level) => {
      loadout.payoutMultiplier += level * 0.04;
    },
  },
  {
    // Information. You stop guessing where everyone is and start routing.
    id: 'scout',
    role: 'INFO',
    name: 'SCOUT APP',
    tagline: 'Read the street, then see through it.',
    maxLevel: 3,
    baseCost: 220,
    costGrowth: 1.8,
    describe: (level) => {
      if (level === 0) return 'You can read the nearest few doors.';
      if (level === 1) return 'Read tiers down the street, and which houses keep a dog or a floodlight';
      if (level === 2) return 'Adds everyone’s sight range, drawn live';
      return 'Adds chasers outlined through walls';
    },
    apply: (loadout, level) => {
      loadout.scoutRange += level * 260;
      // Which houses have a dog is the single most useful thing to know before
      // choosing a door, now that a kennel is the only thing that produces one.
      loadout.showHouseTells = true;
      if (level >= 2) loadout.showSight = true;
      if (level >= 3) loadout.seeThroughWalls = true;
    },
  },
  {
    // Tools. The only upgrade that lets you act on a chase rather than react.
    id: 'firecrackers',
    role: 'TOOLS',
    name: 'FIRECRACKERS',
    tagline: '[Q] Lob one behind you. They all go and look at the noise.',
    maxLevel: 3,
    baseCost: 280,
    costGrowth: 1.9,
    describe: (level) => (level ? `Start each run with ${level}` : 'Nothing to throw.'),
    apply: (loadout, level) => {
      loadout.decoys += level;
    },
  },
];

/** Stash kept on a bust. Capped well under 100% so a bust always stings. */
export function retentionFor(level: number): number {
  return [0, 0.15, 0.3, 0.45, 0.6][Math.min(level, 4)] ?? 0;
}

function secondWindFor(level: number): number {
  return [0, 0, 0.35, 0.45, 0.55][Math.min(level, 4)] ?? 0;
}

function mobChanceFor(level: number): number {
  return Math.max(0.25, 1 - level * 0.2);
}

function trailSecondsFor(level: number): number {
  const full = RUN.trailLength * RUN.trailInterval;
  return Math.max(0.6, full * (1 - level * 0.22));
}

export function upgradeCost(upgrade: Upgrade, currentLevel: number): number {
  return Math.round(upgrade.baseCost * Math.pow(upgrade.costGrowth, currentLevel));
}

export function buildLoadout(levels: Readonly<Record<string, number>>): Loadout {
  const loadout: Loadout = {
    walkSpeed: PLAYER.walkSpeed,
    sprintSpeed: PLAYER.sprintSpeed,
    staminaMax: PLAYER.staminaMax,
    staminaRegen: PLAYER.staminaRegen,
    sprintDrain: PLAYER.sprintDrain,
    heatMultiplier: 1,
    noiseMultiplier: 1,
    payoutMultiplier: 1,
    vaultHedges: false,
    secondWind: 0,
    trailSeconds: RUN.trailLength * RUN.trailInterval,
    scoutRange: 560,
    showSight: false,
    seeThroughWalls: false,
    showHouseTells: false,
    mobChance: 1,
    restRegen: 1,
    decoys: 0,
  };

  for (const upgrade of UPGRADES) {
    const level = levels[upgrade.id] ?? 0;
    if (level > 0) upgrade.apply(loadout, level);
  }

  return loadout;
}

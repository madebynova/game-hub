import type { LootTable } from '../data/treasures';

/** A thick line segment the diver collides with. */
export interface Wall {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  half: number;
}

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface CollapseDef {
  id: string;
  rect: Rect;
}

export interface AirPocketDef {
  id: string;
  x: number;
  y: number;
  r: number;
  /** Total oxygen the pocket can give per dive. */
  capacity: number;
  kind: 'trapped' | 'vent';
}

export interface WreckLayout {
  x: number;
  y: number;
  angle: number;
  walls: Wall[];
  /** Hull outline, used for "inside the wreck" checks and interior shading. */
  hull: [number, number][];
  /** Interior deck / bulkhead segments (drawn differently from the outer hull). */
  interior: Wall[];
  spawns: { x: number; y: number; table: LootTable }[];
  collapses: CollapseDef[];
  airPockets: AirPocketDef[];
  toWorld: (lx: number, ly: number) => [number, number];
}

const WALL_HALF = 7;

// Local coordinates: x along the keel (stern -, bow +), y up is negative, keel rests at y = 0.
// Gaps between segments are the ways in: a narrow stern window, a deck hatch,
// a broken deck section, a bow breach, a ladder hole and a crawlspace under a bulkhead.
const OUTER: [number, number, number, number][] = [
  [-450, -250, -446, -165], // stern, above the window
  [-443, -108, -432, -45], // stern, below the window
  [-432, -45, -380, 12], // stern bottom (runs into the seabed)
  [380, 12, 430, -62], // bow bottom
  [430, -62, 441, -100], // bow, below the breach
  [456, -182, 470, -242], // bow, above the breach
  [-450, -250, -125, -250], // top deck, stern to hatch
  [-65, -250, 205, -248], // top deck, hatch to broken section
  [290, -247, 470, -242], // top deck, broken section to bow
];

const INNER: [number, number, number, number][] = [
  [-446, -128, -205, -128], // lower deck, stern to ladder hole
  [-150, -128, 375, -128], // lower deck, ladder hole to bow
  [95, -128, 95, -55], // hold bulkhead (crawlspace beneath)
  [-300, -250, -300, -205], // captain's cabin wall (doorway beneath)
];

const HULL: [number, number][] = [[-450, -250], [470, -242], [430, -62], [380, 10], [-380, 10], [-432, -45]];

const SPAWNS: [number, number, LootTable][] = [
  [-250, -275, 'wreck'], // on the top deck
  [110, -273, 'wreck'],
  [-100, -150, 'wreck'], // just inside the hatch
  [-380, -150, 'hold'], // captain's cabin, via the stern window
  [170, -150, 'hold'], // under the unstable broken deck
  [-330, -22, 'hold'], // lower hold, via the ladder hole
  [-120, -22, 'hold'],
  [250, -22, 'hold'], // bow hold, via the breach or the crawlspace
];

export function buildWreck(x: number, y: number, angle: number): WreckLayout {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const toWorld = (lx: number, ly: number): [number, number] => [x + lx * cos - ly * sin, y + lx * sin + ly * cos];
  const seg = ([ax, ay, bx, by]: [number, number, number, number]): Wall => {
    const [wax, way] = toWorld(ax, ay);
    const [wbx, wby] = toWorld(bx, by);
    return { ax: wax, ay: way, bx: wbx, by: wby, half: WALL_HALF };
  };
  const rect = (lx0: number, ly0: number, lx1: number, ly1: number): Rect => {
    const pts = [toWorld(lx0, ly0), toWorld(lx1, ly0), toWorld(lx0, ly1), toWorld(lx1, ly1)];
    return {
      x0: Math.min(...pts.map((p) => p[0])),
      y0: Math.min(...pts.map((p) => p[1])),
      x1: Math.max(...pts.map((p) => p[0])),
      y1: Math.max(...pts.map((p) => p[1])),
    };
  };

  const interior = INNER.map(seg);
  const [pocketX, pocketY] = toWorld(-385, -212);

  return {
    x,
    y,
    angle,
    walls: [...OUTER.map(seg), ...interior],
    interior,
    hull: HULL.map(([lx, ly]) => toWorld(lx, ly)),
    spawns: SPAWNS.map(([lx, ly, table]) => {
      const [sx, sy] = toWorld(lx, ly);
      return { x: sx, y: sy, table };
    }),
    collapses: [
      { id: 'bow', rect: rect(360, -240, 452, -10) },
      { id: 'deck', rect: rect(150, -240, 320, -135) },
    ],
    airPockets: [{ id: 'cabin', x: pocketX, y: pocketY, r: 30, capacity: 30, kind: 'trapped' }],
    toWorld,
  };
}

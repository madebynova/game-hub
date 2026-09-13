import { DEPTH_ZONES } from '../config';

export type ZoneId = 'reef' | 'wreck' | 'abyss';

export interface ZoneDef {
  id: ZoneId;
  name: string;
  tagline: string;
  /** Multiplier on flashlight reach — murkier water swallows light. */
  visibility: number;
  /** Colour wash laid over the scene while the camera is in this zone. */
  tint: string;
  accent: string;
}

export const ZONES: Record<ZoneId, ZoneDef> = {
  reef: {
    id: 'reef',
    name: 'Shallow Reef',
    tagline: 'Sunlit coral and easy pickings',
    visibility: 1,
    tint: 'rgba(60,200,190,0.05)',
    accent: '#5fd8ff',
  },
  wreck: {
    id: 'wreck',
    name: 'The Wreck',
    tagline: 'Richer salvage. Tighter spaces.',
    visibility: 0.88,
    tint: 'rgba(80,120,70,0.16)',
    accent: '#a8d98f',
  },
  abyss: {
    id: 'abyss',
    name: 'The Abyss',
    tagline: 'Crushing dark. Priceless relics.',
    visibility: 0.7,
    tint: 'rgba(50,20,100,0.18)',
    accent: '#c586ff',
  },
};

export const ZONE_ORDER: ZoneId[] = ['reef', 'wreck', 'abyss'];

/** x where the seafloor drops away into the abyss. */
export const ABYSS_EDGE_X = 3400;
/** x where the reef gives way to the wreck field. */
export const WRECK_FIELD_X = 1950;

/**
 * Zones are depth bands, nudged by region: open water over the wreck field reads as
 * the wreck, and the dark water above the trench already belongs to the abyss.
 */
export function zoneAt(x: number, y: number): ZoneId {
  if (y >= DEPTH_ZONES.abyss || (x >= ABYSS_EDGE_X && y > 700)) return 'abyss';
  if (y >= DEPTH_ZONES.wreck || (x >= WRECK_FIELD_X && y > 500)) return 'wreck';
  return 'reef';
}

export const zoneRank = (id: ZoneId) => ZONE_ORDER.indexOf(id);

import { describe, expect, it } from 'vitest';
import { DEPTH_ZONES } from '../src/config';
import {
  BUS_LEVELS, BUS_PRIORITY, SURFACE_ENV, ambienceMix, ambientEventRates, strokeInterval, warningInterval,
  type AudioEnv,
} from '../src/core/audioMix';

const under = (depth: number, extra: Partial<AudioEnv> = {}): AudioEnv => ({ ...SURFACE_ENV, submerged: 1, depth, ...extra });
const REEF = 600;
const WRECK = 1600;
const ABYSS = 3600;

describe('audio mix', () => {
  it('keeps warnings loudest and UI quietest', () => {
    expect([...BUS_PRIORITY].sort()).toEqual(Object.keys(BUS_LEVELS).sort());
    for (let i = 1; i < BUS_PRIORITY.length; i++) {
      expect(BUS_LEVELS[BUS_PRIORITY[i]]).toBeLessThan(BUS_LEVELS[BUS_PRIORITY[i - 1]]);
    }
  });

  it('sounds like open air on the boat and muffled underwater', () => {
    const deck = ambienceMix(SURFACE_ENV);
    expect(deck.waves).toBeGreaterThan(0);
    expect(deck.bed).toBe(0);
    expect(deck.drone).toBe(0);
    expect(deck.sfxCutoff).toBeGreaterThan(15000);
    const reef = ambienceMix(under(REEF));
    expect(reef.waves).toBe(0);
    expect(reef.bed).toBeGreaterThan(0);
    expect(reef.sfxCutoff).toBeLessThan(3000);
  });

  it('gets lower, darker and more tense from reef to wreck to abyss', () => {
    const [reef, wreck, abyss] = [REEF, WRECK, ABYSS].map((d) => ambienceMix(under(d)));
    expect(wreck.drone).toBeGreaterThan(reef.drone);
    expect(abyss.drone).toBeGreaterThan(wreck.drone * 2);
    expect(wreck.bedCutoff).toBeLessThan(reef.bedCutoff);
    expect(abyss.bedCutoff).toBeLessThan(wreck.bedCutoff);
    expect(abyss.droneFreq).toBeLessThan(reef.droneFreq);
    expect(abyss.sfxCutoff).toBeLessThan(reef.sfxCutoff);
  });

  it('changes gradually with depth — no sudden switch at a zone boundary', () => {
    let prev = ambienceMix(under(0));
    for (let d = 10; d <= 4400; d += 10) {
      const m = ambienceMix(under(d));
      expect(Math.abs(m.drone - prev.drone)).toBeLessThan(0.01);
      expect(Math.abs(m.bed - prev.bed)).toBeLessThan(0.01);
      expect(Math.abs(m.enclosure - prev.enclosure)).toBeLessThan(0.02);
      expect(Math.abs(m.bedCutoff - prev.bedCutoff)).toBeLessThan(5);
      expect(m.sfxCutoff / prev.sfxCutoff).toBeGreaterThan(0.98);
      prev = m;
    }
  });

  it('closes in inside the wreck, when out of air, and on blackout', () => {
    expect(ambienceMix(under(WRECK, { insideWreck: true })).enclosure).toBeGreaterThan(ambienceMix(under(WRECK)).enclosure);
    expect(ambienceMix(under(WRECK, { drowning: 1 })).sfxCutoff).toBeLessThan(ambienceMix(under(WRECK)).sfxCutoff);
    expect(ambienceMix(under(WRECK, { fade: 1 })).master).toBeLessThan(0.2);
  });
});

describe('ambient events', () => {
  it('belong to their zones: creaks around the wreck, distant calls only in the abyss', () => {
    expect(ambientEventRates(SURFACE_ENV)).toEqual({ bubbles: 0, creaks: 0, calls: 0 });
    expect(ambientEventRates(under(REEF)).creaks).toBe(0);
    expect(ambientEventRates(under(WRECK)).creaks).toBeGreaterThan(0);
    expect(ambientEventRates(under(REEF)).calls).toBe(0);
    expect(ambientEventRates(under(DEPTH_ZONES.abyss + 1500)).calls).toBeGreaterThan(0);
  });

  it('stay sparse everywhere', () => {
    for (let d = 0; d <= 4400; d += 100) {
      const r = ambientEventRates(under(d, { insideWreck: d > 1400 && d < 1800 }));
      expect(r.bubbles + r.creaks + r.calls).toBeLessThan(0.4);
    }
  });
});

describe('oxygen warnings', () => {
  it('escalate from silence, to a slow cue, to a quickening pulse — never a constant beep', () => {
    expect(warningInterval('ok', 1)).toBeNull();
    expect(warningInterval('empty', 0)).toBeNull(); // the heartbeat takes over
    const low = warningInterval('low', 0.3)!;
    const critical = warningInterval('critical', 0.14)!;
    const dire = warningInterval('critical', 0.02)!;
    expect(low).toBeGreaterThan(critical);
    expect(critical).toBeGreaterThan(dire);
    expect(dire).toBeGreaterThanOrEqual(1);
  });

  it('fin strokes quicken with effort', () => {
    expect(strokeInterval(1)).toBeLessThan(strokeInterval(0.3));
  });
});

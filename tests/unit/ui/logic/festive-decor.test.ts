import { describe, expect, it } from 'vitest';
import gameConfig from '../../../../src/config/game-config.json';
import {
  type FestiveConfig,
  FESTIVE_DECOR,
  decorSpots,
  festiveDecorFor,
  lightRun,
  mapDecorOn,
  sagWire,
} from '../../../../src/ui/logic/festive';

const config = gameConfig as unknown as FestiveConfig;
/** The map's path wave (map.ts pathX: SWING 0.24, WAVE 7). */
const pathX = (lv: number) => 0.5 + 0.24 * Math.sin(((lv - 1) * 2 * Math.PI) / 7);

describe('mapDecorOn (sprint 31, festive.mapDecor)', () => {
  it('shows from 1 to 31 December, UTC', () => {
    expect(mapDecorOn('2026-12-01', config)).toBe(true);
    expect(mapDecorOn('2026-12-12', config)).toBe(true);
    expect(mapDecorOn('2026-12-31', config)).toBe(true);
  });

  it('is off on 30 November and 1 January', () => {
    expect(mapDecorOn('2026-11-30', config)).toBe(false);
    expect(mapDecorOn('2027-01-01', config)).toBe(false);
  });

  it('is off when the flag is false or missing', () => {
    expect(mapDecorOn('2026-12-12', { festive: { from: '12-01', to: '12-31', mapDecor: false } })).toBe(false);
    expect(mapDecorOn('2026-12-12', { festive: { from: '12-01', to: '12-31' } })).toBe(false);
    expect(mapDecorOn('2026-12-12', {})).toBe(false);
  });
});

describe('festiveDecorFor: the decorations take turns band by band', () => {
  it('is deterministic and always one of the decorations', () => {
    for (let band = 0; band < 40; band++) {
      for (let slot = 0; slot < 4; slot++) {
        expect(FESTIVE_DECOR).toContain(festiveDecorFor(band, slot));
        expect(festiveDecorFor(band, slot)).toBe(festiveDecorFor(band, slot));
      }
    }
  });

  it('rotates through every decoration within a band and starts each band one further on', () => {
    expect(festiveDecorFor(0, 0)).toBe('tree');
    expect(festiveDecorFor(0, 1)).toBe('snowman');
    expect(festiveDecorFor(0, 2)).toBe('presents');
    expect(festiveDecorFor(1, 0)).toBe('snowman');
    for (let band = 0; band < 20; band++) {
      expect(new Set([0, 1, 2].map((slot) => festiveDecorFor(band, slot))).size).toBe(FESTIVE_DECOR.length);
      expect(festiveDecorFor(band + 1, 0)).not.toBe(festiveDecorFor(band, 0));
    }
  });
});

describe('decorSpots: decorations stand where the path is far from the land', () => {
  it('places them between two stones that both sit well over to the right', () => {
    expect(decorSpots(1, 20, pathX, 0.65)).toEqual([3, 10, 17]);
    for (const lv of decorSpots(381, 400, pathX, 0.65)) {
      expect(pathX(lv - 1)).toBeGreaterThanOrEqual(0.65);
      expect(pathX(lv)).toBeGreaterThanOrEqual(0.65);
    }
  });

  it('keeps them inside the band and off its first stone (the band name sits beside it)', () => {
    for (let band = 0; band < 30; band++) {
      const first = band * 20 + 1;
      const spots = decorSpots(first, first + 19, pathX, 0.65);
      expect(spots.length).toBeGreaterThanOrEqual(2);
      for (const lv of spots) {
        expect(lv - 1).toBeGreaterThanOrEqual(first);
        expect(lv).toBeLessThanOrEqual(first + 19);
      }
    }
  });
});

describe('lightRun with hanging bulbs and keep-out boxes', () => {
  it('keeps the whole drop of each bulb out of the gap', () => {
    const a = [120, 600] as const;
    const b = [300, 470] as const;
    const run = lightRun(a, b, 34, 21, 15, 11);
    expect(run.bulbs.length).toBeGreaterThan(0);
    for (const [x, y] of run.wire) {
      for (const c of [a, b]) {
        const nearestY = Math.min(y + 11, Math.max(y, c[1]));
        expect(Math.hypot(x - c[0], nearestY - c[1])).toBeGreaterThanOrEqual(34);
      }
    }
  });

  it('never puts a wire point or its drop inside an avoid box', () => {
    const box = [250, 470, 330, 540] as const;
    const run = lightRun([120, 600], [300, 420], 34, 21, 15, 11, [box]);
    for (const [x, y] of run.wire) expect(x >= box[0] && x <= box[2] && y <= box[3] && y + 11 >= box[1]).toBe(false);
  });

  it('matches the old behaviour with no drop and no boxes', () => {
    expect(lightRun([206, 900], [290, 820], 40, 26, 15, 0, [])).toEqual(lightRun([206, 900], [290, 820], 40, 26, 15));
  });
});

describe('sagWire: the string droops between bulbs', () => {
  it('droops a level stretch by twice the sag at the control point', () => {
    expect(sagWire([[0, 0], [20, 0]], 3)).toBe('M0.0 0.0Q10.0 6.0 20.0 0.0');
  });

  it('does not droop a straight-up stretch', () => {
    expect(sagWire([[0, 20], [0, 0]], 3)).toBe('M0.0 20.0Q0.0 10.0 0.0 0.0');
  });

  it('draws one curve per pair, skipping repeated points, and nothing for fewer than two', () => {
    const d = sagWire([[0, 0], [10, 5], [10, 5], [25, 8]], 2);
    expect(d.match(/Q/g)?.length).toBe(2);
    expect(sagWire([[5, 5]], 2)).toBe('');
    expect(sagWire([], 2)).toBe('');
  });
});

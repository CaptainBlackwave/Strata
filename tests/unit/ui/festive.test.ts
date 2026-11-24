// @ts-expect-error node:fs types are not installed (as style-art.test.ts)
import { readFileSync as readFs } from 'node:fs';
import { describe, expect, it } from 'vitest';
import gameConfig from '../../../src/config/game-config.json';
import { type FestiveConfig, festiveActive, festiveScenesFirst, lightRun, mapLightsOn } from '../../../src/ui/logic/festive';
import { HOLLY, hollySprigSvg, svgCssUrl } from '../../../src/ui/style-art';
import { SPARKLE, sparklesShow } from '../../../src/ui/fx-plan';

const readFileSync = readFs as (path: URL, enc: string) => string;
const config = gameConfig as unknown as FestiveConfig;
const css = readFileSync(new URL('../../../src/ui/style.css', import.meta.url), 'utf8');

describe('festiveActive (D241, UTC MM-DD window)', () => {
  it('runs from 1 to 31 December inclusive, every year', () => {
    expect(festiveActive('2026-11-30', config)).toBe(false);
    expect(festiveActive('2026-12-01', config)).toBe(true);
    expect(festiveActive('2026-12-25', config)).toBe(true);
    expect(festiveActive('2026-12-31', config)).toBe(true);
    expect(festiveActive('2027-01-01', config)).toBe(false);
    expect(festiveActive('2030-12-15', config)).toBe(true);
  });

  it('handles a window crossing the year end', () => {
    const wrap: FestiveConfig = { festive: { from: '12-20', to: '01-02' } };
    expect(festiveActive('2026-12-19', wrap)).toBe(false);
    expect(festiveActive('2026-12-20', wrap)).toBe(true);
    expect(festiveActive('2027-01-02', wrap)).toBe(true);
    expect(festiveActive('2027-01-03', wrap)).toBe(false);
  });

  it('is off without a festive block or with a malformed date', () => {
    expect(festiveActive('2026-12-12', {})).toBe(false);
    expect(festiveActive('garbage', config)).toBe(false);
  });

  it('map lights follow the window and the mapLights switch', () => {
    expect(mapLightsOn('2026-12-12', config)).toBe(true);
    expect(mapLightsOn('2026-11-30', config)).toBe(false);
    expect(mapLightsOn('2026-12-12', { festive: { from: '12-01', to: '12-31', mapLights: false } })).toBe(false);
  });
});

describe('festiveScenesFirst', () => {
  it('lists the configured scenes in order, and none without a block', () => {
    expect(festiveScenesFirst(config)).toEqual(['wintersnow', 'winterlights']);
    expect(festiveScenesFirst({})).toEqual([]);
  });
});

describe('lightRun: the map lights keep clear of the stones (level-map.md §2.4)', () => {
  const pairs: [readonly [number, number], readonly [number, number]][] = [
    [[206, 900], [290, 820]],
    [[110, 500], [110, 420]],
    [[300, 300], [120, 220]],
  ];
  it('no wire point or bulb comes within the gap of either stone', () => {
    for (const [a, b] of pairs) {
      const run = lightRun(a, b, 40, 26, 15);
      for (const p of [...run.wire, ...run.bulbs]) {
        expect(Math.hypot(p[0] - a[0], p[1] - a[1])).toBeGreaterThanOrEqual(40);
        expect(Math.hypot(p[0] - b[0], p[1] - b[1])).toBeGreaterThanOrEqual(40);
      }
      expect(run.bulbs.length).toBeGreaterThan(0);
    }
  });

  it('draws nothing when the stones are too close for a light', () => {
    expect(lightRun([100, 100], [110, 120], 40, 26, 15)).toEqual({ wire: [], bulbs: [] });
  });

  it('is deterministic', () => {
    expect(lightRun([206, 900], [290, 820], 40, 26, 15)).toEqual(lightRun([206, 900], [290, 820], 40, 26, 15));
  });
});

describe('the Holly cap art (D239)', () => {
  it('style.css carries the same sprig the canvas draws (one drawing for both boards)', () => {
    expect(css).toContain(`--holly-sprig: ${svgCssUrl(hollySprigSvg())};`);
  });

  it('reads by shape: two spiky leaves and three round berries with a pale outline', () => {
    expect(HOLLY.leaves).toHaveLength(2);
    expect(HOLLY.berries).toHaveLength(3);
    expect((HOLLY.leaf.match(/Q/g) ?? []).length).toBeGreaterThanOrEqual(8);
    expect(hollySprigSvg()).toContain(`stroke='${HOLLY.colours.outline}'`);
  });

  it('the festive board and the holly piece both wear the sprig', () => {
    expect(css).toContain(":is([data-cork='holly'], #board.festive-board) .jar .cork::after");
    expect(css).toMatch(/\[data-cork='holly'\],\n#board\.festive-board \{/);
  });
});

describe('New Tide sparkles (D240)', () => {
  it('show only when asked, with motion allowed and the tab visible', () => {
    expect(sparklesShow({ reduced: false, hidden: false }, true)).toBe(true);
    expect(sparklesShow({ reduced: true, hidden: false }, true)).toBe(false);
    expect(sparklesShow({ reduced: false, hidden: true }, true)).toBe(false);
    expect(sparklesShow({ reduced: false, hidden: false }, false)).toBe(false);
  });

  it('stay a few, within the scene-layer budget', () => {
    expect(SPARKLE.count).toBeLessThanOrEqual(20);
    expect(SPARKLE.fps).toBeLessThanOrEqual(30);
  });
});

// Story: production/sprints/sprint-7.md B7 (owner decision D36, design/gdd/systems-index.md)
//
// Level length per band, in solver pours (`solutionLength` of the generated board), against
// the targets in `generator.pourBands` of game-config.json. Generates every level from 1 to
// LAST_LEVEL once (about 6 s on the dev container), not a sample.
//
// RE-BASELINE WHEN THE SOLVER CHANGES. `solutionLength` is the first path the DFS solver
// finds, not the optimum, so it depends on the solver's move order (`orderedMoves`). A change
// there changes every pour count and every board the length cap re-deals. Re-run
// `SWEEP_TO=200 npx vite-node tools/balance/difficulty-sweep.ts`, check the bands against D36,
// and update production/qa/sprint-7/difficulty-sweep.md (see its Caveats).
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { generateLevel } from '../../../src/core/generator';
import type { GameConfig } from '../../../src/core/levels';

const cfg = config as unknown as GameConfig;
/** The sweep's range (difficulty-sweep.md covers 1-200). */
const LAST_LEVEL = 200;

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const bands = [...(cfg.generator.pourBands ?? [])].sort((a, b) => a.from - b.from);
const pours = new Map<number, number>();
for (let level = 1; level <= LAST_LEVEL; level++) pours.set(level, generateLevel(level, cfg).solutionLength);

describe('level length bands (D36)', () => {
  it('config defines the D36 bands, starting at level 1', () => {
    expect(bands.length).toBeGreaterThan(0);
    expect(bands[0].from).toBe(1);
  });

  for (const [i, band] of bands.entries()) {
    const to = Math.min(LAST_LEVEL, (bands[i + 1]?.from ?? Infinity) - 1);
    const levels = Array.from({ length: to - band.from + 1 }, (_, k) => band.from + k);
    const ps = levels.map((l) => pours.get(l) ?? NaN);

    it(`levels ${band.from}-${to}: median pours are at most ${band.median}`, () => {
      expect(median(ps)).toBeLessThanOrEqual(band.median);
    });

    it(`levels ${band.from}-${to}: no level needs more than ${band.max} pours`, () => {
      const over = levels.filter((l) => (pours.get(l) ?? Infinity) > band.max).map((l) => `${l}:${pours.get(l)}`);
      expect(over).toEqual([]);
    });
  }
});

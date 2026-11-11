// Story: production/sprints/sprint-15.md G1, G2 (owner decisions D125-D132).
// The simulated player (tools/balance/sim-player.ts) gets stuck on few boards up to level 150 and
// meets today's hardest boards only near level 500. Stuck means it gave up after PATIENCE pours and
// Undos without a booster. Levels are sampled (every STEP-th) to keep the test fast.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { generateLevel } from '../../../src/core/generator';
import { type GameConfig, levelSpec, mechanicChance, spareOneChance } from '../../../src/core/levels';
import { simPlay } from '../../../tools/balance/sim-player';

const cfg = config as unknown as GameConfig;
/** The simulated player's patience: pours plus Undos before it gives up (D132). */
const PATIENCE = 150;

/** The share of sampled levels in `from`-`to` (every `step`-th) where the simulated player got stuck. */
function stuckRate(from: number, to: number, step: number): number {
  let n = 0;
  let stuck = 0;
  for (let l = from; l <= to; l += step) {
    n++;
    if (!simPlay(generateLevel(l, cfg).board, PATIENCE).won) stuck++;
  }
  return stuck / n;
}

describe('the simulated player (D132)', () => {
  it('is deterministic', () => {
    const b = generateLevel(77, cfg).board;
    expect(simPlay(b, PATIENCE)).toEqual(simPlay(b, PATIENCE));
  });
  it('wins the first levels, and gives up when out of patience', () => {
    for (let l = 1; l <= 10; l++) expect(simPlay(generateLevel(l, cfg).board, PATIENCE).won, `level ${l}`).toBe(true);
    expect(simPlay(generateLevel(5, cfg).board, 0).won).toBe(false);
  });
});

describe('stuck rate targets (sprint 15)', () => {
  const rates: Record<string, number> = {};
  it('levels 1-150: at most 1 board in 20', () => {
    rates.a = stuckRate(1, 150, 3);
    expect(rates.a).toBeLessThanOrEqual(0.05);
  }, 120_000);
  it('levels 151-200: at most 15%', () => {
    rates.b = stuckRate(151, 200, 2);
    expect(rates.b).toBeLessThanOrEqual(0.15);
  }, 120_000);
  it('levels 201-300: at most 30%', () => {
    rates.c = stuckRate(201, 300, 3);
    expect(rates.c).toBeLessThanOrEqual(0.3);
  }, 120_000);
  it('levels 301-400 stay below today\'s late rate (about 70%)', () => {
    expect(stuckRate(301, 400, 10)).toBeLessThan(0.6);
  }, 120_000);
});

describe('the curve (D128-D131)', () => {
  const colors = (l: number) => levelSpec(l, cfg).colors;
  it('colours: 9 at 30, 10 at 70, 11 at 250, 12 at 340, 13 at 420, 14 at 490', () => {
    const steps: [number, number][] = [[29, 8], [31, 9], [69, 9], [71, 10], [249, 10], [251, 11], [339, 11], [341, 12], [419, 12], [421, 13], [489, 13], [491, 14]];
    for (const [l, want] of steps) expect(colors(l), `level ${l}`).toBe(want);
  });
  it('hidden sand: one layer until 150, two from 150, three from 450', () => {
    expect([12, 31, 149].map((l) => levelSpec(l, cfg).buriedDepth)).toEqual([1, 1, 1]);
    expect([151, 449].map((l) => levelSpec(l, cfg).buriedDepth)).toEqual([2, 2]);
    expect(levelSpec(451, cfg).buriedDepth).toBe(3);
  });
  it('two ordinary empty jars until 300; the swap rises from 10% to 75% at 500', () => {
    for (let l = 1; l < 300; l++) expect(spareOneChance(l, cfg), `level ${l}`).toBe(0);
    expect(spareOneChance(300, cfg)).toBeCloseTo(0.1);
    expect(spareOneChance(500, cfg)).toBeCloseTo(0.75);
    for (let l = 1; l < 300; l++) if (!levelSpec(l, cfg).challenge) expect(levelSpec(l, cfg).spare, `level ${l}`).toBe(2);
  });
  it('special jars: 1 in 3 until 250, 1 in 2 at 500, two on a board from 250; debuts unchanged', () => {
    expect(mechanicChance(100, cfg)).toBeCloseTo(0.34);
    expect(mechanicChance(250, cfg)).toBeCloseTo(0.34);
    expect(mechanicChance(500, cfg)).toBeCloseTo(0.5);
    expect(cfg.mechanics.comboFrom).toBe(250);
    expect(cfg.mechanics.list.map((m) => m.unlockAt)).toEqual([21, 41, 61, 81, 101, 141, 181]);
  });
});

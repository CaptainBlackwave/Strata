// Story: production/sprints/sprint-30.md S1 (D232, Beads strata-m4f). The simulated player's view of a
// lighthouse jar (design/gdd/jar-mechanics.md §2.10): a dark jar's units are unknown, like buried
// sand, until the beam lights it or it is sealed. `{ darkAware: false }` is the sprint 15-29 player.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { type Board, type Jar, makeBoard } from '../../../src/core/board';
import { generateLevel } from '../../../src/core/generator';
import type { GameConfig } from '../../../src/core/levels';
import { score, simPlay, unseen, visible } from '../../../tools/balance/sim-player';

const cfg = config as unknown as GameConfig;
const DARK = { every: 4, left: 4, lit: false } as const;
const LIT = { every: 4, left: 4, lit: true } as const;

/** `board` with jar `i` made a lighthouse jar with the beam `beam`. */
function withLighthouse(board: Board, i: number, beam: NonNullable<Jar['lighthouse']>): Board {
  return { ...board, jars: board.jars.map((j, k) => (k === i ? { ...j, lighthouse: beam } : j)) };
}

describe("the simulated player's view of a lighthouse jar (D232)", () => {
  // Capacity 3. Jar 0 is the lighthouse jar, jar 1 has one buried unit, jar 2 is full of one colour.
  const base = makeBoard(3, [[1, 2, 2], [2, 1, 1], [3, 3, 3], []], [0, 1, 0, 0]);

  it('a dark jar shows no colours, like buried sand', () => {
    const b = withLighthouse(base, 0, DARK);
    expect(unseen(b, 0)).toBe(3);
    expect(visible(b, 0)).toEqual([]);
  });
  it('a lit jar shows its colours', () => {
    const b = withLighthouse(base, 0, LIT);
    expect(unseen(b, 0)).toBe(0);
    expect(visible(b, 0)).toEqual([1, 2, 2]);
  });
  it('a sealed jar shows its colours for good, even with the beam dark', () => {
    const b = withLighthouse(base, 2, DARK);
    expect(visible(b, 2)).toEqual([3, 3, 3]);
  });
  it('an empty dark jar has nothing to hide', () => {
    const b = withLighthouse(base, 3, DARK);
    expect(unseen(b, 3)).toBe(0);
    expect(visible(b, 3)).toEqual([]);
  });
  it('buried sand in other jars stays buried either way', () => {
    const b = withLighthouse(base, 0, DARK);
    expect(visible(b, 1)).toEqual([1, 1]);
    expect(visible(b, 1, false)).toEqual([1, 1]);
  });
  it('the old player (darkAware false) sees a dark jar', () => {
    const b = withLighthouse(base, 0, DARK);
    expect(unseen(b, 0, false)).toBe(0);
    expect(visible(b, 0, false)).toEqual([1, 2, 2]);
  });
});

describe('its choices use no dark colour (D232)', () => {
  // Capacity 4. Jar 0 (top run 2, 2) can stack onto jar 1 (top 2) or go to the empty jar 2.
  const base = makeBoard(4, [[1, 2, 2], [1, 2], [], [1, 1]]);

  it('a pour out of a dark jar is blind: no credit for a match it cannot see', () => {
    const b = withLighthouse(base, 0, DARK);
    expect(score(b, 0, 1)).toBe(0);
    expect(score(b, 0, 2)).toBe(-1);
    expect(score(b, 0, 1, false)).toBe(score(base, 0, 1));
    expect(score(b, 0, 1, false)).toBeGreaterThan(0);
  });
  it('a pour into a dark jar gets no credit for a match or a one-colour fill', () => {
    const dark = withLighthouse(base, 3, DARK);
    const lit = withLighthouse(base, 3, LIT);
    // Jar 0's run of two 1s onto jar 3 (1, 1) stacks a match and fills it with one colour: seen only when lit.
    const plain = makeBoard(4, [[2, 1, 1], [], [3], [1, 1]]);
    expect(score(withLighthouse(plain, 3, DARK), 0, 3)).toBeLessThan(score(withLighthouse(plain, 3, LIT), 0, 3));
    expect(score(withLighthouse(plain, 3, LIT), 0, 3)).toBe(score(plain, 0, 3));
    expect(score(dark, 1, 0)).toBe(score(lit, 1, 0)); // a pour between two lit jars is unchanged
  });
  it('it still pours into and out of a dark jar and can win', () => {
    const b = withLighthouse(makeBoard(2, [[1, 2], [2, 1], [], []]), 0, DARK);
    expect(simPlay(b, 50).won).toBe(true);
    expect(simPlay(b, 50)).toEqual(simPlay(b, 50));
  });
  it('plays a board with no lighthouse jar exactly like the old player', () => {
    for (const l of [77, 305, 350]) {
      const b = generateLevel(l, cfg).board;
      expect(b.jars.some((j) => j.lighthouse), `level ${l}`).toBe(false);
      expect(simPlay(b, 150), `level ${l}`).toEqual(simPlay(b, 150, { darkAware: false }));
    }
  }, 60_000);
});

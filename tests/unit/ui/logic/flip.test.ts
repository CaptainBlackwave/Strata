// Story: production/sprints/sprint-13.md M1 (hourglass jar UI, D96). Design: design/gdd/jar-mechanics.md 2.4.
// When each hourglass flip plays after a pour, and which units of the target jar grow in.
import { describe, expect, it } from 'vitest';
import { FLIP_MS, flipDelay, grownFrom } from '../../../../src/ui/logic/flip';

/** The pour's phases after the board changes (ms): the same shape as ANIM in src/ui/state.ts. */
const ANIM = { flow: 230, streamOut: 90, back: 220 };

describe('flipDelay', () => {
  it('an hourglass poured out of flips once it is home: after the flow, the stream and the flight back', () => {
    expect(flipDelay(2, 2, false, ANIM)).toBe(230 + 90 + 220);
  });
  it('an hourglass poured into, or one elsewhere on the board, flips once the sand has landed', () => {
    expect(flipDelay(5, 2, false, ANIM)).toBe(230);
  });
  it('under reduced motion nothing waits: the new order is simply drawn', () => {
    expect(flipDelay(2, 2, true, ANIM)).toBe(0);
    expect(flipDelay(5, 2, true, ANIM)).toBe(0);
  });
});

describe('grownFrom', () => {
  it('the poured units grow in on top of a jar that did not flip', () => {
    expect(grownFrom(1, 4, 2, [])).toBe(2);
    expect(grownFrom(1, 4, 2, [3])).toBe(2);
  });
  it('a target that flipped has its poured units at the bottom now, so nothing grows in', () => {
    expect(grownFrom(1, 4, 2, [1])).toBe(Infinity);
  });
});

describe('FLIP_MS', () => {
  it('is quick: under half a second, so play never waits on it', () => {
    expect(FLIP_MS).toBeGreaterThan(0);
    expect(FLIP_MS).toBeLessThanOrEqual(500);
  });
});

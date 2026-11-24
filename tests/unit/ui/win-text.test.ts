// Design: design/gdd/level-map.md §2.1 Replays (D50): the win card says "New best" only for a lower pour count.
import { describe, expect, it } from 'vitest';
import { t } from '../../../src/ui/strings';

describe('winText', () => {
  it('a first clear is a new best', () => {
    expect(t.winText(21, undefined)).toBe('21 pours · new best');
  });
  it('equalling the best is not a new best', () => {
    expect(t.winText(11, 11)).toBe('11 pours · best 11');
  });
  it('a worse count shows the best', () => {
    expect(t.winText(30, 21)).toBe('30 pours · best 21');
  });
  it('a lower count leaves the line plain; the "New best: X pours" change line says it', () => {
    expect(t.winText(18, 21)).toBe('18 pours');
    expect(t.newBest(18)).toBe('New best: 18 pours');
  });
  // Beads strata-yha: a one-pour win read "1 pours".
  it('a single pour is singular', () => {
    expect(t.winText(1, undefined)).toBe('1 pour · new best');
    expect(t.winText(1, 1)).toBe('1 pour · best 1');
    expect(t.winText(1, 3)).toBe('1 pour');
    expect(t.newBest(1)).toBe('New best: 1 pour');
  });
});

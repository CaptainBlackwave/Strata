// Story: production/sprints/sprint-13.md M3 (clam jar UI, D96). Design: design/gdd/jar-mechanics.md 2.6.
// When a clam's shell swings open after the pour that opened it, and what is drawn on the shell.
import { describe, expect, it } from 'vitest';
import { CLAM_OPEN_MS, clamOpenDelay, shellCount } from '../../../../src/ui/logic/clam';

/** The pour's phases after the board changes (ms): the same shape as ANIM in src/ui/state.ts. */
const ANIM = { flow: 230, streamOut: 90, back: 220 };

describe('clamOpenDelay', () => {
  it('opens once the sand of the opening pour has landed (a clam is never that pour’s jar)', () => {
    expect(clamOpenDelay(false, ANIM)).toBe(230);
  });
  it('reduced motion: no wait, and no motion (the open jar is simply drawn)', () => {
    expect(clamOpenDelay(true, ANIM)).toBe(0);
  });
  it('the opening is short and calm', () => {
    expect(CLAM_OPEN_MS).toBeGreaterThanOrEqual(300);
    expect(CLAM_OPEN_MS).toBeLessThanOrEqual(700);
  });
});

describe('shellCount', () => {
  it('a closed clam shows its pours left; any other jar shows nothing', () => {
    expect(shellCount({ units: [0], hidden: 0, clam: 6 })).toBe('6');
    expect(shellCount({ units: [0], hidden: 0, clam: 1 })).toBe('1');
    expect(shellCount({ units: [0], hidden: 0 })).toBe('');
  });
});

// Story: production/sprints/sprint-28.md S2, S3 (the sieve is a goal: its dead-end message, words and goal mark; D215, D216).
// Design: design/gdd/jar-mechanics.md 2.5.
import { describe, expect, it } from 'vitest';
// @ts-expect-error node:fs types are not installed (as in style-art.test.ts)
import { readFileSync as readFs } from 'node:fs';
import { jarSummary } from '../../../src/ui/logic/jar-label';
import { t } from '../../../src/ui/strings';

const read = (rel: string) => (readFs as (path: URL, enc: string) => string)(new URL(rel, import.meta.url), 'utf8');
const css = read('../../../src/ui/style.css');
const jars = read('../../../src/ui/screens/jars.ts');
const name = (c: number) => ['terracotta', 'saffron', 'coral'][c];

describe('sieve goal: words (S3, D216)', () => {
  it('the intro card and the Jar guide say to fill it to finish', () => {
    expect(t.mechanics.sieve.rule).toContain('Fill it with that colour to finish');
    expect(t.mechanics.sieve.tap).toContain('to finish');
  });

  it('the screen reader names the goal while the sieve is open, and that it is sealed once filled', () => {
    expect(jarSummary({ units: [0, 2], hidden: 0, sieve: 2 }, false, name, 4)).toBe('terracotta, coral (sieve, coral only, fill it with coral to finish)');
    expect(jarSummary({ units: [], hidden: 0, sieve: 2 }, false, name, 4)).toBe('empty (sieve, coral only, fill it with coral to finish)');
    expect(jarSummary({ units: [2, 2, 2, 2], hidden: 0, sieve: 2 }, true, name, 4)).toBe('coral, coral, coral, coral (sieve, coral only, sealed)');
  });
});

describe('sieve dead end message (S2, D215)', () => {
  it('names the colour, capitalised, and still offers Undo and Restart', () => {
    expect(t.sieveLost('coral')).toBe('Coral was sealed outside its sieve: Undo or Restart.');
  });
});

describe('sieve goal mark (S3, D216)', () => {
  it('every jar carries the mark; it shows only on a sieve, an outline while open, filled with a tick once sealed', () => {
    expect(jars).toMatch(/SIEVE_BAND \+\s*SIEVE_GOAL \+/);
    expect(css).toMatch(/\.sieve-goal \{\s*display: none;/);
    expect(css).toMatch(/:is\(\.jar, \.mini-jar\)\.sieve \.sieve-goal \{\s*display: inline-flex;/);
    expect(css).toMatch(/\.sieve-goal \.sg-ring \{\s*fill: none;/);
    expect(css).toMatch(/\.jar\.sieve\.sealed \.sieve-goal \.sg-ring \{\s*fill: currentColor;/);
    expect(css).toMatch(/\.jar\.sieve\.sealed \.sieve-goal \.sg-tick \{\s*visibility: visible;/);
  });

  it('on the Realistic board it hides while its jar is carried off (the canvas carries a copy)', () => {
    expect(css).toContain("#board[data-render='gpu'] .jar.gpu-away .sieve-goal");
  });
});

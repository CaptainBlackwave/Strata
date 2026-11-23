// Story: production/sprints/sprint-29.md N4 (look and moments). Design: design/gdd/jar-mechanics.md §2.11 (D223).
// The pure bits of the sunrise and sunset jars' look: which half-sun, open or filled, the classes the
// DOM toggles, the dusk win's test, the moments' timings and reduced motion, and the redraw keys.
// @ts-expect-error node:fs types are not installed (as in style-art.test.ts)
import { readFileSync as readFs } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { type Board, type Jar } from '../../../src/core/board';
import {
  DUSK_FADE_MS,
  SUN_BOX,
  SUN_CLASSES,
  SUN_PATHS,
  SUNRISE_MS,
  SUNRISE_PEAK,
  duskFade,
  hasSunset,
  sunClasses,
  sunMark,
  sunrisePlays,
  sunriseFrames,
} from '../../../src/ui/logic/sun';
import { domDrawKeys, jarKey } from '../../../src/ui/board-gpu/dirty';

const css = (readFs as (path: URL, enc: string) => string)(new URL('../../../src/ui/style.css', import.meta.url), 'utf8');
const CAP = 4;
const jar = (units: number[], extra: Partial<Jar> = {}): Jar => ({ units, hidden: 0, ...extra });
const rise = (band: number) => ({ sun: { band, at: 'rise' as const } });
const set = (band: number) => ({ sun: { band, at: 'set' as const } });
const board = (...jars: Jar[]): Board => ({ capacity: CAP, jars });

describe('sunMark: which half-sun, open or filled (D223)', () => {
  it('is null for a jar that is not a sun jar', () => {
    expect(sunMark(jar([0, 0, 0, 0]), CAP)).toBeNull();
    expect(sunMark(jar([1], { sieve: 1 }), CAP)).toBeNull();
  });
  it('a sunrise jar shows the rising half-sun, a sunset jar the setting one', () => {
    expect(sunMark(jar([], rise(2)), CAP)?.at).toBe('rise');
    expect(sunMark(jar([], set(3)), CAP)?.at).toBe('set');
    expect(sunMark(jar([], set(3)), CAP)?.band).toBe(3);
  });
  it('is open until the jar is filled in its band, then filled', () => {
    expect(sunMark(jar([], rise(2)), CAP)?.filled).toBe(false);
    expect(sunMark(jar([2, 2, 2], rise(2)), CAP)?.filled).toBe(false); // one short
    expect(sunMark(jar([0, 1, 2, 2], rise(2)), CAP)?.filled).toBe(false); // dealt mixed sand
    expect(sunMark(jar([2, 2, 2, 2], rise(2)), CAP)?.filled).toBe(true);
  });
  it('a complete jar in another colour never shows filled (a hand-made board)', () => {
    expect(sunMark(jar([1, 1, 1, 1], set(2)), CAP)?.filled).toBe(false);
  });
});

describe('sunClasses: what the jar button wears', () => {
  it('nothing on an ordinary jar', () => {
    expect(sunClasses(jar([0, 1]), CAP)).toEqual([]);
  });
  it('sun and its role, plus sun-filled once filled', () => {
    expect(sunClasses(jar([1], rise(1)), CAP)).toEqual(['sun', 'sun-rise']);
    expect(sunClasses(jar([1, 1, 1, 1], rise(1)), CAP)).toEqual(['sun', 'sun-rise', 'sun-filled']);
    expect(sunClasses(jar([], set(0)), CAP)).toEqual(['sun', 'sun-set']);
  });
  it('only ever returns classes listed in SUN_CLASSES, so a redraw can clear them all', () => {
    for (const j of [jar([], rise(0)), jar([0, 0, 0, 0], rise(0)), jar([], set(1)), jar([1, 1, 1, 1], set(1))]) {
      for (const c of sunClasses(j, CAP)) expect(SUN_CLASSES).toContain(c);
    }
  });
});

describe('hasSunset: the dusk win (D223)', () => {
  it('is true only for a board with a sunset jar', () => {
    expect(hasSunset(board(jar([0, 0, 0, 0], rise(0)), jar([1, 1, 1, 1], set(1))))).toBe(true);
    expect(hasSunset(board(jar([0, 0, 0, 0], rise(0)), jar([1, 1, 1, 1])))).toBe(false);
    expect(hasSunset(board(jar([0, 0, 0, 0]), jar([1, 1, 1, 1], { sieve: 1 })))).toBe(false);
  });
});

describe('the half-sun glyph (drawn for Strata)', () => {
  it('rising and setting differ only in the arrow: up for sunrise, down for sunset', () => {
    expect(SUN_PATHS.rise).not.toBe(SUN_PATHS.set);
    // Both arrows run from y 1.4 to 6.4; the rising one's head is at the top (2 up), the setting one's at the foot.
    expect(SUN_PATHS.rise).toMatch(/l2-2 2 2$/);
    expect(SUN_PATHS.set).toMatch(/l2 2 2-2$/);
  });
  it('the half-sun sits on the horizon line, inside the box', () => {
    const horizonY = Number(/^M[\d.]+ ([\d.]+)/.exec(SUN_PATHS.horizon)![1]);
    const discY = Number(/^M[\d.]+ ([\d.]+)/.exec(SUN_PATHS.disc)![1]);
    expect(discY).toBe(horizonY);
    expect(horizonY).toBeLessThan(SUN_BOX.height);
  });
});

describe('the moments: timings and reduced motion (D223)', () => {
  it('the sunrise brightening goes up, holds and fades out, opacity only', () => {
    const f = sunriseFrames();
    expect(f[0]).toEqual({ opacity: 0, offset: 0 });
    expect(f[f.length - 1]).toEqual({ opacity: 0, offset: 1 });
    expect(Math.max(...f.map((k) => Number(k.opacity)))).toBe(SUNRISE_PEAK);
    for (const k of f) expect(Object.keys(k).sort()).toEqual(['offset', 'opacity']);
    expect(SUNRISE_PEAK).toBeLessThanOrEqual(0.6); // soft: the board never washes out
  });
  it('is calm: about a second, never long (D68)', () => {
    expect(SUNRISE_MS).toBeGreaterThanOrEqual(600);
    expect(SUNRISE_MS).toBeLessThanOrEqual(1500);
  });
  it('the sunrise plays nothing under reduced motion or on a hidden tab', () => {
    expect(sunrisePlays({ reduced: false, hidden: false })).toBe(true);
    expect(sunrisePlays({ reduced: true, hidden: false })).toBe(false);
    expect(sunrisePlays({ reduced: false, hidden: true })).toBe(false);
  });
  it('the dusk tint is instant under reduced motion', () => {
    expect(duskFade(true)).toBe(0);
    expect(duskFade(false)).toBe(DUSK_FADE_MS);
  });
});

describe('redraws: a sun jar redraws when its role, band or fill changes', () => {
  const keys = (j: Jar) => domDrawKeys(j, { sealed: false, patterns: false, unitHeight: 30 });
  it('the canvas key carries the role and band', () => {
    expect(jarKey(jar([], rise(2)))).not.toBe(jarKey(jar([])));
    expect(jarKey(jar([], rise(2)))).not.toBe(jarKey(jar([], set(2))));
    expect(jarKey(jar([], rise(2)))).not.toBe(jarKey(jar([], rise(3))));
    expect(jarKey(jar([], { sieve: 2 }))).not.toBe(jarKey(jar([], rise(2))));
  });
  it('the DOM key changes when the jar is filled (the mark fills in)', () => {
    const open = jar([2, 2, 2], rise(2));
    const filled = jar([2, 2, 2, 2], rise(2));
    expect(keys(open).rest).not.toBe(domDrawKeys(filled, { sealed: true, patterns: false, unitHeight: 30 }).rest);
  });
  it('an ordinary jar keeps its key (boards without the pair are unchanged)', () => {
    expect(jarKey(jar([0, 1], { hidden: 1 }))).toBe('0,1|1');
  });
});

describe('style.css draws the band and mark, distinct from the sieve', () => {
  it('has the band, the mark and both arrows', () => {
    expect(css).toMatch(/:is\(\.jar, \.mini-jar\)\.sun \.sun-band \{/);
    expect(css).toMatch(/:is\(\.jar, \.mini-jar\)\.sun \.sun-mark \{/);
    expect(css).toMatch(/\.sun-rise \.sun-mark \.sm-rise/);
    expect(css).toMatch(/\.sun-set \.sun-mark \.sm-set/);
    expect(css).toMatch(/\.sun-filled \.sun-mark \.sm-disc \{\s*fill: currentColor;/);
  });
  it('the sun band is flush with the jar and has no mesh (the sieve collar overhangs with one)', () => {
    const rule = /:is\(\.jar, \.mini-jar\)\.sun \.sun-band \{([^}]*)\}/.exec(css)![1];
    expect(rule).toMatch(/left: 1px;/);
    expect(rule).toMatch(/right: 1px;/);
    expect(rule).not.toMatch(/repeating-linear-gradient/);
  });
  it('the Realistic board hides the DOM band (the canvas draws it) but keeps the mark over the canvas', () => {
    expect(css).toMatch(/#board\[data-render='gpu'\] \.jar \.sun-band,/);
    expect(css).not.toMatch(/#board\[data-render='gpu'\] \.jar \.sun-mark,/);
    expect(css).toMatch(/#board\[data-render='gpu'\] \.jar\.gpu-away \.sun-mark,/);
  });
  it('has the sunrise light and the dusk tint', () => {
    expect(css).toMatch(/\.sun-dawn \{/);
    expect(css).toMatch(/\.win\.dusk::before \{/);
  });
});

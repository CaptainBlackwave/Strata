// Story: production/sprints/sprint-27.md K4 (look) and K5 (intro and help). Design: design/gdd/jar-mechanics.md §2.10.
// The lighthouse jar is a card mechanic: its intro card, map badge, screen-reader text (no colour
// while dark, D209) and announcement, and the pure bits of its look (the count, dark sand, the sweep).
// @ts-expect-error node:fs types are not installed (as in style-art.test.ts)
import { readFileSync as readFs } from 'node:fs';
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { type Jar, isLit } from '../../../src/core/board';
import { type GameConfig, levelSpec, specMechanics } from '../../../src/core/levels';
import { type CollectionConfig } from '../../../src/core/collection';
import { specialsOf } from '../../../src/core/map';
import { jarSummary } from '../../../src/ui/logic/jar-label';
import { tapMechanic } from '../../../src/ui/logic/refusal';
import { BEAM_MS, beamCount, beamFrames, isDark, sweepsVisibly } from '../../../src/ui/logic/lighthouse';
import { domDrawKeys, jarKey } from '../../../src/ui/board-gpu/dirty';
import { type Rgb, paintGrid } from '../../../src/ui/board-gpu/paint';
import { gridFromJar } from '../../../src/ui/sand';
import { t } from '../../../src/ui/strings';

const css = (readFs as (path: URL, enc: string) => string)(new URL('../../../src/ui/style.css', import.meta.url), 'utf8');
const cfg = config as unknown as GameConfig & CollectionConfig;
const colour = (c: number) => cfg.palette[c].id;
const jar = (units: number[], extra: Partial<Jar> = {}): Jar => ({ units, hidden: 0, ...extra });
const beam = (left: number, lit = false, every = 4) => ({ lighthouse: { every, left, lit } });

describe('the lighthouse jar is a card mechanic (K5)', () => {
  it('has a final card, tap text and a map name', () => {
    expect(t.mechanics.lighthouse.name).toBe('Lighthouse jar');
    expect(t.mechanics.lighthouse.rule).toMatch(/fourth pour/);
    expect(t.mechanics.lighthouse.rule).toMatch(/until your next pour/);
    expect(t.mechanics.lighthouse.rule).toMatch(/stays lit once sealed/);
    expect(t.mechanics.lighthouse.tap.length).toBeGreaterThan(0);
    expect(t.map.jars.lighthouse).toBe('lighthouse jar');
  });
  it('the card says "fourth" because the config sweeps every 4 pours', () => {
    expect(cfg.mechanics.list.find((m) => m.id === 'lighthouse')?.every).toBe(4);
  });
  it('level 321 introduces the lighthouse jar alone, and its stone carries the "new jar" badge', () => {
    expect(specMechanics(levelSpec(321, cfg))).toEqual(['lighthouse']);
    expect(specialsOf(321, cfg).debut).toBe('lighthouse');
  });
  it('a lighthouse jar is liftable, so a tap on it needs no explanation', () => {
    expect(tapMechanic(jar([0, 1], beam(2)), false)).toBeNull();
  });
});

describe('screen-reader labels and announcement (K4, D209)', () => {
  it('a dark jar names its layers and the pours until it is lit, never a colour', () => {
    const s = jarSummary(jar([0, 1, 2], beam(2)), false, colour, 4);
    expect(s).toBe('3 layers (dark, lit in 2 pours)');
    for (const c of [0, 1, 2]) expect(s).not.toContain(colour(c));
    expect(jarSummary(jar([0], beam(1)), false, colour, 4)).toBe('1 layer (dark, lit after the next pour)');
    expect(jarSummary(jar([], beam(4)), false, colour, 4)).toBe('empty (dark, lit in 4 pours)');
  });
  it('a complete dark jar still wet does not say it is one colour', () => {
    expect(jarSummary(jar([3, 3, 3, 3], { ...beam(2), wet: [0, 0, 0, 2] }), false, colour, 4)).not.toMatch(/seals when dry/);
  });
  it('a lit jar lists its colours; a sealed one is lit for good', () => {
    expect(jarSummary(jar([0, 1], beam(4, true)), false, colour, 4)).toBe(`${colour(0)}, ${colour(1)} (lighthouse jar, lit until the next pour)`);
    expect(jarSummary(jar([2, 2, 2, 2], beam(3)), true, colour, 4)).toBe(`${Array(4).fill(colour(2)).join(', ')} (lighthouse jar, lit for good, sealed)`);
  });
  it('a sweep is announced', () => {
    expect(t.beamAnnounce(2)).toBe('The beam lit jar 2.');
  });
});

describe('dark sand, the count and the sweep (K4)', () => {
  it('dark is exactly not lit: a dark lighthouse jar, never a lit, sealed or ordinary one', () => {
    expect(isDark(jar([0, 1], beam(2)), 4)).toBe(true);
    expect(isDark(jar([0, 1], beam(4, true)), 4)).toBe(false);
    expect(isDark(jar([1, 1, 1, 1], beam(2)), 4)).toBe(false);
    expect(isDark(jar([0, 1]), 4)).toBe(false);
    expect(isDark(jar([0, 1], beam(2)), 4)).toBe(!isLit(jar([0, 1], beam(2)), 4));
  });
  it('the count shows the pours until lit, and nothing once sealed', () => {
    expect(beamCount(jar([0, 1], beam(3)), 4)).toBe('3');
    expect(beamCount(jar([2, 2, 2, 2], beam(3)), 4)).toBe('');
    expect(beamCount(jar([0]), 4)).toBe('');
  });
  it('the redraw keys change with the beam: the Classic sand (dark or not), the Realistic jar key', () => {
    const d = { sealed: false, patterns: true, unitHeight: 30 };
    expect(domDrawKeys(jar([1, 2], beam(4, true)), d).sand).not.toBe(domDrawKeys(jar([1, 2], beam(3)), d).sand);
    expect(domDrawKeys(jar([1, 2], beam(3)), d).rest).not.toBe(domDrawKeys(jar([1, 2], beam(2)), d).rest);
    expect(jarKey(jar([1], beam(4, true)))).not.toBe(jarKey(jar([1], beam(4))));
    expect(jarKey(jar([1], beam(3)))).not.toBe(jarKey(jar([1], beam(2))));
  });
  it('the Realistic board paints dark sand in one colour: two different stacks look the same', () => {
    const dims = { cols: 8, rows: 16 };
    const palette: Rgb[] = cfg.palette.map(() => ({ r: 200, g: 100, b: 50 })).map((c, i) => ({ ...c, g: i * 15 }));
    const dark: Rgb = { r: 46, g: 58, b: 77 };
    const paint = (units: number[]) => {
      const out = new Uint32Array(dims.cols * 2 * dims.rows * 2);
      paintGrid(gridFromJar(jar(units), 4, dims, 5), palette, dark, out, 2, { dark });
      return out;
    };
    expect([...paint([0, 1, 2, 3])]).toEqual([...paint([3, 3, 1, 0])]);
  });
  it('the sweep wipes the cover from the left in step with the light band; an empty jar has nothing to sweep', () => {
    const f = beamFrames();
    expect(f.cover[0]).toEqual({ clipPath: 'inset(0 0 0 0%)' });
    expect(f.cover.at(-1)).toEqual({ clipPath: 'inset(0 0 0 100%)' });
    expect(f.band[0].transform).toBe('translateX(-110%)');
    expect(BEAM_MS).toBe(600);
    expect(sweepsVisibly(jar([]))).toBe(false);
    expect(sweepsVisibly(jar([0]))).toBe(true);
  });
  it('style.css draws dark sand with no "?", the mark, the accent at 1 and hides the mark on a jar carried off', () => {
    expect(css).toMatch(/\.unit\.dark \{[^}]*--dark-sand/);
    expect(css).not.toMatch(/\.unit\.dark::after/);
    expect(css).toMatch(/:is\(\.jar, \.mini-jar\)\.lighthouse \.lh-mark \{/);
    expect(css).toMatch(/\.jar\.lighthouse\[data-beam='1'\] \.lh-mark \{[^}]*--accent-text/);
    expect(css).toMatch(/\.jar\.gpu-away \.lh-mark/);
  });
});

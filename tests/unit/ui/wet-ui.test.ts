// Story: production/sprints/sprint-23.md W4 (look) and W5 (intro and help). Design: design/gdd/jar-mechanics.md §2.7.
// Wet sand is a card mechanic: its intro card, map badge, screen-reader text, refusal toast, and
// the pure bits of its look (the damp tone, which rows are wet, which units just dried).
// @ts-expect-error node:fs types are not installed (as in style-art.test.ts)
import { readFileSync as readFs } from 'node:fs';
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { type Board, type Jar, pour, pourRefusal } from '../../../src/core/board';
import { type GameConfig, levelSpec, specMechanics } from '../../../src/core/levels';
import { type CollectionConfig } from '../../../src/core/collection';
import { specialsOf } from '../../../src/core/map';
import { jarSummary } from '../../../src/ui/logic/jar-label';
import { refusalNote, tapMechanic } from '../../../src/ui/logic/refusal';
import { driedUnits, dryDelay, wetCount, wetHex, wetLeft, wetRgb, wetRows } from '../../../src/ui/logic/wet';
import { domDrawKeys, jarKey } from '../../../src/ui/board-gpu/dirty';
import { paintGrid } from '../../../src/ui/board-gpu/paint';
import { gridFromJar } from '../../../src/ui/sand';
import { t } from '../../../src/ui/strings';

const css = (readFs as (path: URL, enc: string) => string)(new URL('../../../src/ui/style.css', import.meta.url), 'utf8');
const cfg = config as unknown as GameConfig & CollectionConfig;
const colour = (c: number) => cfg.palette[c].id;
const jar = (units: number[], extra: Partial<Jar> = {}): Jar => ({ units, hidden: 0, ...extra });
const board = (...jars: Jar[]): Board => ({ capacity: 4, jars });

describe('wet sand is a card mechanic (W5)', () => {
  it('has a card, a map name and a jar state', () => {
    for (const s of [t.mechanics.wet.name, t.mechanics.wet.rule, t.mechanics.wet.tap]) expect(s.length).toBeGreaterThan(0);
    expect(t.mechanics.wet.name).toBe('Wet sand');
    expect(t.map.jars.wet).toBe('wet sand');
    expect(t.jarStates.wet).toBe('full, seals when dry');
  });
  it('level 201 introduces wet sand alone, and its stone carries the "new jar" badge', () => {
    expect(specMechanics(levelSpec(201, cfg))).toEqual(['wet']);
    expect(specialsOf(201, cfg).debut).toBe('wet');
  });
  it('specMechanics lists wet sand last', () => {
    expect(specMechanics({ mechanics: ['frozen'], clam: true, wet: true })).toEqual(['frozen', 'clam', 'wet']);
  });
});

describe('the refusal toast (W5)', () => {
  it("wet sand towards an empty jar gets its own note and toast", () => {
    const b = board(jar([0, 1], { wet: [0, 3] }), jar([]));
    expect(pourRefusal(b, 0, 1)).toBe('wet');
    expect(refusalNote('wet', false)).toBe('wet');
    expect(t.wetRefused).toBe('Wet sand only goes onto its own colour.');
  });
  it('other notes are unchanged', () => {
    expect(refusalNote('colour', false)).toBe('colour');
    expect(refusalNote('full', true)).toBe('sealed');
    expect(refusalNote('same', false)).toBeNull();
  });
  it('a wet jar is liftable, so a tap on it needs no explanation', () => {
    expect(tapMechanic(jar([0, 1], { wet: [0, 2] }), false)).toBeNull();
  });
});

describe('screen-reader labels (W4)', () => {
  it('a wet unit names its pours left, and units are listed with semicolons', () => {
    expect(jarSummary(jar([0, 1], { wet: [0, 3] }), false, colour, 4)).toBe(`${colour(0)}; wet ${colour(1)}, dries in 3 pours`);
    expect(jarSummary(jar([1], { wet: [1] }), false, colour, 4)).toBe(`wet ${colour(1)}, dries after the next pour`);
  });
  it('a dry jar reads as before', () => {
    expect(jarSummary(jar([0, 1]), false, colour, 4)).toBe(`${colour(0)}, ${colour(1)}`);
    expect(jarSummary(jar([0, 1], { wet: [0, 0] }), false, colour, 4)).toBe(`${colour(0)}, ${colour(1)}`);
  });
  it('a complete jar still wet says it seals when dry; a sealed one says sealed', () => {
    expect(jarSummary(jar([2, 2, 2, 2], { wet: [0, 0, 0, 2] }), false, colour, 4)).toMatch(/\(full, seals when dry\)$/);
    expect(jarSummary(jar([2, 2, 2, 2]), true, colour, 4)).toMatch(/\(sealed\)$/);
  });
  it('a pour that dries sand is announced', () => {
    expect(t.dryAnnounce(3)).toBe('Sand dried (jar 3).');
  });
});

describe('the damp tone (W4)', () => {
  it('is darker than the dry colour, channel by channel', () => {
    for (const p of cfg.palette) {
      const n = parseInt(p.hex.slice(1), 16);
      const w = parseInt(wetHex(p.hex).slice(1), 16);
      for (const sh of [16, 8, 0]) expect((w >> sh) & 255, p.id).toBeLessThanOrEqual((n >> sh) & 255);
      expect(wetHex(p.hex)).not.toBe(p.hex.toLowerCase());
    }
  });
  it('wetHex and wetRgb agree', () => {
    const c = wetRgb({ r: 200, g: 85, b: 61 });
    expect(wetHex('#c8553d')).toBe(`#${[c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, '0')).join('')}`);
  });
  it('counts wet units and their pours left', () => {
    const j = jar([0, 1, 1], { wet: [0, 2, 4] });
    expect(wetCount(j)).toBe(2);
    expect(wetLeft(j, 2)).toBe(4);
    expect(wetLeft(jar([0]), 0)).toBe(0);
  });
});

describe('what the Realistic board draws (W4)', () => {
  it('wetRows marks the bands of wet units, bottom first, in place', () => {
    const out = new Uint8Array(12).fill(7);
    expect(wetRows(jar([0, 1], { wet: [0, 2] }), 3, out)).toBe(true);
    expect([...out]).toEqual([0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0]);
    expect(wetRows(jar([0, 1]), 3, out)).toBe(false);
    expect([...out].every((v) => v === 0)).toBe(true);
  });
  it('paintGrid paints wet rows from the damp palette', () => {
    const dims = { cols: 2, rows: 4 };
    const j = jar([0, 0], { wet: [0, 3] });
    const grid = gridFromJar(j, 2, dims, 1);
    const palette = [{ r: 200, g: 120, b: 80 }];
    const wetPal = palette.map(wetRgb);
    const rows = new Uint8Array(4);
    wetRows(j, 2, rows);
    const dry = new Uint32Array(32);
    const wet = new Uint32Array(32);
    paintGrid(grid, palette, { r: 0, g: 0, b: 0 }, dry, 2);
    paintGrid(grid, palette, { r: 0, g: 0, b: 0 }, wet, 2, { wet: { rows, palette: wetPal } });
    const red = (px: number) => px & 255;
    // 2 cols x 4 rows at 2 texels per cell: 4 x 8 texels. The top unit (rows 0..1, texels 0..15)
    // is wet and darker; the bottom unit is untouched.
    for (let t0 = 0; t0 < 16; t0++) expect(red(wet[t0])).toBeLessThan(red(dry[t0]));
    for (let t0 = 16; t0 < 32; t0++) expect(wet[t0]).toBe(dry[t0]);
  });
  it('the redraw keys change when sand dries, and not for a board without wet sand', () => {
    expect(jarKey(jar([0, 1]))).toBe('0,1|0');
    expect(jarKey(jar([0, 1], { wet: [0, 2] }))).not.toBe(jarKey(jar([0, 1])));
    expect(jarKey(jar([0, 1], { wet: [0, 2] }))).toBe(jarKey(jar([0, 1], { wet: [0, 1] })));
    const d = { sealed: false, patterns: false, unitHeight: 30 };
    expect(domDrawKeys(jar([0, 1]), d).sand).toBe('0,1|0|p0');
    expect(domDrawKeys(jar([0, 1], { wet: [0, 2] }), d).sand).not.toBe(domDrawKeys(jar([0, 1], { wet: [0, 1] }), d).sand);
  });
});

describe('the drying shimmer (W4)', () => {
  it('finds the units that dried, where they are after the pour', () => {
    const before = board(jar([0, 1, 1], { wet: [0, 1, 4] }), jar([1]), jar([2, 3], { wet: [1, 0] }), jar([]));
    const r = pour(before, 0, 1);
    expect(r.dried).toEqual([1, 2]);
    // Moved: the two lagoon units (counts 1 and 4) land on jar 1 at indices 1 and 2; the one at 1 dried.
    expect(driedUnits(before, r.board, { move: { from: 0, to: 1 }, moved: r.moved, dried: r.dried })).toEqual([
      { jar: 1, units: [1] },
      { jar: 2, units: [0] },
    ]);
  });
  it('a partial pour leaves a drying unit in the source', () => {
    const before = board(jar([0, 0], { wet: [1, 3] }), jar([1, 1, 0]), jar([]));
    const r = pour(before, 0, 1);
    expect(r.moved).toBe(1);
    expect(driedUnits(before, r.board, { move: { from: 0, to: 1 }, moved: r.moved, dried: r.dried })).toEqual([{ jar: 0, units: [0] }]);
  });
  it('nothing when no jar dried or the board changed shape', () => {
    const b = board(jar([0]), jar([]));
    expect(driedUnits(b, b, { move: { from: 0, to: 1 }, moved: 1 })).toEqual([]);
    expect(driedUnits(b, board(jar([0])), { move: { from: 0, to: 1 }, moved: 1, dried: [0] })).toEqual([]);
  });
  it('waits for the sand to land, and is off under reduced motion', () => {
    expect(dryDelay(false, { flow: 230 })).toBe(230);
    expect(dryDelay(true, { flow: 230 })).toBeNull();
  });
  it('style.css draws the mark, the shimmer, and shows them over the Realistic board', () => {
    expect(css).toMatch(/\.unit\.wet \{/);
    expect(css).toMatch(/\.wet-mark \{/);
    expect(css).toMatch(/\.dry-shimmer \{/);
    expect(css).toMatch(/#board\[data-render='gpu'\] \.jar \.wet-mark,/);
  });
});

// Story: production/sprints/sprint-27.md K4 (look) and K5 (intro and help). Design: design/gdd/jar-mechanics.md §2.9.
// The crab is a card mechanic: its intro card, map badge, refusal, screen-reader text and
// announcement, and the pure bits of its look (the count, the scuttle).
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
import { CRAB_MS, crabCount, scuttleFrames, scuttleFrom } from '../../../src/ui/logic/crab';
import { domDrawKeys, jarKey } from '../../../src/ui/board-gpu/dirty';
import { t } from '../../../src/ui/strings';

const css = (readFs as (path: URL, enc: string) => string)(new URL('../../../src/ui/style.css', import.meta.url), 'utf8');
const cfg = config as unknown as GameConfig & CollectionConfig;
const colour = (c: number) => cfg.palette[c].id;
const jar = (units: number[], extra: Partial<Jar> = {}): Jar => ({ units, hidden: 0, ...extra });
const board = (...jars: Jar[]): Board => ({ capacity: 4, jars });
const crab = (left: number, every = 3) => ({ crab: { every, left } });

describe('the crab is a card mechanic (K5)', () => {
  it('has a final card, tap text and a map name', () => {
    expect(t.mechanics.crab.name).toBe('Crab jar');
    expect(t.mechanics.crab.rule).toMatch(/pour into that jar, but not out of it/);
    expect(t.mechanics.crab.rule).toMatch(/third pour/);
    expect(t.mechanics.crab.rule).toMatch(/never sits on a sealed jar/);
    expect(t.mechanics.crab.tap).toBe('The crab is on that jar.');
    expect(t.map.jars.crab).toBe('crab jar');
  });
  it('the card says "third" because the config moves it every 3 pours', () => {
    expect(cfg.mechanics.list.find((m) => m.id === 'crab')?.every).toBe(3);
  });
  it('level 281 introduces the crab alone, and its stone carries the "new jar" badge', () => {
    expect(specMechanics(levelSpec(281, cfg))).toEqual(['crab']);
    expect(specialsOf(281, cfg).debut).toBe('crab');
  });
});

describe('the refusal when its jar is lifted (K5)', () => {
  it('a tap on the crab\'s jar explains the crab; it is a source-side reason, so refusalNote has none', () => {
    const b = board(jar([0, 1], crab(2)), jar([1]));
    expect(pourRefusal(b, 0, 1)).toBe('crab');
    expect(refusalNote('crab', false)).toBeNull();
    expect(tapMechanic(b.jars[0], false)).toBe('crab');
  });
  it('a jar shut by its own mechanic explains that first; a narrow jar with the crab explains the crab', () => {
    expect(tapMechanic(jar([0], { frozen: true, ...crab(2) }), false)).toBe('frozen');
    expect(tapMechanic(jar([0], { clam: 3, ...crab(2) }), false)).toBe('clam');
    expect(tapMechanic(jar([0], { cap: 2, ...crab(2) }), false)).toBe('crab');
  });
  it('pouring into the crab\'s jar is allowed, so it needs no note', () => {
    expect(pourRefusal(board(jar([1]), jar([0, 1], crab(2))), 0, 1)).toBeNull();
  });
});

describe('screen-reader labels and announcement (K4)', () => {
  it('names the pours until the crab moves', () => {
    expect(jarSummary(jar([0, 1], crab(3)), false, colour, 4)).toBe(`${colour(0)}, ${colour(1)} (crab on this jar, moves in 3 pours)`);
    expect(jarSummary(jar([0], crab(1)), false, colour, 4)).toBe(`${colour(0)} (crab on this jar, moves after the next pour)`);
  });
  it('a step is announced with the new jar', () => {
    expect(t.crabAnnounce(4)).toBe('The crab moved to jar 4.');
  });
  it('a pour that runs the count out reports the step the board animates', () => {
    // Jar 2 (index 1) is emptied by the pour, so the crab skips it for jar 3 (index 2).
    const r = pour(board(jar([2], crab(1)), jar([1]), jar([0, 1]), jar([])), 1, 2);
    expect(r.crabMoved).toEqual({ from: 0, to: 2 });
    expect(r.board.jars[2].crab).toEqual({ every: 3, left: 3 });
  });
});

describe('the count and the scuttle (K4)', () => {
  it('shows the pours left on the crab, and nothing on a jar without it', () => {
    expect(crabCount(jar([0], crab(2)))).toBe('2');
    expect(crabCount(jar([0]))).toBe('');
  });
  it('the Classic and Realistic redraw keys change with the crab and its count', () => {
    const d = { sealed: false, patterns: false, unitHeight: 30 };
    expect(domDrawKeys(jar([1, 1], crab(3)), d).rest).not.toBe(domDrawKeys(jar([1, 1], crab(2)), d).rest);
    expect(domDrawKeys(jar([1, 1], crab(3)), d).sand).toBe(domDrawKeys(jar([1, 1], crab(2)), d).sand);
    expect(jarKey(jar([1], crab(3)))).not.toBe(jarKey(jar([1])));
    expect(jarKey(jar([1], crab(3)))).not.toBe(jarKey(jar([1], crab(2))));
  });
  it('the scuttle starts on the old jar and ends exactly in place, in little hops', () => {
    const from = scuttleFrom({ x: 10, y: 120 }, { x: 90, y: 120 });
    expect(from).toEqual({ x: -80, y: 0 });
    const f = scuttleFrames(from);
    expect(f[0]).toEqual({ offset: 0, transform: 'translate(-80px, 0px) rotate(0deg)' });
    expect(f.at(-1)).toEqual({ offset: 1, transform: 'translate(0px, 0px) rotate(0deg)' });
    expect(f).toHaveLength(9);
    expect(f[1].transform).toBe('translate(-70px, -3px) rotate(-7deg)');
    expect(f[3].transform).toMatch(/rotate\(7deg\)$/);
    expect(CRAB_MS).toBeGreaterThan(300);
    expect(CRAB_MS).toBeLessThan(800);
  });
  it('style.css draws the crab on the rim, its count pill and the accent at 1', () => {
    expect(css).toMatch(/:is\(\.jar, \.mini-jar\)\.crab \.crab-mark \{/);
    expect(css).toMatch(/\.jar\.crab\[data-crab='1'\] \.crab-mark b \{[^}]*--accent-text/);
  });
});

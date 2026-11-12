// Story: production/sprints/sprint-24.md T4 (look) and T5 (intro and help). Design: design/gdd/jar-mechanics.md §2.8.
// The tide jar is a card mechanic: its intro card, map badge, screen-reader text and announcement,
// and the pure bits of its look (the count, when the rise shows, where each unit starts it).
// @ts-expect-error node:fs types are not installed (as in style-art.test.ts)
import { readFileSync as readFs } from 'node:fs';
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { type Board, type Jar, isSealed, pour, riseByOne } from '../../../src/core/board';
import { type GameConfig, levelSpec, specMechanics } from '../../../src/core/levels';
import { type CollectionConfig } from '../../../src/core/collection';
import { specialsOf } from '../../../src/core/map';
import { jarSummary } from '../../../src/ui/logic/jar-label';
import { tapMechanic } from '../../../src/ui/logic/refusal';
import { afterTurn, riseFrom, risesVisibly, tideCount, TIDE_MS } from '../../../src/ui/logic/tide';
import { driedUnits } from '../../../src/ui/logic/wet';
import { flipDelay, grownFrom } from '../../../src/ui/logic/flip';
import { domDrawKeys } from '../../../src/ui/board-gpu/dirty';
import { t } from '../../../src/ui/strings';

const css = (readFs as (path: URL, enc: string) => string)(new URL('../../../src/ui/style.css', import.meta.url), 'utf8');
const cfg = config as unknown as GameConfig & CollectionConfig;
const colour = (c: number) => cfg.palette[c].id;
const jar = (units: number[], extra: Partial<Jar> = {}): Jar => ({ units, hidden: 0, ...extra });
const board = (...jars: Jar[]): Board => ({ capacity: 4, jars });
const tide = (left: number, every = 4) => ({ tide: { every, left } });

describe('the tide jar is a card mechanic (T5)', () => {
  it('has a final card, tap text and a map name', () => {
    for (const s of [t.mechanics.tide.name, t.mechanics.tide.rule, t.mechanics.tide.tap]) expect(s.length).toBeGreaterThan(0);
    expect(t.mechanics.tide.name).toBe('Tide jar');
    expect(t.mechanics.tide.rule).toMatch(/fourth pour/);
    expect(t.mechanics.tide.rule).toMatch(/sealed tide jar stays still/);
    expect(t.map.jars.tide).toBe('tide jar');
  });
  it('the card says "fourth" because the config turns it every 4 pours', () => {
    expect(cfg.mechanics.list.find((m) => m.id === 'tide')?.every).toBe(4);
  });
  it('level 241 introduces the tide jar alone, and its stone carries the "new jar" badge', () => {
    expect(specMechanics(levelSpec(241, cfg))).toEqual(['tide']);
    expect(specialsOf(241, cfg).debut).toBe('tide');
  });
  it('a tide jar is liftable, so a tap on it needs no explanation (no refusal of its own)', () => {
    expect(tapMechanic(jar([0, 1], tide(2)), false)).toBeNull();
  });
});

describe('screen-reader labels and announcement (T4)', () => {
  it('names the pours until the tide turns', () => {
    expect(jarSummary(jar([0, 1], tide(3)), false, colour, 4)).toBe(`${colour(0)}, ${colour(1)} (tide jar, turns in 3 pours)`);
    expect(jarSummary(jar([0, 1], tide(1)), false, colour, 4)).toBe(`${colour(0)}, ${colour(1)} (tide jar, turns after the next pour)`);
    expect(jarSummary(jar([], tide(4)), false, colour, 4)).toBe('empty (tide jar, turns in 4 pours)');
  });
  it('a sealed tide jar is still and has no count', () => {
    const j = jar([2, 2, 2, 2], tide(2));
    expect(isSealed(j, 4)).toBe(true);
    expect(jarSummary(j, true, colour, 4)).toBe(`${Array(4).fill(colour(2)).join(', ')} (tide jar, still, sealed)`);
  });
  it('a turn is announced', () => {
    expect(t.tideAnnounce(3)).toBe('The tide turned (jar 3).');
  });
});

describe('the count on the wave mark (T4)', () => {
  it('shows the pours left, and nothing once sealed or on another jar', () => {
    expect(tideCount(jar([0, 1], tide(2)), 4)).toBe('2');
    expect(tideCount(jar([2, 2, 2, 2], tide(2)), 4)).toBe('');
    expect(tideCount(jar([0, 1]), 4)).toBe('');
  });
  it('the Classic redraw key changes with the count, even when the sand is the same', () => {
    const d = { sealed: false, patterns: false, unitHeight: 30 };
    expect(domDrawKeys(jar([1, 1], tide(4)), d).rest).not.toBe(domDrawKeys(jar([1, 1], tide(3)), d).rest);
    expect(domDrawKeys(jar([1, 1], tide(4)), d).sand).toBe(domDrawKeys(jar([1, 1], tide(3)), d).sand);
  });
  it('style.css draws the mark, the accent at 1, the faded still jar, and hides it on a jar carried off', () => {
    expect(css).toMatch(/:is\(\.jar, \.mini-jar\)\.tide \.tide-mark \{/);
    expect(css).toMatch(/\.jar\.tide\[data-tide='1'\] \.tide-mark \{[^}]*--accent-text/);
    expect(css).toMatch(/\.jar\.tide\.tide-still \.tide-mark \{[^}]*opacity/);
    expect(css).toMatch(/\.jar\.gpu-away \.tide-mark/);
  });
});

describe('the rise (T4)', () => {
  it('plays only when the turn can be seen: 2+ units, not all one colour', () => {
    expect(risesVisibly(jar([0, 1]))).toBe(true);
    expect(risesVisibly(jar([1, 1, 1]))).toBe(false);
    expect(risesVisibly(jar([1]))).toBe(false);
    expect(risesVisibly(jar([]))).toBe(false);
  });
  it('starts each unit where it was before the turn', () => {
    const n = 4;
    const after = riseByOne([10, 11, 12, 13]); // [11, 12, 13, 10]
    for (let k = 0; k < n; k++) {
      const was = k + riseFrom(k, n); // its place before the turn
      expect([10, 11, 12, 13][was]).toBe(after[k]);
    }
    expect(riseFrom(3, 4)).toBe(-3);
    expect(riseFrom(0, 4)).toBe(1);
  });
  it('afterTurn matches the core turn', () => {
    expect(afterTurn([3, 0, 1])).toEqual(riseByOne([3, 0, 1]));
    expect(afterTurn([5])).toEqual([5]);
    expect(afterTurn([])).toEqual([]);
  });
  it('waits for the pour like the hourglass flip, and none under reduced motion', () => {
    const anim = { flow: 230, streamOut: 120, back: 190 };
    expect(flipDelay(2, 0, false, anim)).toBe(230);
    expect(flipDelay(0, 0, false, anim)).toBe(540);
    expect(flipDelay(2, 0, true, anim)).toBe(0);
    expect(TIDE_MS).toBeGreaterThan(0);
  });
  it('a target whose tide rose grows no units; others grow as before', () => {
    expect(grownFrom(1, 4, 2, [], [1])).toBe(Infinity);
    expect(grownFrom(1, 4, 2, [], [0])).toBe(2);
  });
  it('the pour reports the turn, and the turned order is what the board draws', () => {
    const before = board(jar([0, 1], tide(1)), jar([2]), jar([2]), jar([]));
    const r = pour(before, 1, 2);
    expect(r.turned).toEqual([0]);
    expect(r.board.jars[0].units).toEqual([1, 0]);
    expect(r.board.jars[0].tide).toEqual({ every: 4, left: 4 });
  });
});

describe('wet counts move with their units through a turn (T4, §2.8 rule 7)', () => {
  it('the drying shimmer finds the dried unit where the turn put it', () => {
    const before = board(jar([0, 1, 3], { ...tide(1), wet: [0, 1, 3] }), jar([2]), jar([2]), jar([]));
    const r = pour(before, 1, 2);
    expect(r.turned).toEqual([0]);
    // Lagoon (index 1, count 1) dried, then the tide lifted the stack: it now sits at index 0.
    expect(r.board.jars[0].units).toEqual([1, 3, 0]);
    expect(driedUnits(before, r.board, { move: { from: 1, to: 2 }, moved: r.moved, dried: r.dried, turned: r.turned })).toEqual([{ jar: 0, units: [0] }]);
  });
});

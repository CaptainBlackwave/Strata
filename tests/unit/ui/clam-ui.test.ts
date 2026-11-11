// Story: production/sprints/sprint-13.md M3 (clam jar UI, D96). Design: design/gdd/jar-mechanics.md 2.6.
// The clam is folded into MechanicId: its card, Jar guide entry, map debut badge, refusal and
// screen-reader name (its sand hidden while closed), while the daily and weekly still leave it
// out (isClassicMechanic) until W1.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
// @ts-expect-error node:fs types are not installed (as in style-art.test.ts)
import { readFileSync as readFs } from 'node:fs';
import { type CollectionConfig } from '../../../src/core/collection';
import { type Board, type Jar, isSealed, pourRefusal } from '../../../src/core/board';
import { type GameConfig, type MechanicId, isClassicMechanic, levelSpec, specMechanics } from '../../../src/core/levels';
import { specialsOf } from '../../../src/core/map';
import { jarSummary } from '../../../src/ui/logic/jar-label';
import { refusalNote, tapMechanic } from '../../../src/ui/logic/refusal';
import { t } from '../../../src/ui/strings';

/** style.css as text (CSS ?raw imports are empty under Vitest; style-art.test.ts reads it the same way). */
const css = (readFs as (path: URL, enc: string) => string)(new URL('../../../src/ui/style.css', import.meta.url), 'utf8');
const cfg = config as unknown as GameConfig & CollectionConfig;
const ids: MechanicId[] = cfg.mechanics.list.map((m) => m.id);
const colour = (c: number) => cfg.palette[c].id;
const jar = (units: number[], extra: Partial<Jar> = {}): Jar => ({ units, hidden: 0, ...extra });
const board = (...jars: Jar[]): Board => ({ capacity: 4, jars });

describe('the clam is a card mechanic (D96)', () => {
  it('every configured mechanic, the clam included, has a card, a map name and a jar state', () => {
    expect(ids).toContain('clam');
    for (const id of ids) {
      const card = (t.mechanics as Record<string, { name: string; rule: string; tap: string } | undefined>)[id];
      expect(card, id).toBeDefined();
      for (const s of [card!.name, card!.rule, card!.tap]) expect(s.length, id).toBeGreaterThan(0);
      expect(typeof (t.map.jars as Record<string, string>)[id], id).toBe('string');
      expect((t.jarStates as Record<string, unknown>)[id], id).toBeDefined();
    }
  });
  it('level 181 introduces the clam alone; LevelSpec.mechanics stays empty', () => {
    const spec = levelSpec(181, cfg);
    expect(spec.mechanics).toEqual([]);
    expect(specMechanics(spec)).toEqual(['clam']);
  });
  it('intro cards come classic first, then the hourglass, the sieve and the clam', () => {
    expect(specMechanics({ mechanics: ['frozen'], hourglass: true, sieve: true, clam: true })).toEqual(['frozen', 'hourglass', 'sieve', 'clam']);
    expect(specMechanics({ mechanics: ['narrow'], clam: true })).toEqual(['narrow', 'clam']);
  });
  it('the map shows its debut badge on level 181', () => {
    expect(specialsOf(181, cfg).debut).toBe('clam');
    expect(specialsOf(141, cfg).debut).toBe('sieve');
  });
  it('the Jar guide order is the config order, seven jars ending with the clam', () => {
    expect(ids).toHaveLength(7);
    expect(ids.slice(-3)).toEqual(['hourglass', 'sieve', 'clam']);
  });
  it('stays out of the daily rotation and the "all four special jars" count until W1', () => {
    expect(ids.filter(isClassicMechanic)).toEqual(['narrow', 'frozen', 'locked', 'funnel']);
  });
});

describe('clam strings (D96)', () => {
  it('the card names the clam and says what it does', () => {
    expect(t.mechanics.clam.name).toBe('Clam jar');
    expect(t.mechanics.clam.rule).toMatch(/stays shut under its shell.*every pour on the board counts down.*opens and plays like any jar\./);
    expect(t.map.jars.clam).toBe('clam');
  });
  it('the refusal says how many pours are left', () => {
    expect(t.clamRefused(3)).toBe('This clam opens in 3 pours.');
    expect(t.clamRefused(1)).toBe('This clam opens after the next pour.');
  });
  it('the screen reader hears it is closed and when it opens', () => {
    expect(t.jarStates.clam(3)).toBe('clam, closed, opens in 3 pours');
    expect(t.jarStates.clam(1)).toBe('clam, closed, opens after the next pour');
  });
  it('the opening is announced with its jar number', () => {
    expect(t.clamAnnounce(7)).toBe('The clam opened (jar 7).');
  });
});

describe('a closed clam refuses taps and pours (D96, §2.6)', () => {
  it('a pour into a closed clam gets the clam note, even onto a matching top', () => {
    const b = board(jar([1]), jar([0, 1], { clam: 3 }));
    expect(pourRefusal(b, 0, 1)).toBe('clam');
    expect(refusalNote(pourRefusal(b, 0, 1), isSealed(b.jars[1], b.capacity))).toBe('clam');
  });
  it('a tap on a closed clam explains the clam, full or empty', () => {
    expect(tapMechanic(jar([0, 1], { clam: 2 }), false)).toBe('clam');
    expect(tapMechanic(jar([], { clam: 2 }), false)).toBe('clam');
  });
  it('an opened clam is an ordinary jar: no note of its own', () => {
    expect(tapMechanic(jar([0, 1]), false)).toBeNull();
    expect(refusalNote(pourRefusal(board(jar([1]), jar([0, 0])), 0, 1), false)).toBe('colour');
  });
});

describe('jarSummary: the jar name a screen reader hears', () => {
  it('hides a closed clam’s sand: no colour is named', () => {
    const s = jarSummary(jar([0, 1, 2], { clam: 4 }), false, colour);
    expect(s).toBe('clam, closed, opens in 4 pours');
    for (const c of [0, 1, 2]) expect(s).not.toContain(colour(c));
    expect(s).not.toContain(t.buried);
  });
  it('lists the sand once the clam has opened', () => {
    expect(jarSummary(jar([0, 1], { hidden: 1 }), false, colour)).toBe(`${t.buried}, ${colour(1)}`);
  });
  it('keeps every other jar’s name as before', () => {
    expect(jarSummary(jar([]), false, colour)).toBe(t.jarEmpty);
    expect(jarSummary(jar([2], { sieve: 2 }), false, colour)).toBe(`${colour(2)} (${t.jarStates.sieve(colour(2))})`);
    expect(jarSummary(jar([1, 1, 1, 1]), true, colour)).toBe(`${Array(4).fill(colour(1)).join(', ')} (${t.sealed})`);
    expect(jarSummary(jar([0], { hourglass: { left: 2, every: 3 } } as Partial<Jar>), false, colour)).toBe(`${colour(0)} (${t.jarStates.hourglass(2)})`);
  });
});

describe('the clam shell art (style.css)', () => {
  it('draws a ribbed shell over the whole glass while closed, hidden on other jars', () => {
    expect(css).toMatch(/\.clam-shell \{\s*display: none;/);
    expect(css).toMatch(/:is\(\.jar, \.mini-jar\)\.clam \.clam-shell,\s*\.jar\.clam-opening \.clam-shell \{[^}]*z-index: 3;[^}]*height: calc\(var\(--jar-h\)/);
    expect(css).toMatch(/\.clam-ribs \{[^}]*repeating-conic-gradient\(/);
  });
  it('shows the count in a rem-sized pill in the scene colours, the accent at 1', () => {
    expect(css).toMatch(/\.clam-shell b \{[^}]*background: var\(--toast-bg\);[^}]*color: var\(--toast-fg\);[^}]*font-size: 0\.75rem;/);
    expect(css).toMatch(/\.jar\.clam\[data-clam='1'\] \.clam-shell b \{[^}]*var\(--accent-text\)/);
  });
});

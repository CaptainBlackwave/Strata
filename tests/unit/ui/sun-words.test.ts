// Story: production/sprints/sprint-29.md N5 (words and teaching). Design: design/gdd/jar-mechanics.md §2.11 (D218–D223).
// The sunrise and sunset jars' words: the three refusal notes, the tap text, the screen-reader
// labels and announcement, the two dead-end messages, and the intro card, Jar guide entry and map badge.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { type Board, type Jar, type LostReason, isSealed, pourRefusal } from '../../../src/core/board';
import { type GameConfig, levelSpec, specMechanics } from '../../../src/core/levels';
import { type CollectionConfig } from '../../../src/core/collection';
import { specialsOf } from '../../../src/core/map';
import { jarSummary } from '../../../src/ui/logic/jar-label';
import { lostMessage, refusalNote, tapMechanic } from '../../../src/ui/logic/refusal';
import { t } from '../../../src/ui/strings';

const cfg = config as unknown as GameConfig & CollectionConfig;
const colour = (c: number) => cfg.palette[c].id;
const jar = (units: number[], extra: Partial<Jar> = {}): Jar => ({ units, hidden: 0, ...extra });
const board = (...jars: Jar[]): Board => ({ capacity: 4, jars });
const rise = (band: number) => ({ sun: { band, at: 'rise' as const } });
const set = (band: number) => ({ sun: { band, at: 'set' as const } });
/** The note for pouring jar `from` into jar `to`, as the board's `explainRefusal` reads it. */
const noteFor = (b: Board, from = 0, to = 1) => refusalNote(pourRefusal(b, from, to), isSealed(b.jars[to], b.capacity));

describe('refusalNote: the three sun reasons (D223)', () => {
  it('each reason gives its own note', () => {
    expect(refusalNote('sun', false)).toBe('sun');
    expect(refusalNote('sunrise', false)).toBe('sunrise');
    expect(refusalNote('sunset', false)).toBe('sunset');
  });
  it('a sealed target still says it is sealed', () => {
    expect(refusalNote('sun', true)).toBe('sealed');
    expect(refusalNote('sunrise', true)).toBe('sealed');
    expect(refusalNote('sunset', true)).toBe('sealed');
  });
  it('the other reasons keep their notes', () => {
    expect(refusalNote('sieve', false)).toBe('sieve');
    expect(refusalNote('colour', false)).toBe('colour');
    expect(refusalNote('crab', false)).toBeNull();
    expect(refusalNote(null, false)).toBeNull();
  });
});

// These read the core rules (lane A of sprint 29 N1/N2): `pourRefusal` must give the reasons in §2.11 rule 7's order.
describe('refusalNote on a pair board (§2.11 rule 7)', () => {
  it('a wrong colour into a sunrise or sunset jar is the sun note, even into an empty one', () => {
    expect(noteFor(board(jar([0]), jar([], rise(1)), jar([], set(2))))).toBe('sun');
    expect(noteFor(board(jar([0]), jar([], set(1)), jar([], rise(2))))).toBe('sun');
  });
  it('a filled sunrise jar says it is sealed, whatever the colour', () => {
    expect(noteFor(board(jar([0]), jar([1, 1, 1, 1], rise(1)), jar([], set(2))))).toBe('sealed');
  });
  it('filling an ordinary jar before the sunrise jar is the sunrise note', () => {
    expect(noteFor(board(jar([0]), jar([0, 0, 0]), jar([], rise(1)), jar([], set(2))))).toBe('sunrise');
  });
  it('filling the sunset jar without winning is the sunset note', () => {
    const b = board(jar([2]), jar([2, 2, 2], set(2)), jar([1, 1, 1, 1], rise(1)), jar([0, 3]));
    expect(noteFor(b)).toBe('sunset');
  });
  it('filling the sunset jar before the sunrise jar gives the sunrise note (D219)', () => {
    expect(noteFor(board(jar([2]), jar([2, 2, 2], set(2)), jar([], rise(1))))).toBe('sunrise');
  });
});

describe('the toasts (D223)', () => {
  it('a wrong colour names the band and the jar\'s turn', () => {
    expect(t.sunRefused('lagoon', 'rise')).toBe('Only lagoon greets the sunrise.');
    expect(t.sunRefused('lagoon', 'set')).toBe('Only lagoon waits for sunset.');
  });
  it('a pour out of turn says which comes first', () => {
    expect(t.sunriseRefused).toBe('The sun hasn’t risen yet: fill the sunrise jar first.');
    expect(t.sunsetRefused).toBe('Sunset comes last: finish every other jar first.');
  });
});

describe('tapMechanic: a sunrise or sunset jar that can\'t be lifted', () => {
  it('an empty one explains the pair; a filled one is just sealed', () => {
    expect(tapMechanic(jar([], rise(1)), false)).toBe('sun');
    expect(tapMechanic(jar([], set(2)), false)).toBe('sun');
    expect(tapMechanic(jar([1, 1, 1, 1], rise(1)), true)).toBeNull();
  });
  it('the crab on it explains the crab first (D222)', () => {
    expect(tapMechanic(jar([0, 1], { ...rise(1), crab: { every: 3, left: 2 } }), false)).toBe('crab');
  });
  it('the tap text is the approved one', () => {
    expect(t.mechanics.sun.tap).toBe('Sunrise first, sunset last. Each takes only its own colour.');
  });
});

describe('screen-reader labels and announcement (D223)', () => {
  it('names the band and the turn', () => {
    expect(jarSummary(jar([], rise(1)), false, colour, 4)).toBe(`empty (sunrise jar, ${colour(1)} only, fill it first)`);
    expect(jarSummary(jar([0, 2], set(2)), false, colour, 4)).toBe(`${colour(0)}, ${colour(2)} (sunset jar, ${colour(2)} only, fill it last)`);
  });
  it('once filled it says so', () => {
    const c = colour(1);
    // Owner, 2026-11-23: a filled pair jar says "filled" only, not also "sealed".
    expect(jarSummary(jar([1, 1, 1, 1], rise(1)), true, colour, 4)).toBe(`${c}, ${c}, ${c}, ${c} (sunrise jar, ${c} only, filled)`);
  });
  it('other jars add nothing', () => {
    expect(jarSummary(jar([0]), false, colour, 4)).toBe(colour(0));
  });
  it('the pour that fills the sunrise jar is announced', () => {
    expect(t.sunriseAnnounce).toBe('The sun is up: the sunrise jar is filled.');
  });
});

describe('lostMessage: the dead ends (D221)', () => {
  const named = (reason: LostReason | null, band: number | null) => lostMessage(reason, () => band, colour);
  it('the sunrise and sunset dead ends name their band, capitalised', () => {
    const c = colour(1);
    const cap = `${c.charAt(0).toUpperCase()}${c.slice(1)}`;
    expect(named('sunrise', 1)).toBe(`${cap} can no longer reach the sunrise jar: Undo or Restart.`);
    expect(named('sunset', 1)).toBe(`${cap} was sealed outside the sunset jar: Undo or Restart.`);
  });
  it('asks the helper for the reason it is given', () => {
    const asked: string[] = [];
    lostMessage('sunset', (r) => (asked.push(r), 0), colour);
    expect(asked).toEqual(['sunset']);
  });
  it('falls back to the plain message when no colour is named', () => {
    expect(named('sunrise', null)).toBe(t.cantWin);
    expect(named('sunset', null)).toBe(t.cantWin);
  });
  it('the sieve keeps its message and the other reasons the plain one', () => {
    expect(named('sieve', 1)).toBe(t.sieveLost(colour(1)));
    expect(named('funnel', 1)).toBe(t.cantWin);
    expect(named('lock', 1)).toBe(t.cantWin);
    expect(named(null, 1)).toBe(t.cantWin);
  });
});

// These read the schedule (lane B of sprint 29 N3: the config entry and `specMechanics`).
describe('teaching: the intro card, the Jar guide and the map badge (D223)', () => {
  it('the card is one rule card with the approved words', () => {
    expect(t.mechanics.sun.name).toBe('Sunrise and sunset jars');
    // The GDD's one rule card line (§2.11 "Teaching"), word for word.
    expect(t.mechanics.sun.rule).toBe('The sunrise jar is filled first and the sunset jar last. Each takes only its own colour.');
    // The map badge names the pair, not one jar of it.
    expect(t.map.jars.sun).toBe('sunrise & sunset');
  });
  it('the Jar guide lists it, from 361 (it lists every configured mechanic)', () => {
    expect(cfg.mechanics.list.find((m) => m.id === 'sun')?.unlockAt).toBe(361);
  });
  it('level 361 introduces the pair alone, and its stone carries the "new jar" badge', () => {
    expect(specMechanics(levelSpec(361, cfg))).toEqual(['sun']);
    expect(specialsOf(361, cfg).debut).toBe('sun');
  });
});

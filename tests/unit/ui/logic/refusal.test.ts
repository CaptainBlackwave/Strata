// Story: production/sprints/sprint-13.md M2 (sieve jar UI, D96). Design: design/gdd/jar-mechanics.md 2.5.
// What the jar-tap feedback says: a refused pour's note, and a tapped jar's mechanic.
import { describe, expect, it } from 'vitest';
import { type Board, type Jar, isSealed, pourRefusal } from '../../../../src/core/board';
import { refusalNote, tapMechanic } from '../../../../src/ui/logic/refusal';
import { t } from '../../../../src/ui/strings';

/** A capacity-4 board from its jars. */
const board = (...jars: Jar[]): Board => ({ capacity: 4, jars });
const jar = (units: number[], extra: Partial<Jar> = {}): Jar => ({ units, hidden: 0, ...extra });
/** The note for pouring jar 0 into jar 1. */
const noteFor = (b: Board) => refusalNote(pourRefusal(b, 0, 1), isSealed(b.jars[1], b.capacity));

describe('refusalNote: why a pour was refused', () => {
  it('a wrong colour into a sieve names the sieve, even into an empty or a full one', () => {
    expect(noteFor(board(jar([0]), jar([], { sieve: 1 })))).toBe('sieve');
    expect(noteFor(board(jar([0]), jar([2, 1], { sieve: 1 })))).toBe('sieve');
    expect(noteFor(board(jar([0]), jar([2, 1, 2, 1], { sieve: 1 })))).toBe('sieve');
  });
  it('a sealed sieve says it is sealed, whatever the colour', () => {
    expect(noteFor(board(jar([0]), jar([1, 1, 1, 1], { sieve: 1 })))).toBe('sealed');
    expect(noteFor(board(jar([1]), jar([1, 1, 1, 1], { sieve: 1 })))).toBe('sealed');
  });
  it('the band colour onto another top colour is the usual colour note', () => {
    expect(noteFor(board(jar([1]), jar([1, 2], { sieve: 1 })))).toBe('colour');
  });
  it('jars without a sieve keep their notes: closed, sealed, full, colour', () => {
    expect(noteFor(board(jar([0]), jar([0], { frozen: true })))).toBe('mechanic');
    expect(noteFor(board(jar([0]), jar([2, 2, 2, 2])))).toBe('sealed');
    expect(noteFor(board(jar([0]), jar([2, 1, 2, 1])))).toBe('full');
    expect(noteFor(board(jar([0]), jar([2])))).toBe('colour');
  });
  it('a legal pour has no note', () => {
    expect(noteFor(board(jar([1]), jar([1], { sieve: 1 })))).toBeNull();
    expect(refusalNote(null, false)).toBeNull();
  });
});

describe('tapMechanic: the mechanic a tapped jar explains', () => {
  it('an empty sieve explains its band; a sealed one says nothing', () => {
    expect(tapMechanic(jar([], { sieve: 2 }), false)).toBe('sieve');
    expect(tapMechanic(jar([2, 2, 2, 2], { sieve: 2 }), true)).toBeNull();
  });
  it('the other mechanics are unchanged', () => {
    expect(tapMechanic(jar([0], { frozen: true }), false)).toBe('frozen');
    expect(tapMechanic(jar([0], { lock: 1 }), false)).toBe('locked');
    expect(tapMechanic(jar([0], { funnel: true }), false)).toBe('funnel');
    expect(tapMechanic(jar([], { cap: 2 }), false)).toBe('narrow');
    expect(tapMechanic(jar([]), false)).toBeNull();
  });
});

describe('sieve strings (D96)', () => {
  it('the refusal names the band colour', () => {
    expect(t.sieveRefused('terracotta')).toBe('Only terracotta sand can go in this sieve.');
  });
  it('the screen reader hears the band colour', () => {
    expect(t.jarStates.sieve('lagoon')).toBe('sieve, lagoon only, fill it with lagoon to finish');
    expect(t.jarStates.sieve('lagoon', true)).toBe('sieve, lagoon only');
  });
  it('the card names the sieve and says what it does', () => {
    expect(t.mechanics.sieve.name).toBe('Sieve jar');
    expect(t.mechanics.sieve.rule).toMatch(/only lets its own colour in.*Anything can be poured out\./);
    expect(t.map.jars.sieve).toBe('sieve');
  });
});

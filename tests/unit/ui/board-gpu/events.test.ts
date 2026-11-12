// Story: production/sprints/sprint-19.md (S5, S6): the canvas board's events move as the DOM's do,
// a settling pour snaps when the board moves on, and a lost WebGL context falls back to the DOM.
import { describe, expect, it } from 'vitest';
import { boardAfterContext, corkDrop, glowAt, liftTarget, mustSnapPour, nopeShake, shuffleHop } from '../../../../src/ui/board-gpu/events';

describe('liftTarget', () => {
  it('lifts the selected jar fully and the hint\'s from-jar by half, as style.css', () => {
    expect(liftTarget(2, 2, null, null)).toBe(1);
    expect(liftTarget(3, null, 3, null)).toBe(0.5);
    expect(liftTarget(3, 3, 3, null)).toBe(1); // selected wins over the hint
    expect(liftTarget(1, 2, 3, null)).toBe(0);
  });
  it('never lifts the jar a pour is carrying', () => {
    expect(liftTarget(2, 2, 2, 2)).toBe(0);
  });
});

describe('corkDrop (520 ms cork-drop keyframes)', () => {
  it('starts 160% above, tipped and clear, and ends at rest', () => {
    const a = corkDrop(0, 10);
    expect(a.y).toBeCloseTo(-16);
    expect(a.rotate).toBeCloseTo(-18);
    expect(a.alpha).toBe(0);
    expect(corkDrop(1, 10)).toEqual({ x: 0, y: 0, rotate: 0, scale: 1, alpha: 1 });
  });
  it('is fully opaque once it reaches its seat', () => {
    expect(corkDrop(0.7, 10).alpha).toBe(1);
  });
});

describe('shakes', () => {
  it('the refusal shake reaches ±4 px at its keyframes and rests at the ends', () => {
    expect(nopeShake(0)).toBe(0);
    expect(nopeShake(0.2)).toBeCloseTo(-4);
    expect(nopeShake(0.4)).toBeCloseTo(4);
    expect(nopeShake(1)).toBe(0);
  });
  it('the Shuffle hop rises 6 px at the middle', () => {
    expect(shuffleHop(0.5)).toBeCloseTo(-6);
    expect(shuffleHop(1)).toBe(0);
  });
});

describe('glowAt (the win run)', () => {
  it('is clear before it starts, full near 45%, and holds at 55% after', () => {
    expect(glowAt(-1).alpha).toBe(0);
    expect(glowAt(1).alpha).toBeCloseTo(0.55);
    expect(Math.max(...[0.2, 0.25, 0.3, 0.35].map((u) => glowAt(u).alpha))).toBeGreaterThan(0.9);
  });
});

describe('mustSnapPour', () => {
  it('snaps a released pour when Undo, Restart, Shuffle or an extra jar changed the board', () => {
    expect(mustSnapPour(true, false)).toBe(true);
  });
  it('leaves it settling on its own result, or while it still holds the input', () => {
    expect(mustSnapPour(true, true)).toBe(false);
    expect(mustSnapPour(false, false)).toBe(false);
  });
});

describe('boardAfterContext', () => {
  it('a lost context goes to the DOM board at once, whatever was chosen', () => {
    expect(boardAfterContext(true, 'gpu')).toBe('dom');
    expect(boardAfterContext(true, 'dom')).toBe('dom');
  });
  it('a restored context goes back to the chosen board', () => {
    expect(boardAfterContext(false, 'gpu')).toBe('gpu');
    expect(boardAfterContext(false, 'dom')).toBe('dom');
  });
});

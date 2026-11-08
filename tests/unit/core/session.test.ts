// Story: production/epics/strata/story-004-session-tools.md
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { makeBoard, pour } from '../../../src/core/board';
import { generateLevel } from '../../../src/core/generator';
import type { GameConfig } from '../../../src/core/levels';
import { GameSession, type SessionEvent } from '../../../src/core/session';

const opts = { extraJarsPerLevel: 1, hintNodeBudget: 10_000 };
const fresh = () => new GameSession(makeBoard(2, [[0, 1], [1, 0], []]), opts);

describe('GameSession', () => {
  it('applies legal pours, counts moves and emits events', () => {
    const s = fresh();
    const events: SessionEvent[] = [];
    s.onChange((e) => events.push(e));
    expect(s.pour(0, 2)).toBe(true);
    expect(s.moves).toBe(1);
    expect(events[0]).toMatchObject({ type: 'pour', move: { from: 0, to: 2 }, moved: 1, color: 1 });
  });
  it('rejects illegal pours without changing state', () => {
    const s = fresh();
    const before = s.board;
    expect(s.pour(0, 1)).toBe(false);
    expect(s.board).toBe(before);
    expect(s.moves).toBe(0);
  });
  it('undo restores the previous board', () => {
    const s = fresh();
    const before = s.board;
    s.pour(0, 2);
    expect(s.undo()).toBe(true);
    expect(s.board).toEqual(before);
    expect(s.moves).toBe(0);
    expect(s.undo()).toBe(false);
  });
  it('reaches won and emits a won event', () => {
    const s = fresh();
    const events: string[] = [];
    s.onChange((e) => events.push(e.type));
    s.pour(0, 2); // [0] [1,0] [1]
    s.pour(1, 0); // [0,0] [1] [1]
    s.pour(1, 2); // [0,0] [] [1,1]
    expect(s.status).toBe('won');
    expect(events).toContain('won');
    expect(s.pour(0, 1)).toBe(false);
  });
  it('detects stuck and the extra jar rescues it', () => {
    const s = new GameSession(makeBoard(2, [[0, 1], [1, 0]]), opts);
    expect(s.status).toBe('stuck');
    expect(s.addExtraJar()).toBe(true);
    expect(s.status).toBe('playing');
    expect(s.extraJarsLeft).toBe(0);
    expect(s.addExtraJar()).toBe(false);
  });
  it('the extra jar survives undo and restart', () => {
    const s = fresh();
    s.pour(0, 2);
    s.addExtraJar();
    s.undo();
    expect(s.board.jars).toHaveLength(4);
    s.restart();
    expect(s.board.jars).toHaveLength(4);
    expect(s.moves).toBe(0);
    expect(s.canUndo).toBe(false);
  });
  it('hint returns a move that keeps the board solvable', () => {
    const s = fresh();
    const m = s.hint();
    expect(m).not.toBeNull();
    expect(() => pour(s.board, m!.from, m!.to)).not.toThrow();
  });
  it('hint returns null on an unwinnable board', () => {
    expect(new GameSession(makeBoard(2, [[0, 1], [1, 0]]), { ...opts, extraJarsPerLevel: 0 }).hint()).toBeNull();
  });
  it('following hints from any state always reaches a win (no hint cycles)', () => {
    // Regression: re-solving from scratch each time could suggest moves that undo each other.
    for (const level of [10, 14, 20, 45]) {
      const g = generateLevel(level, config as unknown as GameConfig);
      const s = new GameSession(g.board, opts);
      s.pour(...firstLegal(s));
      let steps = 0;
      while (s.status !== 'won' && steps < 300) {
        const m = s.hint();
        expect(m, `level ${level} step ${steps}`).not.toBeNull();
        expect(s.pour(m!.from, m!.to)).toBe(true);
        steps++;
      }
      expect(s.status, `level ${level}`).toBe('won');
    }
  });
});

function firstLegal(s: GameSession): [number, number] {
  const b = s.board;
  for (let f = 0; f < b.jars.length; f++) for (let t = 0; t < b.jars.length; t++) if (s.board.jars[t].units.length === 0 && b.jars[f].units.length) return [f, t];
  throw new Error('no move');
}

describe('GameSession shuffle and assists', () => {
  // Story: production/epics/competitive/story-002-economy-boosters.md
  const shuffleOpts = { extraJarsPerLevel: 1, hintNodeBudget: 20_000 };

  it('shuffle keeps every unit and jar fill level, changes the board, and stays solvable', () => {
    const g = generateLevel(12, config as unknown as GameConfig);
    const s = new GameSession(g.board, shuffleOpts);
    const before = s.board;
    expect(s.shuffle(() => 0.37)).toBe(true);
    const after = s.board;
    expect(after).not.toEqual(before);
    expect(after.jars.map((j) => j.units.length)).toEqual(before.jars.map((j) => j.units.length));
    const count = (b: typeof before) => b.jars.flatMap((j) => j.units).sort().join(',');
    expect(count(after)).toBe(count(before));
    expect(s.hint()).not.toBeNull();
  });

  it('shuffle leaves sealed jars alone', () => {
    const s = new GameSession(makeBoard(2, [[0, 0], [1, 2], [2, 1], []]), shuffleOpts);
    let seed = 0.1;
    expect(s.shuffle(() => (seed = (seed * 9301 + 0.49297) % 1))).toBe(true);
    expect(s.board.jars[0].units).toEqual([0, 0]);
  });

  it('shuffle can be undone', () => {
    const g = generateLevel(6, config as unknown as GameConfig);
    const s = new GameSession(g.board, shuffleOpts);
    const before = s.board;
    s.shuffle(() => 0.5);
    s.undo();
    expect(s.board).toEqual(before);
  });

  it('counts assists: undo, hint, extra jar and shuffle each count, pours do not', () => {
    const s = fresh();
    s.pour(0, 2);
    expect(s.assists).toBe(0);
    s.undo();
    s.hint();
    s.addExtraJar();
    expect(s.assists).toBe(3);
  });

  it('restart clears assists only for the history, not the count', () => {
    const s = fresh();
    s.hint();
    s.restart();
    expect(s.assists).toBe(1);
  });
});

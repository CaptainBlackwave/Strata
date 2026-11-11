// Issue: strata-gbw.1, strata-gbw.2 (design/gdd/session-boosters.md §2.1 Undo and the stuck banner).
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { usefulMoves } from '../../../src/core/board';
import { generateLevel } from '../../../src/core/generator';
import type { GameConfig } from '../../../src/core/levels';
import { GameSession, type SessionEvent } from '../../../src/core/session';

const opts = { extraJarsPerLevel: 1, hintNodeBudget: 20_000 };

describe('undo after a shuffle (strata-gbw.1)', () => {
  it('undoing a shuffle leaves the pour count alone', () => {
    const s = new GameSession(generateLevel(6, config as unknown as GameConfig).board, opts);
    const [m] = usefulMoves(s.board);
    expect(s.pour(m.from, m.to)).toBe(true);
    expect(s.moves).toBe(1);
    expect(s.shuffle(() => 0.5)).toBe(true);
    expect(s.moves).toBe(1);
    expect(s.undo()).toBe(true); // takes back the shuffle
    expect(s.moves).toBe(1);
    expect(s.undo()).toBe(true); // takes back the pour
    expect(s.moves).toBe(0);
  });

  it('shuffle and undo repeated never lowers the count', () => {
    const s = new GameSession(generateLevel(6, config as unknown as GameConfig).board, opts);
    for (let i = 0; i < 3; i++) {
      s.shuffle(() => 0.5);
      s.undo();
    }
    expect(s.moves).toBe(0);
  });
});

describe('undo back onto a stuck board (strata-gbw.2)', () => {
  it('emits stuck after the undo so the banner returns', () => {
    // Level 7: three poor pours leave no useful pour (the browser check's dead end).
    const s = new GameSession(generateLevel(7, config as unknown as GameConfig).board, opts);
    for (const [f, t] of [[0, 5], [0, 6], [2, 5]]) expect(s.pour(f, t)).toBe(true);
    expect(s.status).toBe('stuck');
    expect(s.shuffle(() => 0.5)).toBe(true);
    const events: SessionEvent['type'][] = [];
    s.onChange((e) => events.push(e.type));
    s.undo();
    expect(s.status).toBe('stuck');
    expect(events).toEqual(['undo', 'stuck']);
  });
});

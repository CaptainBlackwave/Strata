// Story: production/sprints/sprint-16.md G3 (D137): the Home "Today's goals" card and the win card's goal rows.
import { describe, expect, it } from 'vitest';
import config from '../../../../src/config/game-config.json';
import { type GoalsConfig, emptyGoals, goalsFor } from '../../../../src/core/goals';
import { goalText, goalWinRows, goalsCard } from '../../../../src/ui/logic/goals-card';

const cfg = config as unknown as GoalsConfig;
const TODAY = '2026-11-12';
const goals = goalsFor(TODAY, cfg);

describe('goalsCard', () => {
  it('shows today’s three goals at zero for an empty or old save', () => {
    for (const saved of [emptyGoals(), { date: '2026-11-11', progress: [5, 1, 1], done: [1, 2], bonus: false }]) {
      const card = goalsCard(saved, TODAY, cfg);
      expect(card.rows.map((r) => r.text)).toEqual(goals.map(goalText));
      expect(card.rows.every((r) => r.have === 0 && !r.done)).toBe(true);
      expect(card.foot).toBe('+50 when all three are done');
    }
  });
  it('ignores a save from a later date (the clock moved back)', () => {
    const card = goalsCard({ date: '2026-11-13', progress: [9, 9, 9], done: [0, 1, 2], bonus: true }, TODAY, cfg);
    expect(card.allDone).toBe(false);
  });
  it('uses today’s progress, capped at each target, with "have/need" text', () => {
    const card = goalsCard({ date: TODAY, progress: [1, 0, 0], done: [], bonus: false }, TODAY, cfg);
    expect(card.rows[0].progress).toBe(`${Math.min(1, goals[0].target)}/${goals[0].target}`);
    expect(card.rows[1].progress).toBe(`0/${goals[1].target}`);
  });
  it('marks done goals and says "All done" when all are done', () => {
    const full = { date: TODAY, progress: goals.map((g) => g.target), done: [0, 1, 2], bonus: true };
    const card = goalsCard(full, TODAY, cfg);
    expect(card.rows.every((r) => r.done)).toBe(true);
    expect(card.allDone).toBe(true);
    expect(card.foot).toBe('All done');
  });
});

describe('goalText and goalWinRows', () => {
  it('words each kind', () => {
    expect(goalText({ kind: 'seal', target: 25, coins: 30 })).toBe('Seal 25 jars');
    expect(goalText({ kind: 'clear', target: 2, coins: 20 })).toBe('Clear 2 levels');
    expect(goalText({ kind: 'perfect', target: 1, coins: 30 })).toBe('Clear a level Perfect');
    expect(goalText({ kind: 'daily', target: 1, coins: 20 })).toBe('Solve today’s daily');
    expect(goalText({ kind: 'weekly', target: 1, coins: 30 })).toBe('Clear a weekly board');
  });
  it('writes a row per paid goal, then the bonus row when paid now', () => {
    expect(goalWinRows([{ goal: { kind: 'seal', target: 25, coins: 30 }, coins: 30 }], 50)).toEqual(['Goal done: Seal 25 jars · +30', 'All of today’s goals done · +50']);
    expect(goalWinRows([], 0)).toEqual([]);
  });
});

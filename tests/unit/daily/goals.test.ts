// Sprint 16 G1 (D137; design/gdd/daily-goals.md): three goals a UTC day, the same for everyone,
// paid when reached, plus a bonus when all three are done.
import { describe, expect, it } from 'vitest';
import { type GoalsConfig, type GoalsState, type GoalEvent, emptyGoals, goalsFor, recordGoals } from '../../../src/core/goals';

const cfg: GoalsConfig = {
  goals: {
    seedSalt: 4421,
    perDay: 3,
    bonus: 50,
    pool: [
      { kind: 'seal', target: 15, coins: 20 },
      { kind: 'seal', target: 25, coins: 30 },
      { kind: 'clear', target: 2, coins: 20 },
      { kind: 'clear', target: 4, coins: 40 },
      { kind: 'perfect', target: 1, coins: 30 },
      { kind: 'daily', target: 1, coins: 20 },
      { kind: 'weekly', target: 1, coins: 30 },
      { kind: 'beatBest', target: 1, coins: 40 },
    ],
  },
};
const level = (over: Partial<GoalEvent> = {}): GoalEvent => ({ mode: 'level', jarsSealed: 5, perfect: false, beatBest: false, counted: true, ...over });

describe('goalsFor', () => {
  it('gives the same three goals for a date on every call', () => {
    expect(goalsFor('2026-11-12', cfg)).toEqual(goalsFor('2026-11-12', cfg));
    expect(goalsFor('2026-11-12', cfg)).toHaveLength(3);
  });

  it('never repeats a kind on one day, across a year of dates', () => {
    for (let d = 0; d < 365; d++) {
      const date = new Date(Date.UTC(2026, 0, 1) + d * 86_400_000).toISOString().slice(0, 10);
      const kinds = goalsFor(date, cfg).map((g) => g.kind);
      expect(new Set(kinds).size).toBe(3);
    }
  });

  it('changes from day to day', () => {
    const days = ['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'].map((d) => JSON.stringify(goalsFor(d, cfg)));
    expect(new Set(days).size).toBeGreaterThan(1);
  });
});

/** A day whose goals include `kind`, searched from 2026-11-01. */
function dayWith(kind: string): string {
  for (let d = 0; d < 400; d++) {
    const date = new Date(Date.UTC(2026, 10, 1) + d * 86_400_000).toISOString().slice(0, 10);
    if (goalsFor(date, cfg).some((g) => g.kind === kind)) return date;
  }
  throw new Error(`no day with ${kind}`);
}

describe('recordGoals', () => {
  it('counts jars sealed toward a seal goal and pays once when reached', () => {
    const date = dayWith('seal');
    const i = goalsFor(date, cfg).findIndex((g) => g.kind === 'seal');
    const goal = goalsFor(date, cfg)[i];
    let state: GoalsState = emptyGoals();
    let paid = 0;
    for (let n = 0; n < 10; n++) {
      const r = recordGoals(state, date, level({ jarsSealed: 5 }), cfg);
      state = r.state;
      paid += r.paid.filter((p) => p.index === i).reduce((a, p) => a + p.coins, 0);
    }
    expect(state.progress[i]).toBe(goal.target); // capped at the target
    expect(paid).toBe(goal.coins);
    expect(state.done).toContain(i);
  });

  it('a Perfect counts only when the win used no assists', () => {
    const date = dayWith('perfect');
    const i = goalsFor(date, cfg).findIndex((g) => g.kind === 'perfect');
    const s1 = recordGoals(emptyGoals(), date, level({ perfect: false }), cfg).state;
    expect(s1.progress[i]).toBe(0);
    const s2 = recordGoals(s1, date, level({ perfect: true }), cfg).state;
    expect(s2.progress[i]).toBe(1);
  });

  it('the daily goal needs a counted daily solve', () => {
    const date = dayWith('daily');
    const i = goalsFor(date, cfg).findIndex((g) => g.kind === 'daily');
    expect(recordGoals(emptyGoals(), date, level({ mode: 'daily', counted: false }), cfg).state.progress[i]).toBe(0);
    expect(recordGoals(emptyGoals(), date, level({ mode: 'daily', counted: true }), cfg).state.progress[i]).toBe(1);
  });

  it('pays the bonus once when all three are done', () => {
    const date = '2026-11-12';
    const goals = goalsFor(date, cfg);
    let state: GoalsState = { date, progress: goals.map((g) => g.target - 1), done: [], bonus: false };
    // One event that advances everything a level win can: then finish the rest by hand.
    state = { ...state, progress: goals.map((g) => g.target), done: [0, 1] };
    const r = recordGoals({ ...state, progress: goals.map((g, k) => (k === 2 ? g.target - 1 : g.target)) }, date, everyEvent(goals[2].kind), cfg);
    expect(r.paid.map((p) => p.index)).toEqual([2]);
    expect(r.bonus).toBe(50);
    expect(r.state.bonus).toBe(true);
    expect(recordGoals(r.state, date, level(), cfg).bonus).toBe(0);
  });

  it('a new date starts fresh', () => {
    const s = recordGoals({ date: '2026-11-11', progress: [5, 5, 5], done: [0], bonus: false }, '2026-11-12', level({ jarsSealed: 0 }), cfg).state;
    expect(s.date).toBe('2026-11-12');
    expect(s.done).toEqual([]);
  });

  it('a date before the saved one (clock moved back) records nothing', () => {
    const before: GoalsState = { date: '2026-11-12', progress: [1, 0, 0], done: [], bonus: false };
    const r = recordGoals(before, '2026-11-11', level(), cfg);
    expect(r.state).toBe(before);
    expect(r.paid).toEqual([]);
  });
});

/** An event that advances a goal of `kind` by one. */
function everyEvent(kind: string): GoalEvent {
  if (kind === 'daily') return level({ mode: 'daily', counted: true, jarsSealed: 30 });
  if (kind === 'weekly') return level({ mode: 'weekly', jarsSealed: 30 });
  return level({ jarsSealed: 30, perfect: true, beatBest: true });
}

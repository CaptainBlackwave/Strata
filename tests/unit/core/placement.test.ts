// Stories: production/sprints/sprint-3.md T2, T9, T10
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import plain from '../../fixtures/plain-boards.json';
import { type Board, isSealed, isWon } from '../../../src/core/board';
import { type DailyConfig, dailySpec, dayNumber, generateDaily } from '../../../src/core/daily';
import { generateLevel } from '../../../src/core/generator';
import { type GameConfig, levelSpec } from '../../../src/core/levels';
import { GameSession } from '../../../src/core/session';

const cfg = config as unknown as GameConfig & DailyConfig;
/** FNV-1a, matching the fixture generator. */
const hash = (b: Board) => {
  const s = JSON.stringify(b);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
};
const has = (b: Board, id: string) =>
  id === 'narrow' ? b.jars.some((j) => j.cap !== undefined) : id === 'frozen' ? b.jars.some((j) => j.frozen) : id === 'locked' ? b.jars.some((j) => j.lock !== undefined) : b.jars.some((j) => j.funnel);

describe('mechanic schedule', () => {
  it('levels 1-20 have no mechanics', () => {
    for (let l = 1; l <= 20; l++) expect(levelSpec(l, cfg).mechanics).toEqual([]);
  });
  it('each mechanic debuts on its unlock level: narrow 21, frozen 41, locked 61, funnel 81', () => {
    expect(levelSpec(21, cfg).mechanics).toEqual(['narrow']);
    expect(levelSpec(41, cfg).mechanics).toEqual(['frozen']);
    expect(levelSpec(61, cfg).mechanics).toEqual(['locked']);
    expect(levelSpec(81, cfg).mechanics).toEqual(['funnel']);
  });
  it('tall-jar challenge levels stay plain', () => {
    for (let l = 10; l <= 300; l += 10) expect(levelSpec(l, cfg).mechanics).toEqual([]);
  });
  it('after unlock, about a third of levels use a mechanic', () => {
    let n = 0;
    let withM = 0;
    for (let l = 22; l <= 600; l++) {
      const s = levelSpec(l, cfg);
      if (s.challenge) continue;
      n++;
      if (s.mechanics.length) withM++;
    }
    expect(withM / n).toBeGreaterThan(0.25);
    expect(withM / n).toBeLessThan(0.45);
  });
  it('only unlocked mechanics appear, and combos only from level 101', () => {
    for (let l = 1; l <= 400; l++) {
      const m = levelSpec(l, cfg).mechanics;
      if (l < 41) expect(m.every((x) => x === 'narrow')).toBe(true);
      if (l < 81) expect(m).not.toContain('funnel');
      if (l < 101) expect(m.length).toBeLessThanOrEqual(1);
      expect(new Set(m).size).toBe(m.length);
    }
    const combos = Array.from({ length: 300 }, (_, i) => levelSpec(101 + i, cfg).mechanics.length).filter((n) => n === 2).length;
    expect(combos).toBeGreaterThan(0);
  });
});

describe('placement', () => {
  it('levels without a mechanic keep their exact pre-sprint-3 boards', () => {
    for (let l = 1; l <= 80; l++) {
      if (levelSpec(l, cfg).mechanics.length) continue;
      expect(hash(generateLevel(l, cfg).board), `level ${l}`).toBe((plain.hashes as Record<string, string>)[l]);
    }
  });
  it('a level with a mechanic actually contains it, and nothing is sealed at the start', () => {
    for (let l = 21; l <= 200; l++) {
      const s = levelSpec(l, cfg);
      if (!s.mechanics.length) continue;
      const g = generateLevel(l, cfg);
      for (const id of s.mechanics) expect(has(g.board, id), `level ${l} ${id}`).toBe(true);
      expect(g.board.jars.some((j) => isSealed(j, g.board.capacity))).toBe(false);
    }
  });
  it("a lock's colour is never inside its own jar", () => {
    for (let l = 61; l <= 260; l++) {
      if (!levelSpec(l, cfg).mechanics.includes('locked')) continue;
      for (const j of generateLevel(l, cfg).board.jars) if (j.lock !== undefined) expect(j.units).not.toContain(j.lock);
    }
  });
  it('levels 1-200 all generate (solver-proven), and mechanic levels replay to a win', () => {
    for (let l = 1; l <= 200; l++) {
      const g = generateLevel(l, cfg);
      if (!g.spec.mechanics.length || l % 4) continue;
      const s = new GameSession(g.board, { extraJarsPerLevel: 1, hintNodeBudget: 60_000 });
      let steps = 0;
      while (s.status !== 'won' && steps++ < 400) {
        const m = s.hint();
        expect(m, `level ${l}`).not.toBeNull();
        s.pour(m!.from, m!.to);
      }
      expect(isWon(s.board), `level ${l}`).toBe(true);
    }
  });
});

describe('Saturday daily mechanic', () => {
  const saturdays = Array.from({ length: 8 }, (_, i) => new Date(Date.UTC(2026, 10, 7 + 7 * i)).toISOString().slice(0, 10));
  it('every Saturday has exactly one mechanic, rotating through all four', () => {
    const seen = new Set<string>();
    for (const d of saturdays) {
      const m = dailySpec(d, cfg).mechanics;
      expect(m).toHaveLength(1);
      seen.add(m[0]);
      const g = generateDaily(d, cfg);
      expect(has(g.board, m[0]), d).toBe(true);
    }
    expect(seen.size).toBe(4);
  });
  it('Monday to Friday and Sunday stay plain', () => {
    for (let i = 0; i < 14; i++) {
      const d = new Date(Date.UTC(1970, 0, 1 + dayNumber('2026-11-08') + i)).toISOString().slice(0, 10);
      if (new Date(d).getUTCDay() !== 6) expect(dailySpec(d, cfg).mechanics, d).toEqual([]);
    }
  });
});

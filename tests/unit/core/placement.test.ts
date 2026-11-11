// Stories: production/sprints/sprint-3.md T2, T9, T10
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import plain from '../../fixtures/plain-boards.json';
import { type Board, isSealed } from '../../../src/core/board';
import { type DailyConfig, dailySpec, dayNumber, generateDaily } from '../../../src/core/daily';
import { generateLevel } from '../../../src/core/generator';
import { type GameConfig, levelSpec, mechanicChance, pickMechanics } from '../../../src/core/levels';

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
  it('tall-jar challenge levels stay plain before level 100 (D8)', () => {
    for (let l = 10; l < 100; l += 10) expect(levelSpec(l, cfg).mechanics).toEqual([]);
  });
  it('tall-jar challenge levels can have a mechanic from level 100 (D8)', () => {
    const withM = Array.from({ length: 60 }, (_, i) => levelSpec(100 + 10 * i, cfg)).filter((s) => s.mechanics.length).length;
    expect(withM).toBeGreaterThan(10);
    expect(withM).toBeLessThan(50);
  });
  it('the mechanic chance is 34% up to level 250, rising to 50% at level 500 (D1, D131)', () => {
    expect(mechanicChance(22, cfg)).toBeCloseTo(0.34);
    expect(mechanicChance(250, cfg)).toBeCloseTo(0.34);
    expect(mechanicChance(375, cfg)).toBeCloseTo(0.42);
    expect(mechanicChance(500, cfg)).toBeCloseTo(0.5);
    expect(mechanicChance(900, cfg)).toBeCloseTo(0.5);
  });
  it('about half of levels past 500 roll a mechanic (D1, D131; the spare-jar swap is counted separately)', () => {
    let n = 0;
    let withM = 0;
    for (let l = 501; l <= 1300; l++) {
      if (levelSpec(l, cfg).challenge) continue;
      n++;
      if (pickMechanics(l, cfg).length) withM++;
    }
    expect(withM / n).toBeGreaterThan(0.42);
    expect(withM / n).toBeLessThan(0.58);
  });
  it('only unlocked mechanics appear, and rolled combos only from comboFrom (250, D131)', () => {
    const from = cfg.mechanics.comboFrom;
    expect(from).toBe(250);
    for (let l = 1; l <= 400; l++) {
      const rolled = pickMechanics(l, cfg);
      const all = levelSpec(l, cfg).mechanics;
      for (const m of [rolled, all]) {
        if (l < 41) expect(m.every((x) => x === 'narrow')).toBe(true);
        if (l < 81) expect(m).not.toContain('funnel');
        expect(new Set(m).size).toBe(m.length);
      }
      if (l < from) expect(rolled.length).toBeLessThanOrEqual(1);
    }
    const combos = Array.from({ length: 300 }, (_, i) => pickMechanics(from + i, cfg).length).filter((n) => n === 2).length;
    expect(combos).toBeGreaterThan(0);
  });
});

describe('placement', () => {
  it('levels without a mechanic keep their exact pre-sprint-3 boards (levels 1-59, before the D1 ramp)', () => {
    for (let l = 1; l <= 59; l++) {
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
  }, 60_000);
  it("a lock's colour is never inside its own jar", () => {
    for (let l = 61; l <= 260; l++) {
      if (!levelSpec(l, cfg).mechanics.includes('locked')) continue;
      for (const j of generateLevel(l, cfg).board.jars) if (j.lock !== undefined) expect(j.units).not.toContain(j.lock);
    }
  }, 60_000);
});

describe('Saturday daily mechanic', () => {
  // The eight Saturdays to 2026-11-21: the classic rotation before the new jars join (2026-11-28, sprint 13 W1).
  const saturdays = Array.from({ length: 8 }, (_, i) => new Date(Date.UTC(2026, 10, 21 - 7 * i)).toISOString().slice(0, 10));
  it('every Saturday before 2026-11-28 has exactly one mechanic, rotating through all four', () => {
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

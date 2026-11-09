// Stories: production/sprints/sprint-3.md T2, T9, T10
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import plain from '../../fixtures/plain-boards.json';
import { type Board, isSealed, isWon } from '../../../src/core/board';
import { type DailyConfig, dailySpec, dayNumber, generateDaily } from '../../../src/core/daily';
import { generateLevel } from '../../../src/core/generator';
import { solve } from '../../../src/core/solver';
import { type GameConfig, isClassicMechanic, levelSpec, mechanicChance, pickMechanics } from '../../../src/core/levels';
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
  it('tall-jar challenge levels stay plain before level 100 (D8)', () => {
    for (let l = 10; l < 100; l += 10) expect(levelSpec(l, cfg).mechanics).toEqual([]);
  });
  it('tall-jar challenge levels can have a mechanic from level 100 (D8)', () => {
    const withM = Array.from({ length: 60 }, (_, i) => levelSpec(100 + 10 * i, cfg)).filter((s) => s.mechanics.length).length;
    expect(withM).toBeGreaterThan(10);
    expect(withM).toBeLessThan(50);
  });
  it('the mechanic chance is 34% up to level 45, rising to 50% at level 120 (D1)', () => {
    expect(mechanicChance(22, cfg)).toBeCloseTo(0.34);
    expect(mechanicChance(45, cfg)).toBeCloseTo(0.34);
    expect(mechanicChance(82.5, cfg)).toBeCloseTo(0.42);
    expect(mechanicChance(120, cfg)).toBeCloseTo(0.5);
    expect(mechanicChance(900, cfg)).toBeCloseTo(0.5);
  });
  it('about half of levels past 120 roll a mechanic (D1; the spare-jar swap is counted separately)', () => {
    let n = 0;
    let withM = 0;
    for (let l = 121; l <= 900; l++) {
      if (levelSpec(l, cfg).challenge) continue;
      n++;
      if (pickMechanics(l, cfg).length) withM++;
    }
    expect(withM / n).toBeGreaterThan(0.42);
    expect(withM / n).toBeLessThan(0.58);
  });
  it('only unlocked mechanics appear, and rolled combos only from level 101', () => {
    for (let l = 1; l <= 400; l++) {
      const rolled = pickMechanics(l, cfg);
      const all = levelSpec(l, cfg).mechanics;
      for (const m of [rolled, all]) {
        if (l < 41) expect(m.every((x) => x === 'narrow')).toBe(true);
        if (l < 81) expect(m).not.toContain('funnel');
        expect(new Set(m).size).toBe(m.length);
      }
      if (l < 101) expect(rolled.length).toBeLessThanOrEqual(1);
    }
    const combos = Array.from({ length: 300 }, (_, i) => pickMechanics(101 + i, cfg).length).filter((n) => n === 2).length;
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
  }, 60_000);
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

describe('difficulty ramp past level 45 (D1)', () => {
  const normal = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => levelSpec(from + i, cfg)).filter((x) => !x.challenge);
  it('levels before 60 always have 2 spare jars', () => {
    for (const s of normal(1, 59)) expect(s.spare).toBe(2);
  });
  it('from level 60 some levels have 1 spare jar, rising toward three quarters by 150', () => {
    const early = normal(60, 90).filter((s) => s.spare === 1).length / normal(60, 90).length;
    const late = normal(150, 400).filter((s) => s.spare === 1).length / normal(150, 400).length;
    expect(early).toBeGreaterThan(0.05);
    expect(early).toBeLessThan(0.5);
    expect(late).toBeGreaterThan(0.6);
    expect(late).toBeLessThan(0.9);
  });
  it('tall-jar levels keep 2 spare jars', () => {
    for (let l = 60; l <= 400; l += 10) expect(levelSpec(l, cfg).spare).toBe(2);
  });
  it('buried sand goes to 3 layers from level 75', () => {
    expect(levelSpec(74, cfg).buriedDepth).toBe(2);
    expect(levelSpec(75, cfg).buriedDepth).toBe(3);
  });
  it('colours rise to 13 at level 90 and 14 at level 130, using new palette colours', () => {
    expect(levelSpec(89, cfg).colors).toBe(12);
    expect(levelSpec(91, cfg).colors).toBe(13);
    expect(levelSpec(131, cfg).colors).toBe(14);
    expect(cfg.palette.length).toBeGreaterThanOrEqual(14);
    expect(new Set(cfg.palette.map((p) => p.hex.toLowerCase())).size).toBe(cfg.palette.length);
  });
  it('difficulty keeps changing past level 45', () => {
    const score = (s: ReturnType<typeof levelSpec>) => s.colors + s.buriedDepth + (2 - s.spare) * 3 + s.mechanics.length;
    const avg = (xs: ReturnType<typeof levelSpec>[]) => xs.reduce((n, s) => n + score(s), 0) / xs.length;
    expect(avg(normal(150, 250))).toBeGreaterThan(avg(normal(46, 58)) + 2);
  });
  it('a level that drops to 1 spare jar still generates (falling back to 2 if no 1-spare deal is proven)', () => {
    for (let l = 60; l <= 200; l++) {
      const g = generateLevel(l, cfg);
      expect([1, 2], `level ${l}`).toContain(g.spec.spare);
      expect(g.board.jars.filter((j) => j.units.length === 0 && j.cap === undefined && !j.funnel).length, `level ${l}`).toBe(g.spec.spare);
    }
  }, 60_000);
});

describe('spare-jar swap and generation fallback (D1 revised, sweep regressions)', () => {
  it('a 1-spare level swaps its missing spare for a narrow jar (or a funnel from level 81)', () => {
    for (let l = 60; l <= 300; l++) {
      const s = levelSpec(l, cfg);
      if (s.spare !== 1) continue;
      expect(s.mechanics.some((m) => m === 'narrow' || m === 'funnel'), `level ${l}`).toBe(true);
      if (l < 81) expect(s.mechanics, `level ${l}`).not.toContain('funnel');
    }
  });
  it('most levels from 150 really play with one ordinary spare jar', () => {
    let n = 0;
    let one = 0;
    for (let l = 150; l <= 260; l++) {
      if (levelSpec(l, cfg).challenge) continue;
      n++;
      const g = generateLevel(l, cfg);
      const ordinarySpares = g.board.jars.filter((j) => j.units.length === 0 && j.cap === undefined && !j.funnel).length;
      if (ordinarySpares === 1) one++;
    }
    expect(one / n).toBeGreaterThan(0.6);
  }, 60_000);
  it('tall-jar levels 460 and 470 generate (they threw "No solvable board" before the fallback)', () => {
    expect(() => generateLevel(460, cfg)).not.toThrow();
    expect(() => generateLevel(470, cfg)).not.toThrow();
  });
});

describe('a debut level shows its new mechanic alone (D28, GA-LG-7)', () => {
  // production/sprints/sprint-7.md B1; design/gdd/jar-mechanics.md. No spare-jar swap on an unlockAt level.
  // Classic mechanics; the hourglass debut (level 101, LevelSpec.hourglass) is pinned in hourglass.test.ts.
  const debuts = cfg.mechanics.list.filter((m) => isClassicMechanic(m.id)).map((m) => ({ id: m.id, level: m.unlockAt }));
  /** The ramp always swaps a spare from level 1, so the old code would swap on every debut level. */
  const alwaysSwap = { ...cfg, ramp: { ...cfg.ramp, spareOne: { ...cfg.ramp.spareOne, from: 1, chanceFrom: 1, chanceTo: 1 } } } as typeof cfg;
  it('with the swap forced on, every debut level keeps 2 spares and only its debut mechanic', () => {
    for (const { id, level } of debuts) {
      const s = levelSpec(level, alwaysSwap);
      expect(s.mechanics, `level ${level}`).toEqual([id]);
      expect(s.spare, `level ${level}`).toBe(2);
    }
  });
  it('with the swap forced on, a non-debut level still swaps (the rule is debut-only)', () => {
    const s = levelSpec(62, alwaysSwap);
    expect(s.spare).toBe(1);
    expect(s.mechanics.some((m) => m === 'narrow' || m === 'funnel')).toBe(true);
  });
  it('the real debut levels from 60 (locked 61, funnel 81) have 2 spares, their mechanic alone, and are solver-proven', () => {
    for (const { id, level } of debuts.filter((d) => d.level >= cfg.ramp.spareOne.from)) {
      const g = generateLevel(level, cfg);
      expect(g.spec.mechanics, `level ${level}`).toEqual([id]);
      expect(g.spec.spare, `level ${level}`).toBe(2);
      expect(has(g.board, id), `level ${level}`).toBe(true);
      expect(g.board.jars.filter((j) => j.units.length === 0 && j.cap === undefined && !j.funnel).length, `level ${level}`).toBe(2);
      expect(solve(g.board, cfg.generator.solverNodeBudget).solvable, `level ${level}`).toBe(true);
    }
  }, 60_000);
});

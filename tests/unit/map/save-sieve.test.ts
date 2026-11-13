// Story: production/sprints/sprint-28.md S4 (saves and the sieve goal, D214). Design: design/gdd/jar-mechanics.md 2.5, design/gdd/save-data.md.
// The save keeps the level number, never an in-progress board: a level is rebuilt from its seed on every
// start. So a save made before the sieve became a goal, sitting on a sieve level whose board changed,
// opens that level cleanly on the new board, and the new win rule and dead end apply to it.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import pins from '../../fixtures/boards-1-320.json';
import { type Board, isSealed, isWon, pour } from '../../../src/core/board';
import type { EconomyConfig } from '../../../src/core/economy';
import { generateLevel } from '../../../src/core/generator';
import type { GameConfig } from '../../../src/core/levels';
import { solve } from '../../../src/core/solver';
import { type KeyValueStore, freshSave, loadSave } from '../../../src/ui/storage';

const econ = config as unknown as EconomyConfig;
const cfg = config as unknown as GameConfig;
const KEY = 'strata.save.v2';
const hash = (b: Board) => {
  const s = JSON.stringify(b);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
};
const loadRaw = (raw: object) => {
  const data: Record<string, string> = { [KEY]: JSON.stringify(raw) };
  const store: KeyValueStore = { getItem: (k) => data[k] ?? null, setItem: () => undefined };
  return loadSave(econ, store);
};

describe('a save on a sieve level whose board changed (S4)', () => {
  // Level 158 rolls the sieve and its board changed with the goal (sprint 28 S1).
  const LEVEL = 158;

  it('the save stores no board, so nothing stale can be restored', () => {
    expect(Object.keys(freshSave(econ)).filter((k) => ['board', 'session', 'jars', 'history', 'moves'].includes(k))).toEqual([]);
    // A stray field (say, a board from some other build) is dropped on load.
    const save = loadRaw({ ...freshSave(econ), level: LEVEL, tutorialDone: true, board: { capacity: 4, jars: [] } });
    expect(save.level).toBe(LEVEL);
    expect('board' in save).toBe(false);
  });

  it('the level opens on the new board, proven with the sieve sealed', () => {
    const g = generateLevel(LEVEL, cfg);
    expect(hash(g.board)).toBe((pins.hashes as Record<string, string>)[String(LEVEL)]);
    const at = g.board.jars.findIndex((j) => j.sieve !== undefined);
    expect(at).toBeGreaterThanOrEqual(0);
    const r = solve(g.board, cfg.generator.solverNodeBudget);
    let b = g.board;
    for (const m of r.path) b = pour(b, m.from, m.to).board;
    expect(isWon(b)).toBe(true);
    expect(isSealed(b.jars[at], b.capacity)).toBe(true);
  });
});

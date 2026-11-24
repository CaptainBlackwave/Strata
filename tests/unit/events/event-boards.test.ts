// Sprint 31 C3 (D237, D240; design/gdd/events.md §3.3, §3.11). Fixture: tests/fixtures/event-boards.json,
// hashed from a clean worktree of e70ed708 (before the config change). Winter Tide boards 1-24 must stay
// byte-identical to the sprint 17 build; board 25 and New Tide 1-12 are pinned so they never drift.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import fixture from '../../fixtures/event-boards.json';
import { type Board, isWon, pour } from '../../../src/core/board';
import { type EventsConfig, eventById, generateEventBoard } from '../../../src/core/events';
import { maxPoursFor } from '../../../src/core/generator';
import type { GameConfig } from '../../../src/core/levels';
import { solve } from '../../../src/core/solver';

const cfg = config as unknown as GameConfig & EventsConfig;
/** FNV-1a over JSON.stringify, matching tests/unit/core/pins-1-360.test.ts and the fixture. */
const hash = (b: Board) => {
  const s = JSON.stringify(b);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
};
const pinned = fixture as unknown as { year: number; wintertide: Record<string, string>; newtide: Record<string, string> };

describe.each(['wintertide', 'newtide'] as const)('%s boards for 2026 against event-boards.json', (id) => {
  const event = eventById(id, cfg)!;
  it('pins every board of the event, and each is byte-identical', () => {
    const hashes = pinned[id];
    expect(Object.keys(hashes).length).toBe(event.boards);
    for (let n = 1; n <= event.boards; n++) expect(hash(generateEventBoard(event, pinned.year, n, cfg).board), `${id} #${n}`).toBe(hashes[String(n)]);
  });
  it('every board is gentle, builds within its pour cap and replays to a win', () => {
    for (let n = 1; n <= event.boards; n++) {
      const g = generateEventBoard(event, pinned.year, n, cfg);
      expect(g.spec.mechanics, `${id} #${n}`).toEqual([]);
      expect(g.spec.colors).toBeLessThanOrEqual(7);
      expect(g.spec.buriedDepth).toBeLessThanOrEqual(1);
      expect(isWon(g.board)).toBe(false);
      expect(g.solutionLength, `${id} #${n}`).toBeLessThanOrEqual(maxPoursFor(g.spec.level, cfg));
      const r = solve(g.board, cfg.generator.solverNodeBudget);
      expect(r.solvable, `${id} #${n}`).toBe(true);
      let b = g.board;
      for (const m of r.path) b = pour(b, m.from, m.to).board;
      expect(isWon(b), `${id} #${n}`).toBe(true);
    }
  }, 120_000);
});

describe('Winter Tide boards 1-24 (sprint 17) are unchanged by board 25', () => {
  it('the fixture has 24 sprint 17 boards plus the Christmas Day board, a 5-colour recipes[0] board', () => {
    const winter = eventById('wintertide', cfg)!;
    expect(Object.keys(pinned.wintertide).filter((n) => Number(n) <= 24)).toHaveLength(24);
    const g = generateEventBoard(winter, 2026, 25, cfg);
    expect(g.spec.colors).toBe(5);
    expect(g.spec.buriedDepth).toBe(0);
    expect(new Set(Object.values(pinned.wintertide)).size).toBe(25);
  });
});

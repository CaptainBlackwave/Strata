// Story: production/sprints/sprint-29.md N3 (the sunrise and sunset jars, D220). Design: design/gdd/jar-mechanics.md §2.11
// The 1-360 hash fixture was made before the pair existed, from a clean worktree of commit
// dde8dbcd1262f59495f0a27ba9320c67c013c666 (sprint 29 plan), before any generator, levels or
// config change. The pair unlocks at 361, so every level 1-360 must stay byte-identical.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import pins from '../../fixtures/boards-1-360.json';
import type { Board } from '../../../src/core/board';
import { generateLevel } from '../../../src/core/generator';
import { type GameConfig, levelSpec } from '../../../src/core/levels';

const cfg = config as unknown as GameConfig;

/** FNV-1a over JSON.stringify, matching the fixture generators. */
const hash = (b: Board) => {
  const s = JSON.stringify(b);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
};

describe('levels 1-360 against boards-1-360.json (sprint 29 N3)', () => {
  it('has all 360 levels, none has the sunrise and sunset pair, and every one is byte-identical', () => {
    const hashes = pins.hashes as Record<string, string>;
    expect(Object.keys(hashes).length).toBe(360);
    for (const [l, h] of Object.entries(hashes)) {
      const level = Number(l);
      expect((levelSpec(level, cfg) as { sun?: boolean }).sun, `level ${l} has the pair before 361`).toBeFalsy();
      const g = generateLevel(level, cfg);
      expect(g.board.jars.some((j) => (j as { sun?: unknown }).sun !== undefined), `level ${l} board`).toBe(false);
      expect(hash(g.board), `level ${l}`).toBe(h);
    }
  }, 120_000);
});

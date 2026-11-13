// Story: production/sprints/sprint-27.md K3 (the crab jar D207 and the lighthouse jar D208). Design: design/gdd/jar-mechanics.md §2.9, §2.10
// The 1-320 hash fixture was made on the base commit, before either jar existed. The crab jar
// unlocks at 281 and the lighthouse jar at 321, so levels 1-280 never change and 281-320 change
// only on levels that get a crab.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import pins from '../../fixtures/boards-1-320.json';
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

describe('levels 1-320 against boards-1-320.json (sprint 27 K3)', () => {
  it('has all 320 levels, and every level without a crab is byte-identical', () => {
    const hashes = pins.hashes as Record<string, string>;
    expect(Object.keys(hashes).length).toBe(320);
    const changed: number[] = [];
    for (const [l, h] of Object.entries(hashes)) {
      const level = Number(l);
      const crab = (levelSpec(level, cfg) as { crab?: boolean }).crab === true;
      const now = hash(generateLevel(level, cfg).board);
      if (crab) {
        changed.push(level);
        expect(level, `level ${l} has a crab before 281`).toBeGreaterThanOrEqual(281);
        expect(now, `crab level ${l} is built differently`).not.toBe(h);
      } else expect(now, `level ${l}`).toBe(h);
    }
    // Before K3 no level has a crab, so this is empty; after K3 it lists the crab levels of 281-320.
    expect(changed.every((l) => l >= 281 && l <= 320)).toBe(true);
  }, 120_000);
});

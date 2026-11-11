// Stories: production/sprints/sprint-3.md T2, T9, T10 — split from placement.test.ts so no file blocks a Vitest worker near its 60 s RPC limit (the PR #19 deploy failed on it)
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { isWon } from '../../../src/core/board';
import { type DailyConfig } from '../../../src/core/daily';
import { generateLevel } from '../../../src/core/generator';
import { type GameConfig } from '../../../src/core/levels';
import { GameSession } from '../../../src/core/session';

const cfg = config as unknown as GameConfig & DailyConfig;

describe('placement sweep', () => {
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

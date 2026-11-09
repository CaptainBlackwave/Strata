// Sprint 11 O2: the solver's moves for levels 1-10, so the first-run play-through pours like a player
// would, with no boosters. usage:
//   npx vite-node production/qa/evidence/sprint-11/onboarding/scripts/solutions.ts > <out>/solutions.json
import config from '../../../../../../src/config/game-config.json';
import { configKey, prepareLevel } from '../../../../../../src/core/prefetch';
import { solve } from '../../../../../../src/core/solver';
import type { GameConfig } from '../../../../../../src/core/levels';

const cfg = config as unknown as GameConfig;
const key = configKey(cfg);
const out: Record<number, { jars: number; moves: [number, number][]; mechanics: readonly string[]; challenge: boolean }> = {};
for (let n = 1; n <= 10; n++) {
  const p = prepareLevel(n, cfg, key);
  const r = solve(p.board, 2_000_000);
  out[n] = { jars: p.board.jars.length, moves: r.path.map((m) => [m.from, m.to]), mechanics: p.spec.mechanics, challenge: p.spec.challenge };
}
console.log(JSON.stringify(out));

import { it } from 'vitest';
import { makeBoard, pour } from '../../../src/core/board';
import { defaultDims, planPour, step, done, finish, sandConfig } from '../../../src/ui/sand';
it('probe', () => {
  for (const flowPassesPerStep of [1,2,3,4]) for (const spillPerStep of [12, 20, 32]) {
    const config = { ...sandConfig, flowPassesPerStep, spillPerStep };
    const res: string[] = [];
    for (const [b, f, t] of [[makeBoard(4, [[0, 1, 1, 1], []]), 0, 1], [makeBoard(4, [[0, 1], [2,1]]), 0, 1], [makeBoard(8, [[0, 2,1,1,1], [1,1,1]]), 0, 1]] as const) {
      const sim = planPour(b, f, t, defaultDims(), 5, { config });
      let ret = 0;
      while (!done(sim)) { step(sim); if (!ret && sim.phase === 'return') ret = sim.steps; }
      const r = finish(sim, pour(b, f, t).board);
      res.push(`${ret}/${sim.steps}/${r.changed}`);
    }
    console.log(flowPassesPerStep, spillPerStep, res.join('  '));
  }
});

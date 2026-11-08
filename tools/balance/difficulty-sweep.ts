/**
 * B2 difficulty sweep (production/sprints/sprint-7.md, GX-13).
 *
 * Generates levels 1..N with the shipped generator and config, and records per level:
 * the spec, the fallback step taken, generation time, the solver's pour count
 * (`solutionLength`) and the solver states explored on the proven board.
 *
 * Run from the repo root:  npx vite-node tools/balance/difficulty-sweep.ts
 * Options (env): SWEEP_TO=200  SWEEP_RUNS=3 (timing runs; the median is reported)
 * Writes production/qa/sprint-7/difficulty-sweep.csv and prints a JSON band summary.
 *
 * Read-only: it imports src/core and never changes behaviour. Solver states are read
 * by re-solving the returned board with `solve()`, which is deterministic and
 * already returns `nodes`, so no hook in src/core was needed.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import rawConfig from '../../src/config/game-config.json';
import { generateLevel } from '../../src/core/generator';
import { type GameConfig, levelSpec, pickMechanics, spareOneChance } from '../../src/core/levels';
import { solve } from '../../src/core/solver';

const config = rawConfig as unknown as GameConfig;
const TO = Number(process.env.SWEEP_TO ?? 200);
const RUNS = Math.max(1, Number(process.env.SWEEP_RUNS ?? 3));
const OUT_DIR = 'production/qa/sprint-7';

/** One CSV row. */
interface Row {
  level: number; colors: number; capacity: number; spare: number; buriedDepth: number;
  challenge: boolean; mechanics: string; mechanicCount: number; spareSwap: boolean; swapJar: string;
  spareOneChance: number; fallback: string; builtSpare: number; builtMechanics: string;
  attempts: number; genMs: number; pours: number; poursLowerBound: number; solverStates: number;
}

/** Which step of the fallback chain in `generateLevel` produced the board, from the returned spec. */
function fallbackStep(spec: ReturnType<typeof levelSpec>, built: ReturnType<typeof generateLevel>): string {
  if (built.attempts === 0) return 'fallbackBoard';
  if (built.spec.spare > Math.max(2, spec.spare)) return 'lastResort+1spare';
  if (spec.mechanics.length && !built.spec.mechanics.length) return 'noMechanics';
  if (spec.spare === 1 && built.spec.spare === 2) return 'secondSpare';
  return 'none';
}

/**
 * A cheap lower bound on pours for any player: every same-colour run must move at least
 * once, except one bottom run per colour that can stay as that colour's home.
 */
function poursLowerBound(board: ReturnType<typeof generateLevel>['board']): number {
  let runs = 0;
  const anchors = new Set<number>();
  for (const j of board.jars) {
    if (!j.units.length) continue;
    anchors.add(j.units[0]);
    for (let i = 0; i < j.units.length; i++) if (i === 0 || j.units[i] !== j.units[i - 1]) runs++;
  }
  return runs - anchors.size;
}

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pct = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)]; };

generateLevel(1, config); // warm-up for the JIT
const rows: Row[] = [];
for (let level = 1; level <= TO; level++) {
  const spec = levelSpec(level, config);
  const times: number[] = [];
  let built = generateLevel(level, config);
  for (let r = 0; r < RUNS; r++) {
    const t0 = performance.now();
    built = generateLevel(level, config);
    times.push(performance.now() - t0);
  }
  // The proven solve succeeded inside its budget, so a re-solve with the largest budget
  // the generator ever uses explores exactly the same states (DFS is deterministic).
  const re = solve(built.board, config.generator.solverNodeBudget);
  const picked = spec.challenge && (config.challenge.mechanicsFrom === undefined || level < config.challenge.mechanicsFrom) ? [] : pickMechanics(level, config);
  const swapJar = spec.spare === 1 ? spec.mechanics.filter((m) => !picked.includes(m)).join('+') : '';
  rows.push({
    level, colors: spec.colors, capacity: spec.capacity, spare: spec.spare, buriedDepth: spec.buriedDepth,
    challenge: spec.challenge, mechanics: spec.mechanics.join('+'), mechanicCount: spec.mechanics.length,
    spareSwap: spec.spare === 1, swapJar, spareOneChance: Number(spareOneChance(level, config).toFixed(3)),
    fallback: fallbackStep(spec, built), builtSpare: built.spec.spare, builtMechanics: built.spec.mechanics.join('+'),
    attempts: built.attempts, genMs: Number(median(times).toFixed(2)), pours: built.solutionLength, poursLowerBound: poursLowerBound(built.board),
    solverStates: re.solvable === true ? re.nodes : -1,
  });
}

mkdirSync(OUT_DIR, { recursive: true });
const cols = Object.keys(rows[0]) as (keyof Row)[];
writeFileSync(`${OUT_DIR}/difficulty-sweep.csv`, [cols.join(','), ...rows.map((r) => cols.map((c) => String(r[c])).join(','))].join('\n') + '\n');

const bands: [number, number][] = [[1, 20], [21, 40], [41, 60], [61, 80], [81, 100], [101, 120], [121, 150], [151, 200]];
const summary = bands.filter(([a]) => a <= TO).map(([a, b]) => {
  const rs = rows.filter((r) => r.level >= a && r.level <= b);
  const p = rs.map((r) => r.pours);
  const s = rs.map((r) => r.solverStates);
  const lb = rs.map((r) => r.poursLowerBound);
  const g = rs.map((r) => r.genMs);
  const count = (f: (r: Row) => boolean) => rs.filter(f).length;
  const fb: Record<string, number> = {};
  for (const r of rs) if (r.fallback !== 'none') fb[r.fallback] = (fb[r.fallback] ?? 0) + 1;
  const mech: Record<string, number> = {};
  for (const r of rs) for (const m of r.mechanics ? r.mechanics.split('+') : []) mech[m] = (mech[m] ?? 0) + 1;
  return {
    band: `${a}-${b}`, n: rs.length,
    pours: { median: median(p), p90: pct(p, 0.9), max: Math.max(...p), maxAt: rs[p.indexOf(Math.max(...p))].level },
    lowerBound: { median: median(lb), p90: pct(lb, 0.9), max: Math.max(...lb) },
    states: { median: median(s), p90: pct(s, 0.9), max: Math.max(...s), maxAt: rs[s.indexOf(Math.max(...s))].level },
    genMs: { median: Number(median(g).toFixed(1)), p90: Number(pct(g, 0.9).toFixed(1)), max: Math.max(...g), maxAt: rs[g.indexOf(Math.max(...g))].level },
    withMechanics: count((r) => r.mechanicCount > 0), combos: count((r) => r.mechanicCount > 1), mech,
    spareSwap: count((r) => r.spareSwap), challenge: count((r) => r.challenge), fallbacks: fb,
  };
});
console.log(JSON.stringify(summary, null, 1));
const top = [...rows].sort((a, b) => b.pours - a.pours).slice(0, 15).map((r) => `${r.level}:${r.pours}p/${r.solverStates}s/${r.fallback}`);
console.log('top pours', top.join(' '));
console.log('fallback levels', rows.filter((r) => r.fallback !== 'none').map((r) => `${r.level}:${r.fallback}`).join(' '));

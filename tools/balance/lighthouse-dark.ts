/**
 * Sprint 30 S1 (D232): what the lighthouse jar's dark sand costs the simulated player.
 *
 * Plays each level twice with the simulated player (sim-player.ts, patience 150, no boosters): once
 * dark-aware (a dark lighthouse jar's units are unknown until lit or sealed) and once seeing them
 * (the sprint 15-29 player). It reports stuck rates on the gate samples (301-400 every 3rd as in
 * tests/unit/balance/gentle-climb.test.ts, 401-500 every 2nd as in stuck-sweep.ts), and on every
 * level of 321-600 split into lighthouse and non-lighthouse levels, by spare count. What-ifs, made
 * on the generated board only (no game file changes): the beam every 3 and every 2 pours.
 * Deterministic: levels are seeded by number.
 *
 * Run from the repo root:  npx vite-node tools/balance/lighthouse-dark.ts
 */
import shipped from '../../src/config/game-config.json';
import type { Board } from '../../src/core/board';
import { generateLevel } from '../../src/core/generator';
import { type GameConfig, levelSpec } from '../../src/core/levels';
import { simPlay } from './sim-player';

const config = shipped as unknown as GameConfig;
const PATIENCE = 150;

/** `board` with each lighthouse beam re-dealt to sweep every `every` pours (a what-if, not a game change). */
function beamEvery(board: Board, every: number): Board {
  return { ...board, jars: board.jars.map((j) => (j.lighthouse ? { ...j, lighthouse: { every, left: every, lit: false } } : j)) };
}

interface Row {
  level: number;
  lighthouse: boolean;
  spare: number;
  old: boolean;
  dark: boolean;
  dark3: boolean;
  dark2: boolean;
}

const levels = new Set<number>();
for (let l = 301; l <= 400; l += 3) levels.add(l);
for (let l = 401; l <= 500; l += 2) levels.add(l);
for (let l = 321; l <= 600; l++) levels.add(l);
const rows = new Map<number, Row>();
for (const level of [...levels].sort((a, b) => a - b)) {
  const board = generateLevel(level, config).board;
  const spec = levelSpec(level, config);
  const lighthouse = board.jars.some((j) => j.lighthouse);
  const stuck = (b: Board, darkAware: boolean) => !simPlay(b, PATIENCE, { darkAware }).won;
  rows.set(level, {
    level,
    lighthouse,
    spare: spec.spare,
    old: stuck(board, false),
    dark: stuck(board, true),
    dark3: lighthouse ? stuck(beamEvery(board, 3), true) : stuck(board, true),
    dark2: lighthouse ? stuck(beamEvery(board, 2), true) : stuck(board, true),
  });
  if (lighthouse !== (spec.lighthouse === true)) console.log(`level ${level}: spec and board disagree on the lighthouse`);
}

const pct = (x: Row[], k: 'old' | 'dark' | 'dark3' | 'dark2') => (x.length ? `${Math.round((100 * x.filter((r) => r[k]).length) / x.length)}% (${x.filter((r) => r[k]).length}/${x.length})` : '-');
const line = (name: string, x: Row[]) => console.log(`| ${name} | ${x.length} | ${pct(x, 'old')} | ${pct(x, 'dark')} | ${pct(x, 'dark3')} | ${pct(x, 'dark2')} |`);
const pick = (from: number, to: number, step: number) => [...rows.values()].filter((r) => r.level >= from && r.level <= to && (r.level - from) % step === 0);
console.log('| Sample | Boards | Old player | Dark-aware | Dark-aware, beam every 3 | Dark-aware, beam every 2 |');
console.log('|---|---|---|---|---|---|');
line('301-400, every 3rd (gate)', pick(301, 400, 3));
line('401-500, every 2nd (sweep)', pick(401, 500, 2));
const late = pick(321, 600, 1);
for (const [name, x] of [['321-600', late], ['321-440', pick(321, 440, 1)], ['441-600', pick(441, 600, 1)]] as const) {
  line(`${name} lighthouse`, x.filter((r) => r.lighthouse));
  line(`${name} non-lighthouse`, x.filter((r) => !r.lighthouse));
  for (const spare of [1, 2]) {
    line(`${name} lighthouse, ${spare} spare`, x.filter((r) => r.lighthouse && r.spare === spare));
    line(`${name} non-lighthouse, ${spare} spare`, x.filter((r) => !r.lighthouse && r.spare === spare));
  }
}
console.log('lighthouse levels: ' + late.filter((r) => r.lighthouse).map((r) => `${r.level}${r.spare === 1 ? 's' : ''}:${r.old ? 'X' : '.'}${r.dark ? 'X' : '.'}${r.dark3 ? 'X' : '.'}${r.dark2 ? 'X' : '.'}`).join(' '));

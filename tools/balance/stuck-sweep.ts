/**
 * Stuck-rate and booster sweep (sprint 15 G1, G3; owner decision D132).
 *
 * For each level it runs the simulated player (sim-player.ts). When the player gets stuck, it
 * counts how many Hints it needs: the fewest first moves of the solver's path that, played for it,
 * let it win from there within its patience (capped at MAX_HINTS). Hints stand for any booster.
 *
 * Run from the repo root:
 *   npx vite-node tools/balance/stuck-sweep.ts
 * Options (env): SWEEP_FROM=1 SWEEP_TO=500 SWEEP_STEP=2 PATIENCE=150
 *   SWEEP_CONFIG=path to another game-config.json (for a before/after comparison)
 * Prints one line per band: stuck share, Hints per 100 levels, and the most Hints one level needed.
 */
// @ts-expect-error node:fs types are not installed (no @types/node; same approach as vite.config.ts)
import { readFileSync } from 'node:fs';
import shipped from '../../src/config/game-config.json';
import { type Board, pour } from '../../src/core/board';
import { generateLevel } from '../../src/core/generator';
import type { GameConfig } from '../../src/core/levels';
import { solve } from '../../src/core/solver';
import { simPlay } from './sim-player';

declare const process: { env: Record<string, string | undefined> };
const path = process.env.SWEEP_CONFIG;
const config = (path ? JSON.parse((readFileSync as (p: string, e: string) => string)(path, 'utf8')) : shipped) as unknown as GameConfig;
const FROM = Number(process.env.SWEEP_FROM ?? 1);
const TO = Number(process.env.SWEEP_TO ?? 500);
const STEP = Number(process.env.SWEEP_STEP ?? 2);
const PATIENCE = Number(process.env.PATIENCE ?? 150);
const MAX_HINTS = 30;

/** Hints the simulated player needs on `board`: 0 when it wins alone. */
function hintsNeeded(board: Board): number {
  if (simPlay(board, PATIENCE).won) return 0;
  const path = solve(board, config.generator.solverNodeBudget).path;
  let b = board;
  for (let h = 1; h <= Math.min(MAX_HINTS, path.length); h++) {
    b = pour(b, path[h - 1].from, path[h - 1].to).board;
    if (simPlay(b, PATIENCE).won) return h;
  }
  return MAX_HINTS;
}

const bands: [number, number][] = [[1, 40], [41, 80], [81, 150], [151, 200], [201, 300], [301, 400], [401, 500], [501, 1000]];
const rows: { level: number; hints: number }[] = [];
for (let level = FROM; level <= TO; level += STEP) rows.push({ level, hints: hintsNeeded(generateLevel(level, config).board) });
console.log(`patience ${PATIENCE}, every ${STEP} level(s), ${path ?? 'shipped config'}`);
for (const [a, b] of bands) {
  const x = rows.filter((r) => r.level >= a && r.level <= b);
  if (!x.length) continue;
  const stuck = x.filter((r) => r.hints > 0).length;
  const hints = x.reduce((n, r) => n + r.hints, 0);
  console.log(`${a}-${b}: stuck ${Math.round((100 * stuck) / x.length)}% | hints per 100 levels ${Math.round((100 * hints) / x.length)} | most on one level ${Math.max(...x.map((r) => r.hints))}`);
}

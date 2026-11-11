// PROTOTYPE - NOT FOR PRODUCTION
// Question: can a GPU board (Pixi) and a falling-sand pour look and run well enough for Strata?
// Date: 2026-11-11
import { canPour, legalMoves, pour, pourAmount, type Board } from '../../../src/core/board';
import { generateLevel } from '../../../src/core/generator';
import config from '../../../src/config/game-config.json';
import { VariantA } from './variantA';
import { speed, type Variant } from './variant';

type Which = 'A' | 'B' | 'C';

const host = document.getElementById('host')!;
const info = document.getElementById('info')!;
const level = generateLevel(52, config as never);
const start: Board = level.board;

let board: Board = start;
let history: Board[] = [];
let selected: number | null = null;
let busy = false;
let variant: Variant | null = null;
let which: Which = 'A';
let patterns = false;
let gen = 0;

async function show(w: Which): Promise<void> {
  const my = ++gen;
  which = w;
  variant?.destroy();
  variant = null;
  host.innerHTML = '';
  document.querySelectorAll<HTMLButtonElement>('#bar button[data-v]').forEach((b) => b.classList.toggle('on', b.dataset.v === w));
  board = start; history = []; selected = null; busy = false;
  let v: Variant;
  if (w === 'A') v = new VariantA(host, tap);
  else {
    const { PixiBoard } = await import('./pixiBoard');
    if (my !== gen) return;
    v = await PixiBoard.create(host, w, tap, start.jars.length);
  }
  if (my !== gen) { v.destroy(); return; }
  variant = v;
  v.setPatterns(patterns);
  v.setBoard(board);
  info.textContent = `Level 52 (${start.jars.length} jars). Variant ${w}.`;
}

async function tap(i: number): Promise<void> {
  if (busy || !variant) return;
  if (selected === null) {
    if (board.jars[i].units.length) { selected = i; variant.setSelected(i); }
    return;
  }
  if (selected === i) { selected = null; variant.setSelected(null); return; }
  const from = selected;
  if (!canPour(board, from, i)) {
    selected = board.jars[i].units.length ? i : null;
    variant.setSelected(selected);
    return;
  }
  selected = null;
  await doPour(from, i);
}

async function doPour(from: number, to: number): Promise<void> {
  if (!variant) return;
  busy = true;
  const moved = pourAmount(board, from, to);
  const res = pour(board, from, to);
  const before = board;
  history.push(before);
  await variant.pour(from, to, moved, res.color, before, res.board);
  board = res.board;
  busy = false;
}

document.querySelectorAll<HTMLButtonElement>('#bar button[data-v]').forEach((b) => b.addEventListener('click', () => void show(b.dataset.v as Which)));
document.getElementById('undo')!.addEventListener('click', () => {
  if (busy || !variant || !history.length) return;
  board = history.pop()!;
  variant.setBoard(board);
});
(document.getElementById('pat') as HTMLInputElement).addEventListener('change', (e) => {
  patterns = (e.target as HTMLInputElement).checked;
  variant?.setPatterns(patterns);
});

// ---- test hooks (used by the Playwright scripts, harmless otherwise) ----
const w = window as unknown as Record<string, unknown>;
w.__proto = {
  show,
  speed,
  which: () => which,
  busy: () => busy,
  board: () => board,
  reset: () => { board = start; history = []; variant?.setBoard(board); },
  /** Pour the legal move that moves the most units (ties: lowest index), `n` times. Returns the moves. */
  async autoPours(n: number, hook?: (k: number) => void): Promise<number[][]> {
    const done: number[][] = [];
    for (let k = 0; k < n; k++) {
      let ms = legalMoves(board);
      if (!ms.length) { board = start; history = []; variant?.setBoard(board); ms = legalMoves(board); }
      const best = ms[Math.floor(Math.random() * ms.length)];
      const bm = pourAmount(board, best.from, best.to);
      hook?.(k);
      await doPour(best.from, best.to);
      done.push([best.from, best.to, bm]);
    }
    return done;
  },
  doPour,
  /** Find a move that moves >= `min` units from the current board, or null. */
  findMove(min: number): number[] | null {
    for (const m of legalMoves(board)) if (pourAmount(board, m.from, m.to) >= min) return [m.from, m.to, pourAmount(board, m.from, m.to)];
    return null;
  },
};

void show('A');

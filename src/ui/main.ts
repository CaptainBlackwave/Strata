/**
 * Strata's browser front end: renders the board, turns taps into session commands,
 * and plays the pour animation. It owns no game rules; GameSession does.
 * Implements design/game-brief.md MVP 5 and MVP 6.
 */
import './style.css';
import rawConfig from '../config/game-config.json';
import { type Board, canPour, isSealed } from '../core/board';
import { generateLevel } from '../core/generator';
import type { GameConfig } from '../core/levels';
import { GameSession, type SessionEvent } from '../core/session';
import { computeLayout } from './layout';
import { loadProgress, saveProgress } from './storage';
import { t } from './strings';

const config = rawConfig as unknown as GameConfig;
const PREFS_KEY = 'strata.prefs.v1';
const TILT_DEG = 72;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const boardEl = $<HTMLElement>('board');
const levelLabel = $<HTMLElement>('level-label');
const challengeTag = $<HTMLElement>('challenge-tag');
const movesEl = $<HTMLElement>('moves');
const toastEl = $<HTMLElement>('toast');
const winEl = $<HTMLElement>('win');
const winText = $<HTMLElement>('win-text');
const btnUndo = $<HTMLButtonElement>('btn-undo');
const btnRestart = $<HTMLButtonElement>('btn-restart');
const btnJar = $<HTMLButtonElement>('btn-jar');
const btnHint = $<HTMLButtonElement>('btn-hint');
const btnNext = $<HTMLButtonElement>('btn-next');
const jarCount = $<HTMLElement>('jar-count');
const btnPatterns = document.createElement('button');

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let progress = loadProgress();
let level = progress.level;
let session!: GameSession;
let selected: number | null = null;
let busy = false;
let pendingWin = false;
let jarEls: HTMLButtonElement[] = [];
let unitHeight = 0;
let patterns = readPatternsPref();

// ---- Boot ---------------------------------------------------------------

const params = new URLSearchParams(location.search);
const levelParam = Number(params.get('level'));
if (Number.isInteger(levelParam) && levelParam >= 1) level = levelParam; // QA launch argument (run-and-observe)

applyStrings();
startLevel(level);
wireInput();

// ---- Level lifecycle ----------------------------------------------------

function startLevel(n: number): void {
  level = n;
  const gen = generateLevel(n, config);
  session = new GameSession(gen.board, {
    extraJarsPerLevel: config.extraJarsPerLevel,
    hintNodeBudget: config.hint.solverNodeBudget,
  });
  session.onChange(onSessionEvent);
  selected = null;
  busy = false;
  pendingWin = false;
  winEl.hidden = true;
  levelLabel.textContent = t.level(n);
  challengeTag.textContent = t.challenge;
  challengeTag.hidden = !gen.spec.challenge;
  document.body.dataset.challenge = String(gen.spec.challenge);
  buildJars();
  updateHud();
}

function onSessionEvent(e: SessionEvent): void {
  switch (e.type) {
    case 'pour':
      updateJar(e.move.from);
      updateJar(e.move.to, session.board.jars[e.move.to].units.length - e.moved);
      if (e.sealed) jarEls[e.move.to].classList.add('just-sealed');
      break;
    case 'extraJar':
      buildJars();
      break;
    case 'undo':
    case 'restart':
      selected = null;
      renderAllJars();
      break;
    case 'won':
      pendingWin = true;
      recordWin();
      break;
    case 'stuck':
      showToast(t.stuck);
      break;
  }
  updateHud();
}

function recordWin(): void {
  const key = String(level);
  const prevBest = progress.best[key];
  if (prevBest === undefined || session.moves < prevBest) progress.best[key] = session.moves;
  progress.level = Math.max(progress.level, level + 1);
  saveProgress(progress);
  winText.textContent = t.winText(session.moves, prevBest);
}

function showWin(): void {
  pendingWin = false;
  winEl.hidden = false;
  btnNext.focus();
}

// ---- Rendering ----------------------------------------------------------

function buildJars(): void {
  const board = session.board;
  const rect = boardEl.getBoundingClientRect();
  const layout = computeLayout({
    width: rect.width,
    height: rect.height,
    jars: board.jars.length,
    capacity: board.capacity,
  });
  unitHeight = layout.unitHeight;
  const s = boardEl.style;
  s.setProperty('--jar-w', `${layout.jarWidth}px`);
  s.setProperty('--unit-h', `${layout.unitHeight}px`);
  s.setProperty('--jar-h', `${layout.jarHeight}px`);
  s.setProperty('--gap-x', `${layout.gapX}px`);
  s.setProperty('--gap-y', `${layout.gapY}px`);
  s.setProperty('--cols', String(layout.cols));

  boardEl.replaceChildren();
  const rows = document.createElement('div');
  rows.className = 'rows';
  jarEls = board.jars.map((_, i) => {
    const jar = document.createElement('button');
    jar.type = 'button';
    jar.className = 'jar';
    jar.dataset.index = String(i);
    jar.innerHTML = '<span class="cork" aria-hidden="true"></span><span class="glass"><span class="sand"></span><span class="shine"></span></span>';
    jar.addEventListener('click', () => onJarTap(i));
    rows.appendChild(jar);
    return jar;
  });
  boardEl.appendChild(rows);
  renderAllJars();
}

function renderAllJars(): void {
  session.board.jars.forEach((_, i) => updateJar(i));
}

/** Redraws jar `i`. Units at index `growFrom` and above animate in. */
function updateJar(i: number, growFrom = Infinity): void {
  const board: Board = session.board;
  const jar = board.jars[i];
  const el = jarEls[i];
  if (!el) return;
  const sand = el.querySelector('.sand') as HTMLElement;
  sand.replaceChildren(
    ...jar.units.map((color, k) => {
      const u = document.createElement('span');
      u.className = 'unit';
      if (k < jar.hidden) {
        u.classList.add('buried');
      } else {
        u.style.setProperty('--c', config.palette[color].hex);
        if (patterns) u.classList.add(`pat-${color % 12}`);
      }
      if (k >= growFrom) {
        u.classList.add('grow');
        u.style.animationDelay = `${(k - growFrom) * 70}ms`;
      }
      return u;
    }),
  );
  const sealed = isSealed(jar, board.capacity);
  el.classList.toggle('sealed', sealed);
  if (!sealed) el.classList.remove('just-sealed');
  el.classList.toggle('selected', selected === i);
  el.setAttribute('aria-pressed', String(selected === i));
  const contents = jar.units.length
    ? jar.units.map((c, k) => (k < jar.hidden ? t.buried : config.palette[c].id)).join(', ')
    : t.jarEmpty;
  el.setAttribute('aria-label', t.jarLabel(i, sealed ? `${contents} (${t.sealed})` : contents));
}

function updateHud(): void {
  movesEl.textContent = String(session.moves);
  btnUndo.disabled = !session.canUndo;
  jarCount.textContent = String(session.extraJarsLeft);
  btnJar.disabled = session.extraJarsLeft <= 0 || session.status === 'won';
  btnHint.disabled = session.status === 'won';
}

function setSelected(i: number | null): void {
  const prev = selected;
  selected = i;
  if (prev !== null) updateJar(prev);
  if (i !== null) updateJar(i);
}

// ---- Input --------------------------------------------------------------

function isLiftable(i: number): boolean {
  const jar = session.board.jars[i];
  return !!jar && jar.units.length > 0 && !isSealed(jar, session.board.capacity);
}

function onJarTap(i: number): void {
  if (busy || session.status === 'won') return;
  if (selected === null) {
    if (isLiftable(i)) setSelected(i);
    else nope(i);
    return;
  }
  if (selected === i) {
    setSelected(null);
    return;
  }
  const from = selected;
  if (canPour(session.board, from, i)) {
    void animatePour(from, i);
  } else {
    nope(i);
    setSelected(isLiftable(i) ? i : null);
  }
}

function nope(i: number): void {
  const el = jarEls[i];
  el.classList.remove('nope');
  void el.offsetWidth; // restart the CSS animation
  el.classList.add('nope');
}

async function animatePour(from: number, to: number): Promise<void> {
  busy = true;
  const src = jarEls[from];
  const dst = jarEls[to];
  const color = config.palette[session.board.jars[from].units.at(-1)!].hex;
  const targetLen = session.board.jars[to].units.length;

  if (reducedMotion()) {
    session.pour(from, to);
    finishPour();
    return;
  }

  const s = src.getBoundingClientRect();
  const d = dst.getBoundingClientRect();
  const side = d.left + d.width / 2 >= s.left + s.width / 2 ? 1 : -1;
  const r = s.height / 2;
  const rad = (TILT_DEG * Math.PI) / 180;
  const mouthX = d.left + d.width / 2 - side * 3;
  const mouthY = d.top - 10;
  const dx = mouthX - side * r * Math.sin(rad) - (s.left + s.width / 2);
  const dy = mouthY + r * Math.cos(rad) - (s.top + s.height / 2);
  const lifted = getComputedStyle(src).transform;
  src.classList.add('pouring');

  const go = src.animate(
    [{ transform: lifted === 'none' ? 'none' : lifted }, { transform: `translate(${dx}px, ${dy}px) rotate(${side * TILT_DEG}deg)` }],
    { duration: 260, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' },
  );
  await go.finished;

  // Stream of sand from the mouth to the target's surface.
  const glass = dst.querySelector('.glass') as HTMLElement;
  const g = glass.getBoundingClientRect();
  const surface = g.bottom - 4 - targetLen * unitHeight;
  const stream = document.createElement('div');
  stream.className = 'stream';
  stream.style.left = `${mouthX - 3}px`;
  stream.style.top = `${mouthY}px`;
  stream.style.height = `${Math.max(8, surface - mouthY)}px`;
  stream.style.setProperty('--c', color);
  document.body.appendChild(stream);
  await stream.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 110, easing: 'ease-in', fill: 'forwards' }).finished;

  session.pour(from, to);
  await wait(260);

  stream.style.transformOrigin = 'bottom';
  await stream.animate([{ transform: 'scaleY(1)' }, { transform: 'scaleY(0)' }], { duration: 120, fill: 'forwards' }).finished;
  stream.remove();

  const back = src.animate(
    [{ transform: `translate(${dx}px, ${dy}px) rotate(${side * TILT_DEG}deg)` }, { transform: 'none' }],
    { duration: 240, easing: 'cubic-bezier(.4,0,.3,1)', fill: 'forwards' },
  );
  await back.finished;
  go.cancel();
  back.cancel();
  src.classList.remove('pouring');
  finishPour();
}

function finishPour(): void {
  selected = null;
  renderSelectedState();
  busy = false;
  if (pendingWin) window.setTimeout(showWin, reducedMotion() ? 0 : 450);
}

function renderSelectedState(): void {
  jarEls.forEach((el, i) => {
    el.classList.toggle('selected', selected === i);
    el.setAttribute('aria-pressed', String(selected === i));
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((res) => window.setTimeout(res, ms));
}

let toastTimer = 0;
function showToast(text: string): void {
  toastEl.textContent = text;
  toastEl.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), 2600);
}

function showHint(): void {
  if (busy) return;
  const m = session.hint();
  if (!m) {
    showToast(t.noHint);
    return;
  }
  setSelected(null);
  clearHint();
  for (const [i, cls] of [
    [m.from, 'hint-from'],
    [m.to, 'hint-to'],
  ] as const) {
    const el = jarEls[i];
    void el.offsetWidth; // restart the CSS animation
    el.classList.add(cls);
  }
  hintTimer = window.setTimeout(clearHint, 1800);
}

let hintTimer = 0;
/** Removes any visible hint highlight, so only one hint shows at a time. */
function clearHint(): void {
  window.clearTimeout(hintTimer);
  for (const el of jarEls) el.classList.remove('hint-from', 'hint-to');
}

function wireInput(): void {
  btnUndo.addEventListener('click', () => !busy && session.undo());
  btnRestart.addEventListener('click', () => !busy && session.restart());
  btnJar.addEventListener('click', () => {
    if (busy) return;
    if (!session.addExtraJar()) showToast(t.noJars);
  });
  btnHint.addEventListener('click', showHint);
  btnNext.addEventListener('click', () => startLevel(level + 1));
  btnPatterns.addEventListener('click', () => {
    patterns = !patterns;
    writePatternsPref(patterns);
    btnPatterns.setAttribute('aria-pressed', String(patterns));
    renderAllJars();
  });

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (!winEl.hidden) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        btnNext.click();
      }
      return;
    }
    const k = e.key.toLowerCase();
    if (busy) return;
    if (k === 'z') session.undo();
    else if (k === 'r') session.restart();
    else if (k === 'h') showHint();
    else if (k === 'escape') setSelected(null);
    else if (/^[0-9]$/.test(k)) {
      const i = k === '0' ? 9 : Number(k) - 1;
      if (i < jarEls.length) onJarTap(i);
    }
  });

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => !busy && buildJars(), 120);
  });
}

function applyStrings(): void {
  btnUndo.querySelector('span')!.textContent = t.undo;
  btnRestart.querySelector('span')!.textContent = t.restart;
  btnJar.querySelector('span')!.textContent = t.jar;
  btnHint.querySelector('span')!.textContent = t.hint;
  btnNext.textContent = t.next;
  $('win-title').textContent = t.winTitle;
  boardEl.setAttribute('aria-label', t.boardLabel);
  document.querySelector('.hud-moves')!.lastChild!.textContent = ` ${t.pours}`;

  btnPatterns.type = 'button';
  btnPatterns.className = 'chip';
  btnPatterns.textContent = t.patterns;
  btnPatterns.title = t.patternsTitle;
  btnPatterns.setAttribute('aria-pressed', String(patterns));
  document.querySelector('.hud')!.appendChild(btnPatterns);
}

function readPatternsPref(): boolean {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}').patterns === true;
  } catch {
    return false;
  }
}

function writePatternsPref(on: boolean): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ patterns: on }));
  } catch {
    /* ignore */
  }
}

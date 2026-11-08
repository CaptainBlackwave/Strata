/**
 * Strata's browser front end: home screen, tutorial, board rendering, boosters,
 * rewards and the pour animation. It owns no game rules: GameSession (rules) and
 * economy.ts (coins and boosters) decide, and this file displays and asks.
 * Implements design/game-brief.md MVP 5-6 and design/competitive-roadmap.md C1-C5.
 */
import './style.css';
import rawConfig from '../config/game-config.json';
import { type Board, canPour, isSealed, pourAmount } from '../core/board';
import { type CollectionConfig, allShells, grantShell, milestoneDue, setProgress } from '../core/collection';
import { type DailyConfig, generateDaily, localDateKey, recordDailySolve, streakStatus, weekday } from '../core/daily';
import { type BoosterId, type EconomyConfig, addBoosters, addCoins, levelReward, spendBooster } from '../core/economy';
import { generateLevel, tutorialBoard } from '../core/generator';
import type { GameConfig } from '../core/levels';
import { createRng } from '../core/rng';
import { GameSession, type SessionEvent } from '../core/session';
import { GameAudio } from './audio';
import { burst, celebrate, sparkleAround } from './fx';
import { computeLayout } from './layout';
import { shellSvg } from './shells';
import { type SaveData, loadSave, writeSave } from './storage';
import { t } from './strings';

const config = rawConfig as unknown as GameConfig & EconomyConfig & DailyConfig & CollectionConfig;
/** Presentation-only timings (ms) and tilt angle: animation feel, not gameplay. */
const ANIM = { lift: 210, streamIn: 90, flow: 230, streamOut: 90, back: 220, tilt: 100, winDelay: 650 } as const;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const boardEl = $('board');
const levelLabel = $('level-label');
const challengeTag = $('challenge-tag');
const movesEl = $('moves');
const coinsEl = $('coins');
const toastEl = $('toast');
const winEl = $('win');
const homeEl = $('home');
const settingsEl = $('settings');
const coachEl = $('coach');
const coachText = $('coach-text');
const btnNext = $<HTMLButtonElement>('btn-next');
const toolButtons = [...document.querySelectorAll<HTMLButtonElement>('.tool[data-booster]')];

const BOOSTER_NAMES: Record<BoosterId, string> = { undo: t.undo, shuffle: t.shuffle, extraJar: t.jar, hint: t.hint };
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let save: SaveData = loadSave(config);
let level = save.level;
/** What is being played: a numbered level, today's daily puzzle, or the tutorial. */
let mode: 'level' | 'daily' | 'tutorial' = 'level';
let dailyDate = '';
let dailyName = '';
let session!: GameSession;
let challenge = false;
let selected: number | null = null;
let busy = false;
let pendingWin = false;
let jarEls: HTMLButtonElement[] = [];
let unitHeight = 0;
const returning = new Set<number>();
let toastTimer = 0;
let hintTimer = 0;
const audio = new GameAudio(save.settings);
const shuffleRng = createRng(Date.now() >>> 0);

// ---- Boot ---------------------------------------------------------------

const params = new URLSearchParams(location.search);
const levelParam = Number(params.get('level'));
const qaLevel = Number.isInteger(levelParam) && levelParam >= 1; // QA launch argument (run-and-observe)
applyStrings();
wireInput();
if (qaLevel) {
  level = levelParam;
  startLevel(level);
} else {
  startLevel(level);
  showHome();
}

// ---- Screens ------------------------------------------------------------

function showHome(): void {
  winEl.hidden = true;
  $('home-coins').textContent = String(save.wallet.coins);
  $('btn-play').textContent = save.tutorialDone ? t.play(save.level) : t.playTutorial;
  const today = localDateKey(new Date());
  const day = config.daily.week[weekday(today)];
  const status = streakStatus(save.daily, today);
  const [y, m, d] = today.split('-').map(Number);
  $('daily-dow').textContent = new Date(y, m - 1, d).toLocaleDateString('en', { weekday: 'short' });
  $('daily-dom').textContent = String(d);
  $('daily-title').textContent = t.daily;
  $('daily-sub').textContent = status.solvedToday ? t.dailySolved : t.dailyNew(day.name);
  $('daily-streak').textContent = status.passAtRisk ? t.passAtRisk : status.current > 0 ? `${t.streakDays(status.current)}${save.daily.passes ? ` · ${t.passes(save.daily.passes)}` : ''}` : t.noStreak;
  $('btn-daily').classList.toggle('solved', status.solvedToday);
  $('btn-daily').hidden = !save.tutorialDone;
  const total = allShells(config).length;
  $('shells-label').textContent = t.shellCount(save.shells.length, total);
  const last = allShells(config).find((x) => x.id === save.shells.at(-1)) ?? allShells(config)[0];
  $('shell-ico').innerHTML = shellSvg(last, save.shells.length === 0);
  $('btn-shells').hidden = !save.tutorialDone;
  homeEl.hidden = false;
}

function startDaily(): void {
  audio.unlock();
  homeEl.hidden = true;
  mode = 'daily';
  dailyDate = localDateKey(new Date());
  const gen = generateDaily(dailyDate, config);
  dailyName = gen.spec.name;
  beginSession(gen.board, gen.spec.challenge);
  levelLabel.textContent = t.dailyLabel(dailyDate);
  challengeTag.textContent = t.dailyTag(dailyName);
  challengeTag.hidden = false;
  coach(null);
}

/** Grants the next shell (or the completion bonus) and fills the win card's shell row. */
function awardShell(): void {
  const r = grantShell(save.shells, config);
  const row = $('win-shell');
  if (!r.shell) {
    save.wallet = addCoins(save.wallet, config.collection.coinsWhenComplete);
    $('win-shell-art').innerHTML = '';
    $('win-shell-text').textContent = t.allShellsBonus(config.collection.coinsWhenComplete);
    row.hidden = false;
    return;
  }
  save.shells = r.owned;
  $('win-shell-art').innerHTML = shellSvg(r.shell);
  let text = t.newShell(r.shell.name);
  if (r.completedSet) {
    const bonus = config.collection.setReward;
    save.wallet = addBoosters(addCoins(save.wallet, bonus.coins), bonus.boosters);
    text += `\n${t.setComplete(r.completedSet.name, bonus.coins)}`;
  }
  $('win-shell-text').textContent = text;
  row.hidden = false;
}

function openCabinet(): void {
  const owned = new Set(save.shells);
  const cleared = save.level - 1;
  const every = config.collection.everyLevels;
  const remaining = every - (cleared % every);
  $('cabinet-title').textContent = t.cabinetTitle;
  $('cabinet-next').textContent = save.shells.length < allShells(config).length ? t.nextShell(remaining) : t.allShellsBonus(config.collection.coinsWhenComplete);
  const sets = $('cabinet-sets');
  sets.replaceChildren(
    ...setProgress(save.shells, config).map((p) => {
      const sec = document.createElement('section');
      sec.className = `shell-set${p.complete ? ' complete' : ''}`;
      const head = document.createElement('div');
      head.className = 'shell-set-head';
      head.innerHTML = `<h3></h3><span>${p.owned}/${p.total}</span>`;
      head.querySelector('h3')!.textContent = p.set.name;
      const grid = document.createElement('div');
      grid.className = 'shell-grid';
      for (const sh of p.set.shells) {
        const has = owned.has(sh.id);
        const cell = document.createElement('figure');
        cell.className = has ? 'shell-cell' : 'shell-cell locked';
        cell.innerHTML = `${shellSvg(sh, !has)}<figcaption></figcaption>`;
        cell.querySelector('figcaption')!.textContent = has ? sh.name : t.lockedShell;
        grid.appendChild(cell);
      }
      const note = document.createElement('p');
      note.className = 'shell-set-note';
      note.textContent = p.complete ? t.setDone : t.setRewardNote(config.collection.setReward.coins);
      sec.append(head, grid, note);
      return sec;
    }),
  );
  $('cabinet').hidden = false;
  $('btn-close-cabinet').focus();
}

async function shareDaily(): Promise<void> {
  const url = location.href.split('?')[0].split('#')[0];
  const text = t.shareText(dailyDate, dailyName, session.moves, save.daily.streak, url);
  try {
    if (navigator.share) {
      await navigator.share({ text });
      return;
    }
    await navigator.clipboard.writeText(text);
    showToast(t.copied);
  } catch {
    /* the share sheet was dismissed, or the clipboard is blocked */
  }
}

function play(): void {
  audio.unlock();
  homeEl.hidden = true;
  if (!save.tutorialDone) startTutorial();
  else startLevel(save.level);
}

function startTutorial(): void {
  mode = 'tutorial';
  beginSession(tutorialBoard(config), false);
  levelLabel.textContent = t.level(1);
  challengeTag.hidden = true;
  coach(0, t.tutorialLift);
}

function startLevel(n: number): void {
  mode = 'level';
  level = n;
  const gen = generateLevel(n, config);
  beginSession(gen.board, gen.spec.challenge);
  levelLabel.textContent = t.level(n);
  challengeTag.textContent = t.challenge;
  challengeTag.hidden = !gen.spec.challenge;
  coach(null);
}

function beginSession(board: Board, isChallenge: boolean): void {
  session = new GameSession(board, {
    extraJarsPerLevel: config.extraJarsPerLevel,
    hintNodeBudget: config.hint.solverNodeBudget,
    shuffleAttempts: config.shuffle.maxAttempts,
    shuffleNodeBudget: config.shuffle.solverNodeBudget,
  });
  session.onChange(onSessionEvent);
  challenge = isChallenge;
  selected = null;
  busy = false;
  pendingWin = false;
  returning.clear();
  winEl.hidden = true;
  document.body.dataset.challenge = String(isChallenge);
  buildJars();
  updateHud();
}

/** Shows the tutorial pointer on jar `i` with a caption, or hides it with `null`. */
function coach(i: number | null, text = ''): void {
  if (i === null || !jarEls[i]) {
    coachEl.hidden = true;
    return;
  }
  const r = jarEls[i].getBoundingClientRect();
  coachEl.style.left = `${r.left + r.width / 2}px`;
  coachEl.style.top = `${r.top + r.height * 0.55}px`;
  coachText.textContent = text;
  coachEl.hidden = false;
}

// ---- Session events -----------------------------------------------------

function onSessionEvent(e: SessionEvent): void {
  switch (e.type) {
    case 'pour':
      updateJar(e.move.from);
      updateJar(e.move.to, session.board.jars[e.move.to].units.length - e.moved);
      if (e.sealed) sealFx(e.move.to, config.palette[e.color].hex);
      break;
    case 'extraJar':
      buildJars();
      break;
    case 'shuffle':
      renderAllJars(true);
      break;
    case 'undo':
    case 'restart':
      selected = null;
      renderAllJars();
      break;
    case 'won':
      pendingWin = true;
      break;
    case 'stuck':
      showToast(t.stuck);
      break;
  }
  updateHud();
}

function sealFx(i: number, color: string): void {
  const el = jarEls[i];
  el.classList.remove('just-sealed');
  void el.offsetWidth;
  el.classList.add('just-sealed');
  window.setTimeout(() => {
    sparkleAround(el, color);
    audio.play('seal');
  }, reducedMotion() ? 0 : 180);
}

function showWin(): void {
  pendingWin = false;
  coach(null);
  const colors = [...new Set(session.board.jars.flatMap((j) => j.units))].map((c) => config.palette[c].hex);
  celebrate(colors);
  audio.play('win');
  $('win-shell').hidden = true;
  $('btn-share').hidden = true;
  if (mode === 'tutorial') {
    save.tutorialDone = true;
    writeSave(save);
    $('win-title').textContent = t.tutorialDoneTitle;
    $('win-text').textContent = t.tutorialDoneText;
    $('win-reward').hidden = true;
    $('win-note').textContent = '';
    btnNext.textContent = t.tutorialStart;
  } else if (mode === 'daily') {
    const r = recordDailySolve(save.daily, dailyDate, config);
    save.daily = r.state;
    save.wallet = addCoins(save.wallet, r.reward);
    if (!r.alreadySolved) awardShell();
    writeSave(save);
    $('win-title').textContent = t.dailyWinTitle;
    $('win-text').textContent = `${session.moves} ${t.poursLabel(session.moves)} · ${t.streakDays(r.state.streak)}`;
    $('win-reward').hidden = r.alreadySolved;
    $('win-note').textContent = r.alreadySolved ? t.dailyReplay : r.usedPass ? t.usedPass : r.earnedPass ? t.earnedPass : '';
    $('btn-share').hidden = false;
    btnNext.textContent = t.home;
    if (!r.alreadySolved) countUp($('win-coins'), r.reward);
  } else {
    const perfect = session.assists === 0;
    const reward = levelReward({ perfect, challenge }, config);
    const key = String(level);
    const prevBest = save.best[key];
    const firstClear = level >= save.level;
    if (prevBest === undefined || session.moves < prevBest) save.best[key] = session.moves;
    save.level = Math.max(save.level, level + 1);
    save.wallet = addCoins(save.wallet, reward);
    if (firstClear && milestoneDue(level, config)) awardShell();
    writeSave(save);
    $('win-title').textContent = perfect ? t.perfectTitle : t.winTitle;
    $('win-text').textContent = t.winText(session.moves, prevBest);
    $('win-reward').hidden = false;
    $('win-note').textContent = perfect ? t.perfectNote : '';
    btnNext.textContent = t.next;
    countUp($('win-coins'), reward);
  }
  window.setTimeout(() => {
    winEl.hidden = false;
    btnNext.focus();
  }, reducedMotion() ? 0 : ANIM.winDelay);
}

function countUp(el: HTMLElement, total: number): void {
  if (reducedMotion()) {
    el.textContent = t.reward(total);
    updateHud();
    return;
  }
  let shown = 0;
  el.textContent = t.reward(0);
  const step = Math.max(1, Math.ceil(total / 12));
  const timer = window.setInterval(() => {
    shown = Math.min(total, shown + step);
    el.textContent = t.reward(shown);
    if (shown % (step * 3) === 0 || shown === total) audio.play('coin');
    if (shown >= total) {
      window.clearInterval(timer);
      updateHud();
      const chip = $('coins-chip');
      chip.classList.remove('bump');
      void chip.offsetWidth;
      chip.classList.add('bump');
    }
  }, 55);
}

// ---- Rendering ----------------------------------------------------------

function buildJars(): void {
  const board = session.board;
  const rect = boardEl.getBoundingClientRect();
  const layout = computeLayout({ width: rect.width, height: rect.height, jars: board.jars.length, capacity: board.capacity });
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

function renderAllJars(shake = false): void {
  session.board.jars.forEach((_, i) => {
    updateJar(i);
    if (shake && !reducedMotion()) jarEls[i].animate([{ translate: '0 0' }, { translate: '0 -6px' }, { translate: '0 0' }], { duration: 260, delay: i * 25 });
  });
}

function unitColor(color: number, buried: boolean): string {
  return buried ? 'var(--buried)' : config.palette[color].hex;
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
        if (save.settings.patterns) u.classList.add(`pat-${color % 12}`);
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
  const contents = jar.units.length ? jar.units.map((c, k) => (k < jar.hidden ? t.buried : config.palette[c].id)).join(', ') : t.jarEmpty;
  el.setAttribute('aria-label', t.jarLabel(i, sealed ? `${contents} (${t.sealed})` : contents));
}

function updateHud(): void {
  movesEl.textContent = String(session.moves);
  $('moves-label').textContent = t.poursLabel(session.moves);
  coinsEl.textContent = String(save.wallet.coins);
  const over = session.status === 'won';
  for (const btn of toolButtons) {
    const id = btn.dataset.booster as BoosterId;
    const charges = save.wallet.boosters[id];
    const price = config.boosters[id].price;
    const badge = btn.querySelector('.badge') as HTMLElement;
    badge.textContent = charges > 0 ? String(charges) : String(price);
    badge.classList.toggle('price', charges === 0);
    const usable =
      !over && mode !== 'tutorial' && (id !== 'undo' || session.canUndo) && (id !== 'extraJar' || session.extraJarsLeft > 0);
    btn.disabled = !usable;
    btn.setAttribute('aria-label', t.boosterLabel(BOOSTER_NAMES[id], charges, price));
  }
  ($('btn-restart') as HTMLButtonElement).disabled = mode === 'tutorial';
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
  audio.unlock();
  if (busy || session.status === 'won' || returning.has(i)) return;
  if (selected === null) {
    if (isLiftable(i)) {
      setSelected(i);
      audio.play('select', { pitch: i });
      if (mode === 'tutorial') coach(i === 0 ? 1 : 0, t.tutorialPour);
    } else {
      nope(i);
    }
    return;
  }
  if (selected === i) {
    setSelected(null);
    audio.play('deselect');
    if (mode === 'tutorial') coach(0, t.tutorialLift);
    return;
  }
  const from = selected;
  if (canPour(session.board, from, i)) {
    if (mode === 'tutorial') coach(null);
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
  audio.play('nope');
}

/**
 * The tilted fill: a world-level band of sand inside the tilting glass, so the
 * surface stays horizontal while the jar rotates (teardown V2-3).
 * Returns the element plus helpers to animate it in step with the jar.
 */
function makeTiltFill(jarEl: HTMLElement, i: number) {
  const glass = jarEl.querySelector('.glass') as HTMLElement;
  const jar = session.board.jars[i];
  const Hg = glass.clientHeight;
  const W = glass.clientWidth;
  const fill = document.createElement('span');
  fill.className = 'tilt';
  const band = document.createElement('span');
  band.className = 'tilt-band';
  band.style.width = `${Hg * 3}px`;
  band.style.left = `${-Hg * 1.5}px`;
  const stripes = jar.units.map((c, k) => {
    const s = document.createElement('span');
    s.style.background = unitColor(c, k < jar.hidden);
    s.style.height = `${unitHeight + (k === 0 ? 40 : 0)}px`;
    return s;
  });
  band.append(...stripes);
  fill.appendChild(band);
  glass.appendChild(fill);
  jarEl.classList.add('tilting');
  /** Transform at tilt angle `phi` (radians): counter-rotate, drop to the low point, squash with the tilt. */
  const at = (phi: number, sign: number) => {
    const E = (Hg / 2) * Math.abs(Math.cos(phi)) + (W / 2) * Math.sin(phi);
    const k = (2 * E) / Hg;
    return `rotate(${-sign * phi}rad) translateY(${E - 3}px) scaleY(${k.toFixed(4)})`;
  };
  const keyframes = (from: number, to: number, sign: number) =>
    Array.from({ length: 9 }, (_, n) => ({ transform: at(from + ((to - from) * n) / 8, sign) }));
  return {
    fill,
    stripes,
    keyframes,
    remove: () => {
      fill.remove();
      jarEl.classList.remove('tilting');
    },
  };
}

async function animatePour(from: number, to: number): Promise<void> {
  busy = true;
  const src = jarEls[from];
  const dst = jarEls[to];
  const srcJar = session.board.jars[from];
  const color = config.palette[srcJar.units.at(-1)!].hex;
  const targetLen = session.board.jars[to].units.length;

  if (reducedMotion()) {
    const n = pourAmount(session.board, from, to);
    session.pour(from, to);
    audio.play('pour', { units: n });
    finishPour(from);
    return;
  }

  const s = src.getBoundingClientRect();
  const d = dst.getBoundingClientRect();
  const side = d.left + d.width / 2 >= s.left + s.width / 2 ? 1 : -1;
  const r = s.height / 2;
  const rad = (ANIM.tilt * Math.PI) / 180;
  const mouthX = d.left + d.width / 2 - side * 3;
  const mouthY = d.top - 10;
  const dx = mouthX - side * r * Math.sin(rad) - (s.left + s.width / 2);
  const dy = mouthY + r * Math.cos(rad) - (s.top + s.height / 2);
  const lifted = getComputedStyle(src).transform;
  src.classList.add('pouring');
  const tilt = makeTiltFill(src, from);
  const ease = 'cubic-bezier(.3,.7,.4,1)';

  const go = src.animate(
    [{ transform: lifted === 'none' ? 'none' : lifted }, { transform: `translate(${dx}px, ${dy}px) rotate(${side * ANIM.tilt}deg)` }],
    { duration: ANIM.lift, easing: ease, fill: 'forwards' },
  );
  const tiltIn = tilt.fill.animate(tilt.keyframes(0, rad, side), { duration: ANIM.lift, easing: ease, fill: 'forwards' });
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
  const moved = pourAmount(session.board, from, to);
  audio.play('pour', { units: moved });
  await stream.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: ANIM.streamIn, easing: 'ease-in', fill: 'forwards' }).finished;

  const before = session.board.jars[from].units.length;
  session.pour(from, to);
  const after = session.board.jars[from].units.length;
  // Drain the poured stripes from the tilted fill.
  tilt.stripes.slice(after, before).forEach((el) => el.animate([{ height: `${unitHeight}px` }, { height: '0px' }], { duration: ANIM.flow, fill: 'forwards' }));
  burst({ x: mouthX, y: surface - (before - after) * unitHeight * 0.5, colors: [color], count: 10, spread: 22, angle: 0, cone: 160, size: 4, duration: 420, gravity: 14 });
  audio.play('land', { pitch: targetLen });
  await wait(ANIM.flow);

  stream.style.transformOrigin = 'bottom';
  await stream.animate([{ transform: 'scaleY(1)' }, { transform: 'scaleY(0)' }], { duration: ANIM.streamOut, fill: 'forwards' }).finished;
  stream.remove();

  // Let the player act again while the jar flies home.
  returning.add(from);
  src.classList.add('returning');
  finishPour(from);
  const back = src.animate([{ transform: `translate(${dx}px, ${dy}px) rotate(${side * ANIM.tilt}deg)` }, { transform: 'none' }], {
    duration: ANIM.back,
    easing: 'cubic-bezier(.4,0,.3,1)',
    fill: 'forwards',
  });
  const tiltOut = tilt.fill.animate(tilt.keyframes(rad, 0, side), { duration: ANIM.back, easing: 'cubic-bezier(.4,0,.3,1)', fill: 'forwards' });
  await back.finished;
  go.cancel();
  back.cancel();
  tiltIn.cancel();
  tiltOut.cancel();
  tilt.remove();
  src.classList.remove('pouring', 'returning');
  returning.delete(from);
  if (pendingWin) showWin();
}

function finishPour(from: number): void {
  if (selected === from) selected = null;
  renderSelectedState();
  busy = false;
  if (pendingWin && reducedMotion()) showWin();
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

function showToast(text: string): void {
  toastEl.textContent = text;
  toastEl.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), 2600);
}

// ---- Boosters -----------------------------------------------------------

/** Spends a charge (or coins) and applies the booster; refunds if it couldn't apply. */
function useBooster(id: BoosterId): void {
  audio.unlock();
  if (busy || returning.size || mode === 'tutorial' || session.status === 'won') return;
  if (id === 'undo' && !session.canUndo) return showToast(t.noUndo);
  if (id === 'extraJar' && session.extraJarsLeft <= 0) return showToast(t.noJars);
  const before = save.wallet;
  const r = spendBooster(save.wallet, id, config);
  if (!r.ok) {
    audio.play('nope');
    return showToast(t.notEnoughCoins(config.boosters[id].price));
  }
  let applied = false;
  setSelected(null);
  if (id === 'undo') applied = session.undo();
  else if (id === 'extraJar') applied = session.addExtraJar();
  else if (id === 'shuffle') {
    applied = session.shuffle(shuffleRng);
    if (!applied) showToast(t.noShuffle);
    else audio.play('shuffle');
  } else if (id === 'hint') applied = showHint();
  save.wallet = applied ? r.wallet : before;
  writeSave(save);
  if (applied) {
    if (id !== 'shuffle') audio.play('booster');
    if (r.paidCoins) showToast(t.boughtWith(r.paidCoins));
  }
  updateHud();
}

/** Highlights the solver's next move. Returns false if there is none. */
function showHint(): boolean {
  const m = session.hint();
  if (!m) {
    showToast(t.noHint);
    return false;
  }
  clearHint();
  for (const [i, cls] of [
    [m.from, 'hint-from'],
    [m.to, 'hint-to'],
  ] as const) {
    const el = jarEls[i];
    void el.offsetWidth; // restart the CSS animation
    el.classList.add(cls);
  }
  hintTimer = window.setTimeout(clearHint, 2400);
  return true;
}

/** Removes any visible hint highlight, so only one hint shows at a time. */
function clearHint(): void {
  window.clearTimeout(hintTimer);
  for (const el of jarEls) el.classList.remove('hint-from', 'hint-to');
}

// ---- Wiring -------------------------------------------------------------

function wireInput(): void {
  for (const btn of toolButtons) btn.addEventListener('click', () => useBooster(btn.dataset.booster as BoosterId));
  $('btn-restart').addEventListener('click', () => {
    if (busy || returning.size || mode === 'tutorial') return;
    session.restart();
  });
  $('btn-play').addEventListener('click', play);
  btnNext.addEventListener('click', () => {
    winEl.hidden = true;
    if (mode === 'daily') showHome();
    else startLevel(mode === 'tutorial' ? 1 : level + 1);
  });
  $('btn-daily').addEventListener('click', startDaily);
  $('btn-shells').addEventListener('click', openCabinet);
  $('btn-close-cabinet').addEventListener('click', () => ($('cabinet').hidden = true));
  $('btn-share').addEventListener('click', () => void shareDaily());
  $('btn-settings').addEventListener('click', openSettings);
  $('btn-close-settings').addEventListener('click', () => (settingsEl.hidden = true));
  $('btn-home').addEventListener('click', () => {
    settingsEl.hidden = true;
    showHome();
  });
  $('btn-tutorial').addEventListener('click', () => {
    settingsEl.hidden = true;
    startTutorial();
  });
  for (const key of ['sound', 'music', 'haptics', 'patterns'] as const) {
    $<HTMLInputElement>(`set-${key}`).addEventListener('change', (e) => {
      save.settings[key] = (e.target as HTMLInputElement).checked;
      writeSave(save);
      audio.configure(save.settings);
      if (key === 'patterns') renderAllJars();
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (!$('cabinet').hidden) {
      if (e.key === 'Escape') $('cabinet').hidden = true;
      return;
    }
    if (!homeEl.hidden) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        play();
      }
      return;
    }
    if (!winEl.hidden) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        btnNext.click();
      }
      return;
    }
    if (!settingsEl.hidden) {
      if (e.key === 'Escape') settingsEl.hidden = true;
      return;
    }
    const k = e.key.toLowerCase();
    if (k === 'z') useBooster('undo');
    else if (k === 's') useBooster('shuffle');
    else if (k === 'j') useBooster('extraJar');
    else if (k === 'h') useBooster('hint');
    else if (k === 'r') $('btn-restart').click();
    else if (k === 'escape') setSelected(null);
    else if (/^[0-9]$/.test(k)) {
      const i = k === '0' ? 9 : Number(k) - 1;
      if (i < jarEls.length) onJarTap(i);
    }
  });

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (busy || returning.size) return;
      buildJars();
      if (mode === 'tutorial' && !coachEl.hidden) coach(selected === null ? 0 : selected === 0 ? 1 : 0, coachText.textContent ?? '');
    }, 120);
  });
}

function openSettings(): void {
  for (const key of ['sound', 'music', 'haptics', 'patterns'] as const) $<HTMLInputElement>(`set-${key}`).checked = save.settings[key];
  settingsEl.hidden = false;
  $('btn-close-settings').focus();
}

function applyStrings(): void {
  for (const btn of toolButtons) (btn.querySelector('.tool-name') as HTMLElement).textContent = BOOSTER_NAMES[btn.dataset.booster as BoosterId];
  $('moves-label').textContent = t.pours;
  $('btn-restart').title = t.restart;
  $('btn-settings').title = t.settings;
  $('settings-title').textContent = t.settings;
  for (const el of document.querySelectorAll<HTMLElement>('[data-s]')) el.textContent = t[el.dataset.s as 'sound' | 'music' | 'haptics' | 'patterns'];
  $('btn-home').textContent = t.home;
  $('btn-tutorial').textContent = t.replayTutorial;
  $('btn-close-settings').textContent = t.close;
  $('home-title').textContent = t.brand;
  $('home-tagline').textContent = t.tagline;
  $('btn-share').textContent = t.share;
  $('btn-close-cabinet').title = t.close;
  boardEl.setAttribute('aria-label', t.boardLabel);
}

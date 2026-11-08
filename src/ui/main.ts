/**
 * Strata's browser front end: home screen, tutorial, board rendering, boosters,
 * rewards and the pour animation. It owns no game rules: GameSession (rules) and
 * economy.ts (coins and boosters) decide, and this file displays and asks.
 * Implements design/game-brief.md MVP 5-6 and design/competitive-roadmap.md C1-C5.
 */
import './style.css';
import rawConfig from '../config/game-config.json';
import { type Board, type Jar, canPour, isClosed, isSealed, pourAmount } from '../core/board';
import { type CollectionConfig, allShells, grantShell, milestoneDue, setProgress } from '../core/collection';
import { type DailyConfig, generateDaily, recordDailySolve, streakStatus, utcDateKey, weekday } from '../core/daily';
import { type BoosterId, type EconomyConfig, addBoosters, addCoins, clearReward, spendBooster } from '../core/economy';
import { generateLevel, tutorialBoard } from '../core/generator';
import { type GameConfig, type MechanicId, launchLevel } from '../core/levels';
import { createRng } from '../core/rng';
import { GameSession, type SessionEvent } from '../core/session';
import { type ThemeConfig, type ThemeTokens, activeTheme, buyTheme } from '../core/themes';
import { GameAudio } from './audio';
import { burst, celebrate, sparkleAround } from './fx';
import { computeLayout } from './layout';
import { shellSvg } from './shells';
import { type SaveData, exportSave, importSave, loadSave, writeSave } from './storage';
import { t } from './strings';

const config = rawConfig as unknown as GameConfig & EconomyConfig & DailyConfig & CollectionConfig & ThemeConfig;
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

const TOKEN_VARS: Record<keyof ThemeTokens, string> = {
  bgTop: '--bg-top', bgBottom: '--bg-bottom', sea: '--sea', ink: '--ink', inkSoft: '--ink-soft', glass: '--glass',
  glassEdge: '--glass-edge', card: '--card', accent: '--accent', accentInk: '--accent-ink', surface: '--surface',
  surface2: '--surface-2', toastBg: '--toast-bg', toastFg: '--toast-fg', sky: '--sky', themeColor: '--theme-color',
};

/** Colour-blind patterns defined in style.css (.pat-0 … .pat-13), one per palette colour. */
const PATTERNS = 14;
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
applyTheme(currentTheme());
window.setInterval(() => {
  if ($('scenes').hidden) applyTheme(currentTheme()); // follow the clock in auto mode
}, 60_000);
wireInput();
if (qaLevel) {
  level = launchLevel(levelParam, save.level); // replay only, never beyond progress (D3)
  startLevel(level);
} else {
  startLevel(level);
  showHome();
}

// ---- Save code (decision D16) -------------------------------------------

let restoreArmed = false;

function openTransfer(): void {
  $<HTMLTextAreaElement>('transfer-code').value = exportSave(save);
  $('transfer-status').textContent = t.saveCodeHelp;
  restoreArmed = false;
  $('btn-restore-code').textContent = t.restoreCode;
  $('transfer').hidden = false;
}

async function copySaveCode(): Promise<void> {
  const box = $<HTMLTextAreaElement>('transfer-code');
  box.value = exportSave(save);
  try {
    await navigator.clipboard.writeText(box.value);
    $('transfer-status').textContent = t.codeCopied;
  } catch {
    box.select(); // clipboard blocked: leave it selected for a manual copy
    $('transfer-status').textContent = t.codeSelectManually;
  }
}

/** Restores from the pasted code. The first tap asks for confirmation; the second replaces progress. */
function restoreSaveCode(): void {
  const imported = importSave($<HTMLTextAreaElement>('transfer-code').value, config);
  if (!imported) {
    restoreArmed = false;
    $('btn-restore-code').textContent = t.restoreCode;
    $('transfer-status').textContent = t.codeInvalid;
    audio.play('nope');
    return;
  }
  if (!restoreArmed) {
    restoreArmed = true;
    $('btn-restore-code').textContent = t.restoreConfirm;
    $('transfer-status').textContent = t.restoreWarning(imported.level, imported.wallet.coins);
    return;
  }
  save = imported;
  writeSave(save);
  audio.configure(save.settings);
  applyTheme(currentTheme());
  $('transfer').hidden = true;
  showToast(t.restored);
  startLevel(save.level);
  showHome();
}

// ---- Scenes (sprint 4) --------------------------------------------------


function currentTheme(): string {
  return activeTheme(save.themes, new Date().getHours(), config);
}

/** Applies a scene's colour tokens. Sand colours are never touched (decision S4-4). */
function applyTheme(id: string): void {
  const theme = config.themes.list.find((x) => x.id === id) ?? config.themes.list[0];
  const root = document.documentElement.style;
  for (const [key, cssVar] of Object.entries(TOKEN_VARS)) root.setProperty(cssVar, theme.tokens[key as keyof ThemeTokens]);
  document.body.dataset.theme = theme.id;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.tokens.themeColor);
}

let previewing: string | null = null;

function openScenes(): void {
  previewing = currentTheme();
  $<HTMLInputElement>('set-auto').checked = save.themes.auto;
  renderScenes();
  $('scenes').hidden = false;
}

function renderScenes(): void {
  $('scenes-coins').textContent = String(save.wallet.coins);
  const grid = $('scene-grid');
  grid.replaceChildren(
    ...config.themes.list.map((theme) => {
      const owned = theme.price === 0 || save.themes.owned.includes(theme.id);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'scene-card';
      card.setAttribute('aria-pressed', String(previewing === theme.id));
      const k = theme.tokens;
      card.innerHTML = `<span class="scene-swatch" style="--sw-edge:${k.glassEdge};background:radial-gradient(120% 50% at 50% 115%, ${k.sea} 0 40%, transparent 41%),radial-gradient(80% 70% at 80% 0, ${k.sky} 0 35%, transparent 60%),linear-gradient(${k.bgTop}, ${k.bgBottom})"><i></i><i></i><i></i></span><span class="scene-name"></span><span class="scene-status"></span>`;
      card.querySelector('.scene-name')!.textContent = theme.name;
      const status = card.querySelector('.scene-status') as HTMLElement;
      const inUse = owned && currentTheme() === theme.id;
      status.textContent = inUse ? t.sceneInUse : owned ? t.sceneOwned : String(theme.price);
      status.classList.toggle('price', !owned);
      card.addEventListener('click', () => {
        previewing = theme.id;
        applyTheme(theme.id);
        audio.play('select');
        renderScenes();
      });
      return card;
    }),
  );
  const theme = config.themes.list.find((x) => x.id === previewing)!;
  const owned = theme.price === 0 || save.themes.owned.includes(theme.id);
  const btn = $<HTMLButtonElement>('btn-scene-buy');
  const inUse = owned && currentTheme() === theme.id;
  btn.hidden = inUse;
  btn.disabled = !owned && save.wallet.coins < theme.price;
  btn.textContent = owned ? t.sceneUse(theme.name) : save.wallet.coins >= theme.price ? t.sceneBuy(theme.name, theme.price) : t.sceneNeed(theme.price, save.wallet.coins);
  $('scenes-auto-note').textContent = t.matchClockNote;
}

function confirmScene(): void {
  if (!previewing) return;
  const theme = config.themes.list.find((x) => x.id === previewing)!;
  const owned = theme.price === 0 || save.themes.owned.includes(theme.id);
  if (!owned) {
    const r = buyTheme(save.wallet, save.themes.owned, theme.id, config);
    if (!r.ok) return;
    save.wallet = r.wallet;
    save.themes = { ...save.themes, owned: r.owned };
    audio.play('coin');
    showToast(t.sceneBought(theme.name));
  }
  // Choosing a scene by hand pins it (turns clock-matching off).
  save.themes = { ...save.themes, selected: theme.id, auto: false };
  writeSave(save);
  applyTheme(currentTheme());
  $('home-coins').textContent = String(save.wallet.coins);
  updateHud();
  renderScenes();
}

function closeScenes(): void {
  $('scenes').hidden = true;
  previewing = null;
  applyTheme(currentTheme()); // drop any unpurchased preview
}

// ---- Screens ------------------------------------------------------------

function showHome(): void {
  winEl.hidden = true;
  $('home-coins').textContent = String(save.wallet.coins);
  $('btn-play').textContent = save.tutorialDone ? t.play(save.level) : t.playTutorial;
  const today = utcDateKey(new Date()); // the daily follows UTC (design/gdd/daily-puzzle.md, M4)
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
  $('btn-scenes').hidden = !save.tutorialDone;
  homeEl.hidden = false;
}

function startDaily(): void {
  audio.unlock();
  homeEl.hidden = true;
  mode = 'daily';
  dailyDate = utcDateKey(new Date());
  const gen = generateDaily(dailyDate, config);
  dailyName = gen.spec.name;
  beginSession(gen.board, gen.spec.challenge);
  levelLabel.textContent = t.dailyLabel(dailyDate);
  challengeTag.textContent = t.dailyTag(dailyName);
  challengeTag.hidden = false;
  coach(null);
  introduce(gen.spec.mechanics);
}

const MECHANICS: MechanicId[] = ['narrow', 'frozen', 'locked', 'funnel'];

/** A tiny static jar illustrating a mechanic, built from the same classes as the board. */
function miniJar(id: MechanicId): string {
  const lockC = config.palette[2].hex;
  const units = id === 'narrow' ? ['#2a9d8f'] : id === 'funnel' ? ['#f2a541', '#f2a541'] : ['#c8553d', '#2a9d8f', '#f2a541'];
  const sand = units.map((c) => `<span class="unit" style="--c:${c}"></span>`).join('');
  const extra = id === 'frozen' ? '<span class="ice"></span>' : '';
  const top = id === 'locked' ? `<span class="padlock" style="--lock:${lockC}"></span>` : id === 'funnel' ? '<span class="funnel-mark"></span>' : '';
  return `<span class="mini-jar ${id}" aria-hidden="true">${top}<span class="glass"><span class="sand">${sand}</span>${extra}<span class="shine"></span></span></span>`;
}

/** Shows the intro card for any mechanic on this board the player hasn't met yet. */
function introduce(ids: readonly MechanicId[]): void {
  const fresh = ids.filter((id) => !save.seenMechanics.includes(id));
  if (!fresh.length) return;
  save.seenMechanics = [...save.seenMechanics, ...fresh];
  writeSave(save);
  showMechanicCards(fresh, t.newJar);
}

function showMechanicCards(ids: readonly MechanicId[], kicker: string): void {
  $('intro-kicker').textContent = kicker;
  $('intro-list').replaceChildren(
    ...ids.map((id) => {
      const row = document.createElement('div');
      const unlockAt = config.mechanics.list.find((m) => m.id === id)!.unlockAt;
      const known = save.seenMechanics.includes(id) || save.level > unlockAt;
      row.className = `intro-row${known ? '' : ' unknown'}`;
      row.innerHTML = `${miniJar(id)}<div><h2></h2><p></p></div>`;
      row.querySelector('h2')!.textContent = t.mechanics[id].name;
      row.querySelector('p')!.textContent = known ? t.mechanics[id].rule : t.unlocksAt(unlockAt);
      return row;
    }),
  );
  $('intro').hidden = false;
  $('btn-intro-ok').focus();
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
      // Completed sets start collapsed so the list stays short; tap the header to open one.
      const head = document.createElement('button');
      head.type = 'button';
      head.className = 'shell-set-head';
      head.innerHTML = `<h3></h3><span>${p.owned}/${p.total}</span>`;
      head.querySelector('h3')!.textContent = p.set.name;
      head.setAttribute('aria-expanded', String(!p.complete));
      const body = document.createElement('div');
      body.className = 'shell-set-body';
      body.id = `shell-set-${p.set.id}`;
      body.hidden = p.complete;
      head.setAttribute('aria-controls', body.id);
      head.addEventListener('click', () => {
        const open = head.getAttribute('aria-expanded') !== 'true';
        head.setAttribute('aria-expanded', String(open));
        body.hidden = !open;
        audio.play(open ? 'select' : 'deselect');
      });
      const grid = document.createElement('div');
      grid.className = 'shell-grid';
      for (const sh of p.set.shells) {
        const has = owned.has(sh.id);
        const cell = document.createElement('figure');
        cell.className = has ? 'shell-cell' : 'shell-cell locked';
        cell.innerHTML = `${shellSvg({ ...sh, effect: p.set.effect }, !has)}<figcaption></figcaption>`;
        cell.querySelector('figcaption')!.textContent = has ? sh.name : t.lockedShell;
        grid.appendChild(cell);
      }
      const note = document.createElement('p');
      note.className = 'shell-set-note';
      note.textContent = p.complete ? t.setDone : t.setRewardNote(config.collection.setReward.coins);
      body.append(grid, note);
      sec.append(head, body);
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
  introduce(gen.spec.mechanics);
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
      // A seal can thaw or unlock jars anywhere on the board, so redraw the rest too.
      session.board.jars.forEach((_, i) => i !== e.move.from && i !== e.move.to && updateJar(i));
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
    const counts = !r.alreadySolved && !r.outOfOrder;
    if (counts) awardShell();
    writeSave(save);
    $('win-title').textContent = t.dailyWinTitle;
    $('win-text').textContent = `${session.moves} ${t.poursLabel(session.moves)} · ${t.streakDays(r.state.streak)}`;
    $('win-reward').hidden = !counts;
    $('win-note').textContent = r.outOfOrder ? t.dailyOutOfOrder : r.alreadySolved ? t.dailyReplay : r.usedPass ? t.usedPass : r.earnedPass ? t.earnedPass : '';
    $('btn-share').hidden = false;
    btnNext.textContent = t.home;
    if (counts) countUp($('win-coins'), r.reward);
  } else {
    const perfect = session.assists === 0;
    const firstClear = level >= save.level;
    // Coins on the first clear only; replays pay nothing (design/gdd/economy.md, M1).
    const reward = clearReward({ level, nextLevel: save.level, perfect, challenge }, config);
    const key = String(level);
    const prevBest = save.best[key];
    if (prevBest === undefined || session.moves < prevBest) save.best[key] = session.moves;
    save.level = Math.max(save.level, level + 1);
    save.wallet = addCoins(save.wallet, reward);
    if (firstClear && milestoneDue(level, config)) awardShell();
    writeSave(save);
    $('win-title').textContent = perfect ? t.perfectTitle : t.winTitle;
    $('win-text').textContent = t.winText(session.moves, prevBest);
    $('win-reward').hidden = !firstClear;
    $('win-note').textContent = !firstClear ? t.replayNote : perfect ? t.perfectNote : '';
    btnNext.textContent = t.next;
    if (firstClear) countUp($('win-coins'), reward);
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
    jar.innerHTML =
      '<span class="cork" aria-hidden="true"></span><span class="padlock" aria-hidden="true"></span><span class="funnel-mark" aria-hidden="true"></span>' +
      '<span class="glass"><span class="sand"></span><span class="ice" aria-hidden="true"></span><span class="shine"></span></span>';
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
        if (save.settings.patterns) u.classList.add(`pat-${color % PATTERNS}`);
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
  renderMechanics(el, jar);
  el.classList.toggle('selected', selected === i);
  el.setAttribute('aria-pressed', String(selected === i));
  const contents = jar.units.length ? jar.units.map((c, k) => (k < jar.hidden ? t.buried : config.palette[c].id)).join(', ') : t.jarEmpty;
  const states = [
    jar.cap !== undefined ? t.jarStates.narrow : '',
    jar.frozen ? t.jarStates.frozen : '',
    jar.lock !== undefined ? t.jarStates.locked(config.palette[jar.lock].id) : '',
    jar.funnel ? t.jarStates.funnel : '',
    sealed ? t.sealed : '',
  ].filter(Boolean);
  el.setAttribute('aria-label', t.jarLabel(i, states.length ? `${contents} (${states.join(', ')})` : contents));
}

/** Draws a jar's mechanic state, and plays the thaw/unlock effect when one ends. */
function renderMechanics(el: HTMLElement, jar: Jar): void {
  const wasFrozen = el.dataset.frozen === '1';
  const wasLocked = el.dataset.lock !== undefined && el.dataset.lock !== '';
  el.classList.toggle('narrow', jar.cap !== undefined);
  el.classList.toggle('funnel', jar.funnel === true);
  el.classList.toggle('frozen', jar.frozen === true);
  el.classList.toggle('locked', jar.lock !== undefined);
  const glass = el.querySelector('.glass') as HTMLElement;
  if (jar.cap !== undefined) glass.style.height = `${unitHeight * jar.cap + Math.round(unitHeight * 0.45)}px`;
  else glass.style.removeProperty('height');
  const padlock = el.querySelector('.padlock') as HTMLElement;
  if (jar.lock !== undefined) {
    padlock.style.setProperty('--lock', config.palette[jar.lock].hex);
    padlock.className = `padlock${save.settings.patterns ? ` pat-${jar.lock % PATTERNS}` : ''}`;
  }
  if (wasFrozen && !jar.frozen) mechanicFx(el, 'thawing', t.thawed);
  if (wasLocked && jar.lock === undefined) mechanicFx(el, 'unlocking', t.unlocked);
  el.dataset.frozen = jar.frozen ? '1' : '';
  el.dataset.lock = jar.lock !== undefined ? String(jar.lock) : '';
}

function mechanicFx(el: HTMLElement, cls: string, label: string): void {
  showToast(label);
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  window.setTimeout(() => el.classList.remove(cls), 900);
  audio.play('booster');
  const r = el.getBoundingClientRect();
  burst({ x: r.left + r.width / 2, y: r.top + r.height * 0.3, colors: ['#dff3ff', '#ffffff', '#b9e0f5'], count: 14, spread: r.width, size: 5, duration: 600, className: 'spark' });
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
  return !!jar && jar.units.length > 0 && !isSealed(jar, session.board.capacity) && !isClosed(jar) && !jar.funnel;
}

/** Explains why a mechanic jar refused a tap. */
function explain(i: number): void {
  const jar = session.board.jars[i];
  if (!jar) return;
  const id: MechanicId | null = jar.frozen ? 'frozen' : jar.lock !== undefined ? 'locked' : jar.funnel ? 'funnel' : jar.cap !== undefined ? 'narrow' : null;
  if (id) showToast(t.mechanics[id].tap);
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
      explain(i);
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
  $('btn-scenes').addEventListener('click', openScenes);
  $('btn-scenes-2').addEventListener('click', () => {
    settingsEl.hidden = true;
    openScenes();
  });
  $('btn-scene-buy').addEventListener('click', confirmScene);
  $('btn-close-scenes').addEventListener('click', closeScenes);
  $<HTMLInputElement>('set-auto').addEventListener('change', (e) => {
    save.themes = { ...save.themes, auto: (e.target as HTMLInputElement).checked };
    writeSave(save);
    previewing = currentTheme();
    applyTheme(previewing);
    renderScenes();
  });
  $('btn-shells').addEventListener('click', openCabinet);
  $('btn-close-cabinet').addEventListener('click', () => ($('cabinet').hidden = true));
  $('btn-share').addEventListener('click', () => void shareDaily());
  $('btn-settings').addEventListener('click', openSettings);
  $('btn-close-settings').addEventListener('click', () => (settingsEl.hidden = true));
  $('btn-home').addEventListener('click', () => {
    settingsEl.hidden = true;
    showHome();
  });
  $('btn-savecode').addEventListener('click', () => {
    settingsEl.hidden = true;
    openTransfer();
  });
  $('btn-copy-code').addEventListener('click', () => void copySaveCode());
  $('btn-restore-code').addEventListener('click', restoreSaveCode);
  $('btn-close-transfer').addEventListener('click', () => ($('transfer').hidden = true));
  $('btn-guide').addEventListener('click', () => {
    settingsEl.hidden = true;
    showMechanicCards(MECHANICS, t.jarGuide);
  });
  $('btn-intro-ok').addEventListener('click', () => ($('intro').hidden = true));
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
    if (!$('transfer').hidden) {
      if (e.key === 'Escape') $('transfer').hidden = true;
      return;
    }
    if (!$('scenes').hidden) {
      if (e.key === 'Escape') closeScenes();
      return;
    }
    if (!$('intro').hidden) {
      if (e.key === 'Escape' || e.key === 'Enter') $('intro').hidden = true;
      return;
    }
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
  $('btn-guide').textContent = t.jarGuide;
  $('btn-savecode').textContent = t.saveCode;
  $('transfer-title').textContent = t.saveCode;
  $('btn-copy-code').textContent = t.copyCode;
  $('btn-close-transfer').textContent = t.close;
  $('scenes-label').textContent = t.scenes;
  $('btn-scenes-2').textContent = t.scenes;
  $('scenes-title').textContent = t.scenes;
  $('scenes-auto-label').textContent = t.matchClock;
  $('btn-close-scenes').textContent = t.close;
  $('btn-intro-ok').textContent = t.gotIt;
  $('btn-close-settings').textContent = t.close;
  $('home-title').textContent = t.brand;
  $('home-tagline').textContent = t.tagline;
  $('btn-share').textContent = t.share;
  $('btn-close-cabinet').title = t.close;
  boardEl.setAttribute('aria-label', t.boardLabel);
}

// ---- Offline install (sprint 3, T8) ------------------------------------
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      /* offline support unavailable; the game still works online */
    });
  });
}
